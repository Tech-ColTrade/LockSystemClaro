from rest_framework import serializers

from integracion.models import ApiKey


class ApiKeySerializer(serializers.ModelSerializer):
    """API-key SIN el secreto: es lo que se lista. La clave en claro solo se ve
    una vez, en la respuesta de creación (ver ApiKeyCreadaSerializer)."""

    class Meta:
        model = ApiKey
        fields = [
            'id', 'nombre', 'prefijo', 'activa',
            'ips_permitidas', 'expira',
            'creada', 'ultimo_uso',
        ]
        read_only_fields = fields


class ApiKeyCreadaSerializer(serializers.Serializer):
    """Respuesta de creación: incluye la clave en claro UNA sola vez."""

    id = serializers.UUIDField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    prefijo = serializers.CharField(read_only=True)
    clave = serializers.CharField(read_only=True)
