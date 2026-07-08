"""Listados paginados para las secciones del sidebar:
Sincronizaciones y Pincodes usados (10 registros por página)."""
from __future__ import annotations

from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView

from televisores.models import BulkSyncItem, BulkSyncJob, PinCodeUsado, SyncJob

from .serializers import PinCodeUsadoSerializer


def _resultado_syncjob(estado: str) -> str:
    return {'terminado': 'Aplicado', 'error': 'Error'}.get(estado, 'En proceso')


def _resultado_item(estado: str) -> str:
    return {'ok': 'Aplicado', 'error': 'Error'}.get(estado, 'Pendiente')


def construir_sincronizaciones(televisor=None) -> list[dict]:
    """Lista (dicts) de sincronizaciones individuales + masivas, ordenada por
    fecha desc. Si `televisor` se pasa, filtra solo las de ese TV."""
    syncs = SyncJob.objects.select_related('televisor')
    items = BulkSyncItem.objects.select_related('job').filter(job__modo=BulkSyncJob.SYNC)
    if televisor is not None:
        syncs = syncs.filter(televisor=televisor)
        items = items.filter(televisor=televisor)

    filas = []
    for j in syncs:
        filas.append({
            'fecha': j.creado,
            'mac_address': j.televisor.mac_address if j.televisor else '—',
            'accion': 'Inhabilitar' if j.inhabilitar else 'Habilitar',
            'resultado': _resultado_syncjob(j.estado),
            'tipo': 'Individual',
        })
    for it in items:
        filas.append({
            'fecha': it.job.creado,
            'mac_address': it.mac_address,
            'accion': 'Inhabilitar' if it.inhabilitar else 'Habilitar',
            'resultado': _resultado_item(it.estado),
            'tipo': 'Masivo',
        })

    filas.sort(key=lambda f: f['fecha'], reverse=True)
    for f in filas:
        f['fecha'] = f['fecha'].isoformat()
    return filas


class SincronizacionesView(APIView):
    """Historial de sincronizaciones al portal (individuales + masivas)."""

    def get(self, request):
        filas = construir_sincronizaciones()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(filas, request, view=self)
        return paginator.get_paginated_response(page)


class PincodesUsadosView(ListAPIView):
    """Bitácora de los Códigos Pin/Acceso que se han usado a través de la app."""

    serializer_class = PinCodeUsadoSerializer
    queryset = PinCodeUsado.objects.all()
    search_fields = ['mac_address', 'passcode', 'pin_code']
