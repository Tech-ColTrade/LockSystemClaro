from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _

from .models import User


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
