from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _

from .models import PasswordResetToken, SesionActiva, User


class UserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('email',)


class UserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User

    ordering = ('-date_joined',)
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser', 'groups')
    search_fields = ('email', 'first_name', 'last_name')
    readonly_fields = ('date_joined', 'updated_at', 'last_login')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Datos personales'), {'fields': ('first_name', 'last_name')}),
        (_('Rol'), {'fields': ('role',)}),
        (_('Permisos'), {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            ),
        }),
        (_('Fechas'), {'fields': ('last_login', 'date_joined', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
    )


@admin.register(SesionActiva)
class SesionActivaAdmin(admin.ModelAdmin):
    """Sesiones abiertas. Borrar una fila libera la cuenta (sesión única).

    Es la salida de emergencia si alguien queda bloqueado y no hay a mano un
    administrador que use /usuarios.
    """

    list_display = ('user', 'dispositivo', 'creada', 'ultima_actividad', 'estado', 'ip')
    search_fields = ('user__email', 'ip')
    readonly_fields = ('user', 'creada', 'ultima_actividad', 'ip', 'user_agent')
    ordering = ('-ultima_actividad',)

    @admin.display(description=_('dispositivo'))
    def dispositivo(self, obj: SesionActiva) -> str:
        return obj.descripcion_dispositivo

    @admin.display(description=_('estado'))
    def estado(self, obj: SesionActiva) -> str:
        return _('Caducada') if obj.vencida else _('Activa')

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """Solo lectura: sirve para auditar quién pidió restablecer y si lo usó.

    Los tokens no se crean ni editan a mano — se emiten desde el flujo de
    recuperación y solo se guarda su hash, así que aquí no hay nada que escribir.
    """

    list_display = ('user', 'creado', 'expira_en', 'usado_en', 'estado', 'ip_solicitud')
    list_filter = ('creado', 'usado_en')
    search_fields = ('user__email',)
    readonly_fields = (
        'user', 'token_hash', 'creado', 'expira_en', 'usado_en',
        'ip_solicitud', 'ip_uso',
    )
    ordering = ('-creado',)

    @admin.display(description=_('estado'))
    def estado(self, obj: PasswordResetToken) -> str:
        if obj.usado:
            return _('Usado')
        if obj.vencido:
            return _('Vencido')
        return _('Pendiente')

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False
