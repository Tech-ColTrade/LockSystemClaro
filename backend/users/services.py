"""Capa de servicios: lógica de negocio de **escritura** sobre usuarios.

Reglas de esta capa:
- Toda mutación del estado pasa por aquí (no desde las vistas ni los modelos).
- Las operaciones que tocan varias filas/tablas son transaccionales.
- Devuelve entidades del dominio (instancias de modelo), no respuestas HTTP.
"""
from __future__ import annotations

from django.db import transaction

from .models import Role, User


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

    return user
