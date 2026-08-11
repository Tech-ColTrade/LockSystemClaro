from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """Endpoint simple para verificar que la API está viva."""
    return Response({'status': 'ok', 'proyecto': 'core'})


@api_view(['GET'])
@permission_classes([AllowAny])
def config(request):
    """Parámetros de configuración que el frontend necesita conocer.

    Se sirven desde aquí, y no como variables de compilación del frontend, para
    que cambiar la ventana de inactividad sea reiniciar el backend y no
    recompilar y redesplegar el sitio estático.

    Público a propósito: no expone nada sensible, solo dos duraciones, y el
    login necesita leerlo antes de que exista sesión.
    """
    return Response({
        # Minutos de inactividad tras los que se cierra la sesión.
        'session_inactivity_minutes': settings.SESSION_INACTIVITY_MINUTOS,
        # Minutos de vida del enlace de recuperación de contraseña.
        'password_reset_minutes': settings.PASSWORD_RESET_MINUTOS,
    })
