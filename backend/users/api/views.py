"""Vistas HTTP de la app `users` (capa delgada: HTTP ↔ dominio)."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import filters, generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from users.authentication import (
    SESSION_CLAIM,
    TOKEN_VERSION_CLAIM,
    token_esta_revocado,
)
from users.permissions import IsAdminRole
from users.selectors import user_list
from users.services import (
    SesionEnUso,
    password_reset_buscar,
    password_reset_confirmar,
    password_reset_solicitar,
    sesion_abrir,
    sesion_cerrar,
    sesion_latir,
    sesion_vigente,
    user_set_password,
)

from .serializers import (
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    MeUpdateSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserSerializer,
)

User = get_user_model()

logger = logging.getLogger(__name__)


def client_ip(request) -> str | None:
    """IP del cliente, considerando un posible proxy inverso (X-Forwarded-For)."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

# NOTA: no existe una vista de auto-registro público. Las cuentas las crea un
# Administrador (`AdminUserListCreateView`, POST /api/usuarios/). Exponer un alta
# pública daría a desconocidos acceso de lectura a dispositivos y PINs.


class MeView(generics.RetrieveUpdateAPIView):
    """Perfil del usuario autenticado: consulta (GET) y edición propia (PATCH).

    Solo permite editar datos personales (nombre/apellido); el rol y los
    permisos NO son auto-editables (anti escalado de privilegios).
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return MeUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        # Responde siempre con la representación segura y completa del perfil.
        return Response(UserSerializer(self.get_object()).data)


class VersionedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Incrusta la versión de token vigente del usuario en el JWT (claim `tv`).

    Permite la revocación server-side: ver users/authentication.py.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[TOKEN_VERSION_CLAIM] = user.token_version
        return token


def emitir_par_de_tokens(user, *, sid) -> dict[str, str]:
    """Par access/refresh atado a una sesión concreta (claim `sid`).

    SimpleJWT copia los claims personalizados del refresh al access que deriva
    de él, así que basta con ponerlos una vez.
    """
    refresh = VersionedTokenObtainPairSerializer.get_token(user)
    refresh[SESSION_CLAIM] = str(sid)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class LoginView(TokenObtainPairView):
    """Obtiene el par de tokens (access/refresh) con email + password.

    **Sesión única**: si la cuenta ya tiene una sesión abierta en otro navegador
    o equipo, el inicio se rechaza con 409 en vez de abrir una segunda. La
    sesión anterior no se toca: quien está trabajando no pierde lo que hace.

    Que la única forma de desbloquearse sea cerrar sesión (o esperar a que
    caduque por inactividad) es la intención de la regla, no un descuido. Un
    administrador puede forzar el cierre desde /usuarios si alguien se queda
    fuera por haber cerrado el navegador sin salir.
    """

    serializer_class = VersionedTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        # Credenciales primero: si son incorrectas debe responder 401 aunque la
        # cuenta tenga sesión abierta. Al revés, el 409 le confirmaría a un
        # desconocido que ese correo existe y está en uso.
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc

        user = serializer.user

        try:
            sesion = sesion_abrir(
                user=user,
                ip=client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
        except SesionEnUso as exc:
            activa = exc.sesion
            minutos = settings.SESSION_INACTIVITY_MINUTOS
            return Response(
                {
                    'detail': (
                        f'Esta cuenta ya tiene una sesión abierta en '
                        f'{activa.descripcion_dispositivo}. Cierra sesión allí '
                        f'para poder entrar aquí.'
                    ),
                    'code': 'sesion_activa',
                    'dispositivo': activa.descripcion_dispositivo,
                    'iniciada': activa.creada,
                    'ultima_actividad': activa.ultima_actividad,
                    # Para que la interfaz pueda decir cuánto falta si el otro
                    # equipo simplemente se quedó abierto y sin usar.
                    'expira_por_inactividad_minutos': minutos,
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(emitir_par_de_tokens(user, sid=sesion.id))


class RevocationAwareTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh que respeta la revocación server-side y la sesión única.

    Rechaza un refresh emitido antes del corte del usuario, de una cuenta
    inactiva/eliminada, o de una sesión que ya no es la vigente.

    Además es el **latido** de la sesión: cada renovación marca actividad, y es
    lo que mantiene viva la sesión frente a la ventana de inactividad.
    """

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc

        user = User.objects.filter(id=refresh.get('user_id')).first()
        if user is None or not user.is_active:
            raise InvalidToken('La cuenta no está disponible.')
        if token_esta_revocado(user, refresh):
            raise InvalidToken('La sesión fue cerrada. Inicia sesión de nuevo.')
        if not sesion_latir(user=user, sid=refresh.get(SESSION_CLAIM)):
            raise InvalidToken('Tu sesión ya no está activa. Inicia sesión de nuevo.')

        # El refresh rotado conserva los claims personalizados (`tv` y `sid`):
        # SimpleJWT reutiliza el mismo token cambiándole jti/exp/iat.
        return super().validate(attrs)


class RefreshView(TokenRefreshView):
    """Renueva el access token a partir de un refresh válido (y no revocado)."""

    serializer_class = RevocationAwareTokenRefreshSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class LogoutView(APIView):
    """Cierre de sesión real: revoca los tokens del usuario en el servidor.

    A partir de aquí, cualquier access/refresh emitido antes deja de ser válido
    (incluye los que hubieran podido filtrarse). El cliente además descarta los
    suyos localmente. Libera también la sesión única, para poder volver a entrar
    desde cualquier navegador.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        request.user.revoke_tokens()
        sesion_cerrar(request.user)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class ChangePasswordView(APIView):
    """Cambio de la propia contraseña.

    Al cambiarla se **revocan** las demás sesiones (bump de versión de token) y
    se **re-emite** un par de tokens para la sesión actual, para no cerrarla.
    Throttle 'login' para limitar intentos contra la contraseña actual.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user_set_password(
            user=user, raw_password=serializer.validated_data['new_password']
        )
        # Invalida cualquier token anterior (otras sesiones / posibles filtrados).
        user.revoke_tokens()
        # Re-emite para el cliente actual con la nueva versión de token. Se
        # conserva el `sid`: la sesión sigue siendo la misma, solo cambian los
        # tokens, así que cambiar la contraseña no obliga a volver a entrar.
        sid = (request.auth or {}).get(SESSION_CLAIM)
        return Response(emitir_par_de_tokens(user, sid=sid))


# ---------------------------------------------------------------------------
# Recuperación de contraseña (usuario no autenticado)
# ---------------------------------------------------------------------------
# Estas tres vistas son públicas (AllowAny) porque quien las usa, por
# definición, no puede iniciar sesión. La protección es: respuesta genérica
# (no revela qué correos existen), throttle agresivo y enlace de un solo uso
# con 10 minutos de vida.

class PasswordResetRequestView(APIView):
    """Pide el enlace de recuperación por correo.

    Responde 202 SIEMPRE, exista o no la cuenta: una respuesta distinta
    convertiría este endpoint en un verificador de correos registrados.
    """

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            password_reset_solicitar(
                email=serializer.validated_data['email'], ip=client_ip(request)
            )
        except Exception:
            # Un fallo de envío (Gmail caído, token revocado) no debe distinguirse
            # de un correo inexistente: se registra para operaciones y al cliente
            # se le responde igual.
            logger.exception('Fallo al enviar el correo de recuperación.')

        return Response(
            {
                'detail': (
                    'Si el correo corresponde a una cuenta activa, te enviamos '
                    'un enlace para restablecer la contraseña.'
                ),
                'expira_minutos': settings.PASSWORD_RESET_MINUTOS,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetValidateView(APIView):
    """Comprueba un token antes de mostrar el formulario.

    Permite que la pantalla diga "este enlace venció" nada más abrirla, en vez
    de hacer que el usuario escriba una contraseña nueva para recién entonces
    rechazarla.
    """

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def get(self, request):
        registro = password_reset_buscar(request.query_params.get('token', ''))
        if registro is None or not registro.es_valido:
            # Motivo para la interfaz. No filtra nada: quien tiene el token ya
            # lo tiene, y sin token la respuesta es siempre 'invalido'.
            if registro is None:
                motivo = 'invalido'
            elif registro.usado:
                motivo = 'usado'
            elif registro.vencido:
                motivo = 'vencido'
            else:
                motivo = 'invalido'
            return Response(
                {'valido': False, 'motivo': motivo},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'valido': True,
            # El correo (parcialmente oculto) confirma al usuario que el enlace
            # es de su cuenta, sin exponerlo entero a quien intercepte la URL.
            'email': _email_ofuscado(registro.user.email),
            'expira_en': registro.expira_en,
        })


class PasswordResetConfirmView(APIView):
    """Fija la nueva contraseña y consume el enlace."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        # El token se lee antes de validar el serializer para poder aplicar las
        # reglas de contraseña contra el usuario dueño del enlace.
        registro = password_reset_buscar(str(request.data.get('token', '')))
        if registro is None or not registro.es_valido:
            raise ValidationError({
                'token': [
                    'El enlace no es válido o ya venció. Solicita uno nuevo.'
                ]
            })

        serializer = PasswordResetConfirmSerializer(
            data=request.data, context={'target_user': registro.user}
        )
        serializer.is_valid(raise_exception=True)

        try:
            password_reset_confirmar(
                registro=registro,
                raw_password=serializer.validated_data['new_password'],
                ip=client_ip(request),
            )
        except ValueError as exc:
            # Carrera: el enlace se consumió entre la comprobación y el commit.
            raise ValidationError({'token': [str(exc)]}) from exc

        return Response({
            'detail': 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.'
        })


def _email_ofuscado(email: str) -> str:
    """`daniel96correa@gmail.com` -> `da**********@gmail.com`."""
    usuario, _, dominio = email.partition('@')
    if len(usuario) <= 2:
        visible = usuario[:1]
    else:
        visible = usuario[:2]
    return f'{visible}{"*" * max(len(usuario) - len(visible), 1)}@{dominio}'


# ---------------------------------------------------------------------------
# Gestión de usuarios (solo Administrador)
# ---------------------------------------------------------------------------
class AdminUserListCreateView(generics.ListCreateAPIView):
    """Lista y crea usuarios. Reservado a administradores."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = user_list().order_by('-date_joined')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['email', 'date_joined', 'role']

    def get_queryset(self):
        qs = super().get_queryset()
        # ?activos=1 -> solo cuentas activas. La tabla de usuarios oculta los
        # inactivos por defecto y los muestra con el botón "Ver inactivos".
        if self.request.query_params.get('activos') in ('1', 'true'):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminUserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Respondemos con la vista segura (sin contraseña, con rol legible).
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Consulta y edita un usuario (rol, nombre, activo). Solo administradores."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = user_list()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return AdminUserUpdateSerializer
        return UserSerializer

    def perform_update(self, serializer):
        target = self.get_object()
        # Evita que un administrador se bloquee a sí mismo (perder acceso admin
        # o desactivar su propia cuenta) desde esta pantalla.
        if target == self.request.user:
            data = serializer.validated_data
            if data.get('role', target.role) != target.role and not target.is_superuser:
                raise ValidationError('No puedes cambiar tu propio rol.')
            if data.get('is_active', target.is_active) is False:
                raise ValidationError('No puedes desactivar tu propia cuenta.')
        serializer.save()

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        # Devuelve siempre la representación segura y completa del usuario.
        return Response(UserSerializer(self.get_object()).data)


class AdminCerrarSesionView(APIView):
    """Fuerza el cierre de la sesión de un usuario. Solo administradores.

    Existe porque la sesión única puede dejar a alguien fuera: si cierra el
    navegador sin salir, su sesión sigue contando como abierta hasta que caduca
    por inactividad. Esto lo desbloquea al instante en vez de hacerle esperar.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        objetivo = generics.get_object_or_404(user_list(), pk=pk)

        sesion = sesion_vigente(objetivo)
        if sesion is None:
            return Response({
                'detail': 'Ese usuario no tiene ninguna sesión abierta.',
                'cerrada': False,
            })

        dispositivo = sesion.descripcion_dispositivo
        sesion_cerrar(objetivo)
        # También los tokens: sin esto, su access actual seguiría sirviendo
        # hasta vencer.
        objetivo.revoke_tokens()

        logger.info(
            'Sesión de %s cerrada por %s (admin).', objetivo.email, request.user.email
        )
        return Response({
            'detail': f'Sesión cerrada ({dispositivo}). Ya puede iniciar sesión.',
            'cerrada': True,
        })
