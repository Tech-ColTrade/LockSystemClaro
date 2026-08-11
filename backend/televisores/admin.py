from django.contrib import admin

from .models import (
    BulkSyncItem,
    BulkSyncJob,
    CambioTelevisor,
    PinCodeUsado,
    SyncJob,
    Televisor,
)


@admin.register(Televisor)
class TelevisorAdmin(admin.ModelAdmin):
    list_display = ('mac_address', 'serial_number', 'numero_credito', 'inhabilitado', 'created_at')
    list_filter = ('inhabilitado',)
    search_fields = ('mac_address', 'serial_number', 'numero_credito')


@admin.register(SyncJob)
class SyncJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'televisor', 'inhabilitar', 'estado', 'porcentaje', 'creado')
    list_filter = ('estado', 'inhabilitar')
    readonly_fields = ('creado', 'actualizado', 'terminado_en')


@admin.register(PinCodeUsado)
class PinCodeUsadoAdmin(admin.ModelAdmin):
    list_display = ('mac_address', 'passcode', 'pin_code', 'creado')
    search_fields = ('mac_address', 'passcode', 'pin_code')


@admin.register(CambioTelevisor)
class CambioTelevisorAdmin(admin.ModelAdmin):
    """Historial de cambios: solo lectura, lo escribe el sistema.

    Permitir editarlo desde aquí destruiría su valor como auditoría.
    """

    list_display = (
        'creado', 'serial_number', 'mac_address', 'campo',
        'valor_anterior', 'valor_nuevo', 'origen', 'usuario',
    )
    list_filter = ('campo', 'origen', 'creado')
    search_fields = ('serial_number', 'mac_address', 'numero_credito')
    readonly_fields = tuple(f.name for f in CambioTelevisor._meta.fields)
    ordering = ('-creado',)

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


class BulkSyncItemInline(admin.TabularInline):
    model = BulkSyncItem
    extra = 0


@admin.register(BulkSyncJob)
class BulkSyncJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'estado', 'procesados', 'total', 'ok_count', 'error_count', 'creado')
    list_filter = ('estado',)
    readonly_fields = ('creado', 'actualizado', 'terminado_en')
    inlines = [BulkSyncItemInline]
