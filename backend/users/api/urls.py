from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView

from .views import (
    AdminCerrarSesionView,
    AdminUserDetailView,
    AdminUserListCreateView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
    RefreshView,
)

app_name = 'users'

urlpatterns = [
    # Autenticación.
    # NOTA: el auto-registro público está deshabilitado a propósito (era un
    # vector: cualquiera podía crear una cuenta con acceso de lectura a
    # dispositivos y PINs). Las cuentas las crea un Administrador en /usuarios.
    path('auth/token/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', RefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/password/', ChangePasswordView.as_view(), name='change_password'),

    # Recuperación de contraseña olvidada (públicas: quien las usa no puede
    # iniciar sesión). El enlace llega por correo, dura 10 minutos y es de un
    # solo uso — ver users/models.py, PasswordResetToken.
    path(
        'auth/password/reset/',
        PasswordResetRequestView.as_view(),
        name='password_reset',
    ),
    path(
        'auth/password/reset/validar/',
        PasswordResetValidateView.as_view(),
        name='password_reset_validate',
    ),
    path(
        'auth/password/reset/confirmar/',
        PasswordResetConfirmView.as_view(),
        name='password_reset_confirm',
    ),

    # Perfil
    path('me/', MeView.as_view(), name='me'),

    # Gestión de usuarios (solo Administrador)
    path('usuarios/', AdminUserListCreateView.as_view(), name='usuarios'),
    path('usuarios/<uuid:pk>/', AdminUserDetailView.as_view(), name='usuario-detalle'),
    # Desbloquea a quien dejó su sesión abierta (sesión única): ver LoginView.
    path(
        'usuarios/<uuid:pk>/cerrar-sesion/',
        AdminCerrarSesionView.as_view(),
        name='usuario-cerrar-sesion',
    ),
]
