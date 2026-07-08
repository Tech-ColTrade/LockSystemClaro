"""Vistas HTTP de la app `users` (capa delgada: HTTP ↔ dominio)."""
from __future__ import annotations

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

from users.authentication import TOKEN_VERSION_CLAIM, token_esta_revocado
from users.permissions import IsAdminRole
from users.selectors import user_list
from users.services import user_set_password

from .serializers import (
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    MeUpdateSerializer,
    UserSerializer,
)

User = get_user_model()

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


class LoginView(TokenObtainPairView):
    """Obtiene el par de tokens (access/refresh) con email + password."""

    serializer_class = VersionedTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class RevocationAwareTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh que respeta la revocación server-side (logout real).

    Rechaza un refresh emitido antes del corte del usuario, o de una cuenta
    inactiva/eliminada, antes de emitir un nuevo par de tokens.
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
    suyos localmente.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        request.user.revoke_tokens()
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
        # Re-emite para el cliente actual con la nueva versión de token.
        refresh = VersionedTokenObtainPairSerializer.get_token(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


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
