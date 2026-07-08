"""Rutas del Dashboard: resumen JSON (gráficos) + exportaciones Excel."""
from __future__ import annotations

from django.urls import path
from rest_framework.decorators import api_view

from . import reportes_export as rx
from .reportes import DashboardResumenView


@api_view(['GET'])
def export_estatus(request):
    return rx.exportar_estatus_inhabilitacion()


@api_view(['GET'])
def export_efectividad(request):
    return rx.exportar_efectividad()


@api_view(['GET'])
def export_serie_tiempo(request):
    return rx.exportar_serie_tiempo(request.query_params.get('periodo', 'mes'))


@api_view(['GET'])
def export_historico_serial(request):
    return rx.exportar_historico_serial(request.query_params.get('serial', ''))


@api_view(['GET'])
def export_usuarios(request):
    return rx.exportar_usuarios()


@api_view(['GET'])
def export_acciones_usuario(request):
    return rx.exportar_acciones_usuario()


@api_view(['GET'])
def export_historial_acciones(request):
    return rx.exportar_historial_acciones()


@api_view(['GET'])
def export_pines_auditoria(request):
    return rx.exportar_pines_auditoria(
        request.query_params.get('desde', ''),
        request.query_params.get('hasta', ''),
    )


urlpatterns = [
    path('dashboard/resumen/', DashboardResumenView.as_view(), name='dashboard-resumen'),
    path('dashboard/export/estatus/', export_estatus),
    path('dashboard/export/efectividad/', export_efectividad),
    path('dashboard/export/tendencia/', export_serie_tiempo),
    path('dashboard/export/historico-serial/', export_historico_serial),
    path('dashboard/export/usuarios/', export_usuarios),
    path('dashboard/export/acciones-usuario/', export_acciones_usuario),
    path('dashboard/export/historial-acciones/', export_historial_acciones),
    path('dashboard/export/pines-auditoria/', export_pines_auditoria),
]
