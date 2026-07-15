"""Rutas de la API de integración (por serial + API-key). Se montan bajo
`/api/integracion/` (ver core/urls.py), separadas del panel."""
from rest_framework.routers import DefaultRouter

from .integracion import IntegracionTelevisorViewSet

router = DefaultRouter()
router.register(
    r'televisores', IntegracionTelevisorViewSet, basename='integracion-televisor'
)

urlpatterns = router.urls
