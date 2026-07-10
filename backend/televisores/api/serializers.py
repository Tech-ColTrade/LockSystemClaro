from rest_framework import serializers

from televisores.models import (
    BulkSyncItem,
    BulkSyncJob,
    PinCodeUsado,
    SyncJob,
    Televisor,
)


class TelevisorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Televisor
        fields = [
            'id',
            'mac_address',
            'serial_number',
            'numero_credito',
            'inhabilitado',
            'eui64',
            'created_at',
        ]
        # El estado y las fechas no se editan desde el CRUD del televisor.
        read_only_fields = ['id', 'inhabilitado', 'created_at']
        extra_kwargs = {
            'eui64': {'required': False},
        }

    def validate_mac_address(self, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError('La dirección MAC es obligatoria.')
        # Unicidad (ignorando el propio registro al editar).
        qs = Televisor.objects.filter(mac_address=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un televisor con esta MAC.')
        return value


class PinCodeUsadoSerializer(serializers.ModelSerializer):
    # El serial vive en el televisor asociado (SET_NULL): si el equipo se borró
    # o el pin no quedó ligado, sale vacío.
    serial_number = serializers.SerializerMethodField()

    class Meta:
        model = PinCodeUsado
        fields = ['id', 'mac_address', 'serial_number', 'passcode', 'pin_code', 'creado']

    def get_serial_number(self, obj) -> str:
        return obj.televisor.serial_number if obj.televisor_id else ''


class SyncJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncJob
        fields = [
            'id',
            'inhabilitar',
            'estado',
            'porcentaje',
            'error',
            'creado',
            'terminado_en',
        ]


class BulkSyncItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkSyncItem
        fields = [
            'id',
            'mac_address',
            'inhabilitar',
            'estado',
            'mensaje',
            'remoto_inhabilitado',
            'local_inhabilitado',
            'coincide',
        ]


class BulkSyncJobSerializer(serializers.ModelSerializer):
    porcentaje = serializers.IntegerField(read_only=True)
    finalizado = serializers.BooleanField(read_only=True)
    items = BulkSyncItemSerializer(many=True, read_only=True)

    class Meta:
        model = BulkSyncJob
        fields = [
            'id',
            'modo',
            'estado',
            'total',
            'procesados',
            'ok_count',
            'error_count',
            'porcentaje',
            'finalizado',
            'creados',
            'actualizados',
            'errores_import',
            'items',
            'creado',
            'terminado_en',
        ]
