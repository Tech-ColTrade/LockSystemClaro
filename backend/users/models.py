"""Modelo de usuario del proyecto.

Decisiones clave (best practices para aplicaciones de larga vida):
- Identificador de login = **email** (no `username`).
- **UUID** como clave primaria (no enumerable, apto para sistemas distribuidos).
- `AbstractBaseUser + PermissionsMixin`: control total del esquema conservando
  el sistema de permisos/grupos de Django.
"""
from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


class Role(models.TextChoices):
    """Roles del sistema (perfiles de acceso).

    - ADMIN: todas las funcionalidades + gestión de usuarios y parametrizaciones.
    - OPERADOR: gestiones (habilitar/inhabilitar/enrolar/desenrolar), pines y reportes.
    - CONSULTA: solo lectura — validar estado del dispositivo y consultar pines.
    """

    ADMIN = 'admin', _('Administrador')
    OPERADOR = 'operador', _('Operador')
    CONSULTA = 'consulta', _('Consulta')


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    email = models.EmailField(_('correo electrónico'), unique=True)
    first_name = models.CharField(_('nombres'), max_length=150, blank=True)
    last_name = models.CharField(_('apellidos'), max_length=150, blank=True)

    role = models.CharField(
        _('rol'),
        max_length=20,
        choices=Role.choices,
        default=Role.CONSULTA,
        help_text=_('Perfil de acceso: define qué módulos y acciones puede usar.'),
    )

    is_active = models.BooleanField(
        _('activo'),
        default=True,
        help_text=_('Desmarcar en lugar de borrar la cuenta.'),
    )
    is_staff = models.BooleanField(
        _('acceso al admin'),
        default=False,
        help_text=_('Permite el acceso al sitio de administración.'),
    )

    date_joined = models.DateTimeField(_('fecha de registro'), default=timezone.now)
    updated_at = models.DateTimeField(_('última actualización'), auto_now=True)

    # Preferencia de interfaz: color de acento elegido por el usuario. Se guarda
    # aquí (no solo en el navegador) para que la app arranque siempre con su
    # último color en cualquier dispositivo. El catálogo de acentos vive en el
    # front; aquí solo persistimos la clave elegida (p. ej. 'neutro', 'rosa').
    accent = models.CharField(
        _('color de acento'),
        max_length=20,
        default='neutro',
        blank=True,
        help_text=_('Preferencia de color de acento de la interfaz.'),
    )

    # Revocación server-side de tokens (logout real): los JWT llevan la versión
    # con la que se emitieron (claim `tv`). Al cerrar sesión se incrementa este
    # contador y todos los tokens anteriores dejan de validar. Es exacto (sin la
    # ambigüedad de segundos que tendría comparar por fecha de emisión).
    token_version = models.PositiveIntegerField(_('versión de token'), default=0)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: list[str] = []  # email y password ya son obligatorios

    class Meta:
        verbose_name = _('usuario')
        verbose_name_plural = _('usuarios')
        ordering = ['-date_joined']

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        # Mantiene el email siempre normalizado, incluso fuera del manager.
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Roles / permisos de negocio
    # ------------------------------------------------------------------
    @property
    def is_admin_role(self) -> bool:
        """Administrador: superusuarios y usuarios con rol admin."""
        return self.is_superuser or self.role == Role.ADMIN

    @property
    def can_operate(self) -> bool:
        """Puede realizar gestiones de escritura (operador o administrador)."""
        return self.is_admin_role or self.role == Role.OPERADOR

    def revoke_tokens(self) -> None:
        """Invalida todos los tokens (access + refresh) emitidos hasta ahora.

        Se usa en el logout (cierre de sesión real): incrementa la versión, así
        que los tokens previos (que llevan la versión anterior) dejan de validar.
        """
        self.token_version = models.F('token_version') + 1
        self.save(update_fields=['token_version', 'updated_at'])
        self.refresh_from_db(fields=['token_version'])

    @property
    def full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    def get_full_name(self) -> str:
        return self.full_name or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email
