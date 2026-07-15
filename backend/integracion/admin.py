from django.contrib import admin

from .models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    # La clave nunca se muestra (solo su hash existe): desde el admin se pueden
    # revocar (activa=False) o endurecer, no ver. Para crear una con su clave
    # visible se usa el endpoint de gestión (/api/integracion/api-keys/).
    list_display = ('nombre', 'prefijo', 'activa', 'expira', 'creada', 'ultimo_uso')
    list_filter = ('activa',)
    search_fields = ('nombre', 'prefijo')
    # ips_permitidas y expira SÍ se pueden editar (endurecer una clave
    # existente); el prefijo y el hash no.
    readonly_fields = ('prefijo', 'hash_clave', 'creada', 'ultimo_uso')
