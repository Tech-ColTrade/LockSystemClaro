from django.urls import path

from .views import config, health

urlpatterns = [
    path('health/', health, name='health'),
    path('config/', config, name='config'),
]
