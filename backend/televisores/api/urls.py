from django.urls import path
from rest_framework.routers import DefaultRouter

from .registros import (
    CambiosTelevisorExportView,
    CambiosTelevisorView,
    PincodesUsadosView,
    SincronizacionesView,
)
from .reportes_builder import (
    ReporteGuardadoViewSet,
    ReportesCamposView,
    ReportesConsultarView,
    ReportesExportarView,
)
from .views import TelevisorViewSet

router = DefaultRouter()
router.register(r'televisores', TelevisorViewSet, basename='televisor')
router.register(
    r'reportes/guardados', ReporteGuardadoViewSet, basename='reporte-guardado'
)

urlpatterns = [
    path('sincronizaciones/', SincronizacionesView.as_view(), name='sincronizaciones'),
    path('pincodes/', PincodesUsadosView.as_view(), name='pincodes'),
    # Historial de cambios en los DATOS del televisor (serial, MAC, crédito).
    path('cambios/', CambiosTelevisorView.as_view(), name='cambios'),
    path(
        'cambios/exportar/',
        CambiosTelevisorExportView.as_view(),
        name='cambios-exportar',
    ),
    # Constructor de reportes (solo lectura, cualquier autenticado).
    path('reportes/campos/', ReportesCamposView.as_view(), name='reportes-campos'),
    path('reportes/consultar/', ReportesConsultarView.as_view(), name='reportes-consultar'),
    path('reportes/exportar/', ReportesExportarView.as_view(), name='reportes-exportar'),
    *router.urls,
]
