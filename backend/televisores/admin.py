from django.contrib import admin

from .models import BulkSyncItem, BulkSyncJob, PinCodeUsado, SyncJob, Televisor


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


class BulkSyncItemInline(admin.TabularInline):
    model = BulkSyncItem
    extra = 0


@admin.register(BulkSyncJob)
class BulkSyncJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'estado', 'procesados', 'total', 'ok_count', 'error_count', 'creado')
    list_filter = ('estado',)
    readonly_fields = ('creado', 'actualizado', 'terminado_en')
    inlines = [BulkSyncItemInline]
