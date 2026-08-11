"""Capa de servicios: lógica de negocio de **escritura** sobre usuarios.

Reglas de esta capa:
- Toda mutación del estado pasa por aquí (no desde las vistas ni los modelos).
- Las operaciones que tocan varias filas/tablas son transaccionales.
- Devuelve entidades del dominio (instancias de modelo), no respuestas HTTP.
"""
from __future__ import annotations

import logging

from django.db import transaction

from .emails import enviar_recuperacion_password
from .models import PasswordResetToken, Role, SesionActiva, User

logger = logging.getLogger(__name__)


@transaction.atomic
def user_create(
    *,
    email: str,
    password: str | None = None,
    first_name: str = '',
    last_name: str = '',
    role: str = Role.CONSULTA,
    is_active: bool = True,
    is_staff: bool = False,
) -> User:
    """Crea un usuario estándar aplicando las validaciones del modelo."""
    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=is_active,
        is_staff=is_staff,
    )
    user.full_clean(exclude=['password'])
    user.set_password(password)
    user.save()
    return user


@transaction.atomic
def user_set_password(*, user: User, raw_password: str) -> User:
    """Fija una nueva contraseña (ya validada por el serializer)."""
    user.set_password(raw_password)
    user.save(update_fields=['password', 'updated_at'])
    return user


@transaction.atomic
def user_update(*, user: User, data: dict) -> User:
    """Actualiza campos permitidos de un usuario existente."""
    updatable_fields = {'first_name', 'last_name', 'role', 'is_active', 'accent'}
    changed = []

    for field, value in data.items():
        if field in updatable_fields and getattr(user, field) != value:
            setattr(user, field, value)
            changed.append(field)

    if changed:
        user.full_clean(exclude=['password'])
        user.save(update_fields=[*changed, 'updated_at'])

    # Desactivar una cuenta debe echar fuera a quien la esté usando ahora mismo,
    # no solo impedir el próximo inicio de sesión.
    if 'is_active' in changed and not user.is_active:
        user.revoke_tokens()
        sesion_cerrar(user)

    return user


# ---------------------------------------------------------------------------
# Sesión única por usuario
# ---------------------------------------------------------------------------
class SesionEnUso(Exception):
    """Ya hay una sesión abierta para esa cuenta en otro navegador/equipo."""

    def __init__(self, sesion: SesionActiva) -> None:
        self.sesion = sesion
        super().__init__('Ya hay una sesión activa para esta cuenta.')


def sesion_vigente(user: User) -> SesionActiva | None:
    """Sesión abierta del usuario, o None si no tiene o si ya caducó.

    Limpia de paso las caducadas: así una sesión que quedó colgada (el usuario
    cerró el navegador sin salir) deja de bloquear la cuenta en cuanto pasa la
    ventana de inactividad, sin necesitar una tarea programada.
    """
    sesion = SesionActiva.objects.filter(user=user).first()
    if sesion is None:
        return None
    if sesion.vencida:
        sesion.delete()
        return None
    return sesion


@transaction.atomic
def sesion_abrir(
    *, user: User, ip: str | None = None, user_agent: str = ''
) -> SesionActiva:
    """Abre la sesión del usuario. Falla si ya tiene una vigente.

    `select_for_update` sobre el usuario serializa dos logins simultáneos: sin
    él, ambos podrían comprobar "no hay sesión" a la vez y el segundo se
    estrellaría contra la restricción de unicidad con un error feo.
    """
    User.objects.select_for_update().filter(pk=user.pk).first()

    existente = sesion_vigente(user)
    if existente is not None:
        raise SesionEnUso(existente)

    return SesionActiva.objects.create(
        user=user, ip=ip, user_agent=(user_agent or '')[:500]
    )


def sesion_latir(*, user: User, sid: str | None) -> bool:
    """Marca actividad en la sesión. False si `sid` no es la sesión vigente.

    Devolver False significa que el token viene de una sesión que ya fue
    cerrada o reemplazada: quien lo presente debe volver al login.
    """
    if not sid:
        return False
    sesion = sesion_vigente(user)
    if sesion is None or str(sesion.id) != str(sid):
        return False
    # `auto_now` en ultima_actividad: guardar el campo basta para refrescarlo.
    sesion.save(update_fields=['ultima_actividad'])
    return True


def sesion_cerrar(user: User) -> None:
    """Cierra la sesión del usuario (logout, o cierre forzado por un admin)."""
    SesionActiva.objects.filter(user=user).delete()


# ---------------------------------------------------------------------------
# Recuperación de contraseña (enlace de un solo uso enviado por correo)
# ---------------------------------------------------------------------------
def password_reset_solicitar(*, email: str, ip: str | None = None) -> None:
    """Emite un enlace de recuperación y lo envía por correo.

    **No revela si la cuenta existe.** Si el correo no corresponde a ninguna
    cuenta activa la función no hace nada y la vista responde igual que en el
    caso normal: de lo contrario el formulario sería un oráculo para averiguar
    qué correos están registrados.
    """
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user is None:
        logger.info('Recuperación solicitada para un correo sin cuenta activa.')
        return

    # El envío queda FUERA de la transacción del token: si el correo falla, no
    # queremos dejar en la base un token emitido que nadie recibió.
    with transaction.atomic():
        _, token = PasswordResetToken.emitir(user=user, ip=ip)

    enviar_recuperacion_password(user=user, token=token)


def password_reset_buscar(token: str) -> PasswordResetToken | None:
    """Localiza un token por su valor en claro. None si no existe."""
    if not token:
        return None
    return (
        PasswordResetToken.objects
        .select_related('user')
        .filter(token_hash=PasswordResetToken.hash_de(token))
        .first()
    )


@transaction.atomic
def password_reset_confirmar(
    *, registro: PasswordResetToken, raw_password: str, ip: str | None = None
) -> User:
    """Aplica la nueva contraseña y consume el enlace.

    Se bloquea la fila del token durante la transacción: sin eso, dos peticiones
    simultáneas con el mismo enlace podrían pasar ambas la comprobación de "no
    usado" y gastarlo dos veces.
    """
    registro = (
        PasswordResetToken.objects
        .select_for_update()
        .select_related('user')
        .get(pk=registro.pk)
    )
    if not registro.es_valido:
        raise ValueError('El enlace ya no es válido.')

    user = registro.user
    user_set_password(user=user, raw_password=raw_password)
    registro.marcar_usado(ip=ip)

    # Cierra cualquier sesión abierta: si la cuenta estaba comprometida, el
    # atacante queda fuera en el mismo momento del restablecimiento. Además
    # libera la sesión única, para poder entrar con la contraseña nueva.
    user.revoke_tokens()
    sesion_cerrar(user)
    return user
