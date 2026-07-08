"""Resúmenes agregados para el Dashboard (JSON para los gráficos del front).

Un único endpoint (`GET /api/dashboard/resumen/`) devuelve todo lo que necesitan
los gráficos de la pantalla, más una serie temporal parametrizable por período.
Los reportes a nivel de registro (histórico por serial, acciones por usuario,
auditoría de pines) se descargan como Excel desde `reportes_export.py`.
"""
from __future__ import annotations

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from televisores.models import BulkSyncItem, BulkSyncJob, PinCodeUsado, SyncJob, Televisor

User = get_user_model()


def _resultado_syncjob(estado: str) -> str:
    if estado == SyncJob.TERMINADO:
        return 'aplicada'
    if estado == SyncJob.ERROR:
        return 'error'
    return 'en_proceso'


def _resultado_item(estado: str) -> str:
    if estado == BulkSyncItem.OK:
        return 'aplicada'
    if estado == BulkSyncItem.ERROR:
        return 'error'
    return 'en_proceso'


def acciones() -> list[dict]:
    """Todas las acciones de cambio de estado (individuales + masivas) como
    dicts homogéneos: {fecha, inhabilitar, resultado, mac, serial}."""
    filas: list[dict] = []
    for j in SyncJob.objects.select_related('televisor'):
        filas.append({
            'fecha': j.creado,
            'inhabilitar': j.inhabilitar,
            'resultado': _resultado_syncjob(j.estado),
            'mac': j.televisor.mac_address if j.televisor else '—',
            'serial': j.televisor.serial_number if j.televisor else '',
        })
    items = BulkSyncItem.objects.select_related('televisor').filter(
        job__modo=BulkSyncJob.SYNC
    ).select_related('job')
    for it in items:
        filas.append({
            'fecha': it.job.creado,
            'inhabilitar': it.inhabilitar,
            'resultado': _resultado_item(it.estado),
            'mac': it.mac_address,
            'serial': it.televisor.serial_number if it.televisor else '',
        })
    return filas


def _estatus_inhabilitacion() -> dict:
    """Estatus de inhabilitación discriminando producto financiado
    (financiado = tiene número de crédito)."""
    resultado = {
        'inhabilitado': {'financiado': 0, 'no_financiado': 0},
        'habilitado': {'financiado': 0, 'no_financiado': 0},
    }
    for tv in Televisor.objects.all().only('inhabilitado', 'numero_credito'):
        estado = 'inhabilitado' if tv.inhabilitado else 'habilitado'
        clave = 'financiado' if (tv.numero_credito or '').strip() else 'no_financiado'
        resultado[estado][clave] += 1
    return resultado


def _efectividad(filas: list[dict]) -> dict:
    """Acción enviada vs efectiva, por tipo de acción."""
    base = {'enviadas': 0, 'efectivas': 0, 'en_proceso': 0, 'error': 0}
    res = {'inhabilitacion': dict(base), 'habilitacion': dict(base)}
    for f in filas:
        clave = 'inhabilitacion' if f['inhabilitar'] else 'habilitacion'
        res[clave]['enviadas'] += 1
        if f['resultado'] == 'aplicada':
            res[clave]['efectivas'] += 1
        elif f['resultado'] == 'en_proceso':
            res[clave]['en_proceso'] += 1
        else:
            res[clave]['error'] += 1
    return res


def _clave_periodo(fecha, periodo: str) -> str:
    f = timezone.localtime(fecha)
    if periodo == 'dia':
        return f.strftime('%Y-%m-%d')
    if periodo == 'semana':
        return f.strftime('%G-S%V')  # año ISO + semana ISO
    if periodo == 'anio':
        return f.strftime('%Y')
    return f.strftime('%Y-%m')  # mes (por defecto)


def serie_tiempo(filas: list[dict], periodo: str) -> list[dict]:
    """Inhabilitaciones vs habilitaciones agrupadas por período."""
    buckets: dict[str, dict] = defaultdict(
        lambda: {'inhabilitaciones': 0, 'habilitaciones': 0}
    )
    for f in filas:
        clave = _clave_periodo(f['fecha'], periodo)
        if f['inhabilitar']:
            buckets[clave]['inhabilitaciones'] += 1
        else:
            buckets[clave]['habilitaciones'] += 1
    return [
        {'periodo': k, **buckets[k]} for k in sorted(buckets)
    ]


def _actividad_por_equipo(filas: list[dict]) -> list[dict]:
    """Dispersión: nº de inhabilitaciones vs habilitaciones por serial/MAC."""
    por_equipo: dict[str, dict] = {}
    for f in filas:
        clave = f['serial'] or f['mac']
        d = por_equipo.setdefault(
            clave,
            {'serial': f['serial'], 'mac': f['mac'],
             'inhabilitaciones': 0, 'habilitaciones': 0},
        )
        if f['inhabilitar']:
            d['inhabilitaciones'] += 1
        else:
            d['habilitaciones'] += 1
    for d in por_equipo.values():
        d['total'] = d['inhabilitaciones'] + d['habilitaciones']
    return sorted(por_equipo.values(), key=lambda d: d['total'], reverse=True)


def _usuarios() -> dict:
    total = User.objects.count()
    activos = User.objects.filter(is_active=True).count()
    staff = User.objects.filter(is_staff=True).count()
    return {
        'total': total,
        'activos': activos,
        'inactivos': total - activos,
        'staff': staff,
    }


class DashboardResumenView(APIView):
    """Todos los agregados que consumen los gráficos del dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = request.query_params.get('periodo', 'mes')
        if periodo not in ('dia', 'semana', 'mes', 'anio'):
            periodo = 'mes'

        filas = acciones()
        estatus = _estatus_inhabilitacion()
        total_tv = Televisor.objects.count()
        inhabilitados = Televisor.objects.filter(inhabilitado=True).count()
        financiados = (
            estatus['inhabilitado']['financiado']
            + estatus['habilitado']['financiado']
        )

        return Response({
            'kpis': {
                'televisores': total_tv,
                'inhabilitados': inhabilitados,
                'habilitados': total_tv - inhabilitados,
                'financiados': financiados,
                'pines_entregados': PinCodeUsado.objects.count(),
            },
            'estatus_inhabilitacion': estatus,
            'efectividad': _efectividad(filas),
            'serie_tiempo': {
                'periodo': periodo,
                'datos': serie_tiempo(filas, periodo),
            },
            'actividad_por_equipo': _actividad_por_equipo(filas),
            'usuarios': _usuarios(),
        })
