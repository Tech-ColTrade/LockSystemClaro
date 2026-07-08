"""Manager del modelo de usuario.

El manager mantiene solo lo que Django necesita para crear usuarios y
superusuarios (p. ej. `createsuperuser`). La lógica de negocio de más alto
nivel vive en la capa de servicios (`users/services.py`).
"""
from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.hashers import make_password


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio')

        # Normaliza el dominio (Django) y fuerza minúsculas en todo el correo
        # para garantizar unicidad real e insensible a mayúsculas.
        email = self.normalize_email(email).lower()

        user = self.model(email=email, **extra_fields)
        user.password = make_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('El superusuario debe tener is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('El superusuario debe tener is_superuser=True')

        return self._create_user(email, password, **extra_fields)
