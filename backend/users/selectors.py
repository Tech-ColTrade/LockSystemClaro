"""Capa de selectores: lógica de **lectura** sobre usuarios.

Centralizar aquí las consultas evita duplicar querysets por las vistas y
permite optimizarlas (índices, select_related, filtros de permisos) en un
único lugar a medida que la aplicación crece.
"""
from __future__ import annotations

from uuid import UUID

from django.db.models import QuerySet

from .models import User


def user_list() -> QuerySet[User]:
    return User.objects.all()


def user_get(*, user_id: UUID | str) -> User | None:
    return User.objects.filter(id=user_id).first()


def user_get_by_email(*, email: str) -> User | None:
    return User.objects.filter(email__iexact=email).first()
