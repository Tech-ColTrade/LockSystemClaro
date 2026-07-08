"""Permisos DRF basados en el rol del usuario.

La política se define aquí (una sola fuente de verdad) y las vistas la aplican.
El frontend oculta/deshabilita botones, pero la autorización real vive en el
backend: aunque alguien llame la API a mano, estos permisos la protegen.
"""
from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Solo administradores (rol admin o superusuario)."""

    message = 'Se requiere rol de Administrador.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin_role)


class CanOperate(BasePermission):
    """Solo operadores o administradores (acciones de escritura/gestión)."""

    message = 'Se requiere rol de Operador o Administrador.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.can_operate)
