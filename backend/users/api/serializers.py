"""Serializers de la app `users`.

Principios de seguridad aplicados:
- `password` es *write-only*: nunca se serializa de vuelta.
- Solo se exponen/aceptan campos seguros. `is_staff`, `is_superuser`, `groups`
  y `user_permissions` NO son asignables desde la API (anti mass-assignment /
  escalado de privilegios).
- La fortaleza de la contraseña se valida con las reglas de Django.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from users.models import Role
from users.services import user_create, user_update

User = get_user_model()


class MeUpdateSerializer(serializers.ModelSerializer):
    """Edición del propio perfil: datos personales y preferencias (sin rol/permisos)."""

    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'accent')

    def update(self, instance: User, validated_data: dict) -> User:
        return user_update(user=instance, data=validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """Cambio de la propia contraseña: exige la actual y valida la nueva."""

    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128,
    )

    def validate_current_password(self, value: str) -> str:
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value

    def validate_new_password(self, value: str) -> str:
        user = self.context['request'].user
        validate_password(value, user=user)
        return value


class UserSerializer(serializers.ModelSerializer):
    """Representación pública/segura de un usuario (solo lectura)."""

    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'role_display',
            'is_active',
            'date_joined',
            'accent',
        )
        read_only_fields = fields


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Alta de usuario por un administrador (asigna rol)."""

    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        trim_whitespace=False,
        max_length=128,
    )
    role = serializers.ChoiceField(choices=Role.choices, default=Role.CONSULTA)

    class Meta:
        model = User
        fields = ('id', 'email', 'password', 'first_name', 'last_name', 'role')
        read_only_fields = ('id',)
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Ya existe una cuenta con este correo.')
        return value

    def validate(self, attrs: dict) -> dict:
        temp_user = User(
            email=attrs.get('email', ''),
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', ''),
        )
        validate_password(attrs['password'], user=temp_user)
        return attrs

    def create(self, validated_data: dict) -> User:
        return user_create(**validated_data)


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Edición de usuario por un administrador (nombre, rol, activo)."""

    role = serializers.ChoiceField(choices=Role.choices, required=False)

    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'role', 'is_active')

    def update(self, instance: User, validated_data: dict) -> User:
        return user_update(user=instance, data=validated_data)
