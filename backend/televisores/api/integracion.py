"""API de integración (máquina-a-máquina), direccionada por SERIAL.

Es el mismo TelevisorViewSet del panel, pero:
  - se accede por `serial_number` en la URL, no por la PK de la base (los
    integradores nos compran por serial y no conocen nuestros ids);
  - se autentica con API-key (no con JWT de usuario).

No se reimplementa nada: se hereda toda la lógica (estados, pines, validación,
exportes…). El "usuario" de la API-key es sintético (ver
integracion/authentication.py); por eso las acciones que auditan quién actuó
guardan usuario vacío + IP (ver `usuario_para_auditoria` en views.py).
"""
from __future__ import annotations

from rest_framework import serializers

from integracion.authentication import ApiKeyAuthentication, ApiKeyRateThrottle
from televisores.models import Televisor

from .serializers import TelevisorSerializer
from .views import TelevisorViewSet


class IntegracionTelevisorSerializer(TelevisorSerializer):
    """Como el del panel, pero el serial es OBLIGATORIO y único: es la columna
    por la que el integrador direcciona cada televisor."""

    serial_number = serializers.CharField(required=True, allow_blank=False)

    def validate_serial_number(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El serial es obligatorio.')
        qs = Televisor.objects.filter(serial_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un televisor con este serial.')
        return value


class IntegracionTelevisorViewSet(TelevisorViewSet):
    # Solo API-key: esta superficie no acepta el JWT del panel.
    authentication_classes = [ApiKeyAuthentication]
    throttle_classes = [ApiKeyRateThrottle]
    serializer_class = IntegracionTelevisorSerializer

    # Se busca por serial. `lookup_url_kwarg='pk'` mantiene el nombre del
    # parámetro que ya usan todas las @action heredadas (que reciben `pk`), así
    # que solo cambia POR QUÉ columna se resuelve, no el resto del código.
    lookup_field = 'serial_number'
    lookup_url_kwarg = 'pk'
    # El serial puede traer letras, dígitos y guiones; se admite cualquier cosa
    # menos la barra (que separa segmentos de la URL).
    lookup_value_regex = '[^/]+'
