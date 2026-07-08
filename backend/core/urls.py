"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    # API de dominio
    path('api/', include('api.urls')),
    path('api/', include('televisores.api.urls')),
    path('api/', include('televisores.api.dashboard_urls')),

    # Usuarios y autenticación (register, token, refresh, verify, me)
    path('api/', include('users.api.urls')),
]
