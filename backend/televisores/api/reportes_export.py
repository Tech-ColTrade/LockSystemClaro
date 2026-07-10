"""Exportaciones a Excel (.xlsx) de los reportes del Dashboard.

Reutiliza el estilo de encabezado (rosa de marca) de `exports.py`. Cada función
devuelve un HttpResponse con el archivo listo para descargar.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from openpyxl import Workbook

from televisores.models import BulkSyncJob

from .exports import _estilar_encabezado, _respuesta_xlsx
from .reportes import (
    Filtros,
    acciones,
    acciones_querysets,
    pines_filtrados,
    serie_tiempo,
    televisores_filtrados,
)

User = get_user_model()

_RESULTADO_TXT = {
    'aplicada': 'Efectiva',
    'en_proceso': 'En proceso',
    'error': 'Error',
}


def _fmt(dt) -> str:
    if not dt:
        return ''
    return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M')


def _anchos(ws, medidas: dict[str, int]) -> None:
    for col, ancho in medidas.items():
        ws.column_dimensions[col].width = ancho


def _hoja(titulo: str, encabezados: list[str]):
    wb = Workbook()
    ws = wb.active
    ws.title = titulo[:31]
    ws.append(encabezados)
    _estilar_encabezado(ws)
    return wb, ws


# ---------------------------------------------------------------------------
# 1. Estatus de inhabilitación (discriminando producto financiado)
# ---------------------------------------------------------------------------
def exportar_estatus_inhabilitacion(f: Filtros | None = None):
    wb, ws = _hoja(
        'Estatus',
        ['Dirección MAC', 'Serial', 'Nº Crédito', 'Producto financiado', 'Estado'],
    )
    for tv in televisores_filtrados(f):
        financiado = 'Sí' if (tv.numero_credito or '').strip() else 'No'
        estado = 'Inhabilitado' if tv.inhabilitado else 'Habilitado'
        ws.append([tv.mac_address, tv.serial_number, tv.numero_credito, financiado, estado])
    _anchos(ws, {'A': 20, 'B': 20, 'C': 18, 'D': 18, 'E': 14})
    return _respuesta_xlsx(wb, 'estatus_inhabilitacion.xlsx')


# ---------------------------------------------------------------------------
# 2. Efectividad de la inhabilitación (enviada vs efectiva)
# ---------------------------------------------------------------------------
def exportar_efectividad(f: Filtros | None = None):
    from .reportes import _efectividad

    wb, ws = _hoja(
        'Efectividad',
        ['Acción', 'Enviadas', 'Efectivas', 'En proceso', 'Error', '% Efectividad'],
    )
    data = _efectividad(acciones(f))
    for clave, nombre in (('inhabilitacion', 'Inhabilitación'), ('habilitacion', 'Habilitación')):
        d = data[clave]
        pct = round(d['efectivas'] * 100 / d['enviadas'], 1) if d['enviadas'] else 0
        ws.append([nombre, d['enviadas'], d['efectivas'], d['en_proceso'], d['error'], pct])
    _anchos(ws, {'A': 18, 'B': 12, 'C': 12, 'D': 12, 'E': 10, 'F': 14})
    return _respuesta_xlsx(wb, 'efectividad_inhabilitacion.xlsx')


# ---------------------------------------------------------------------------
# 3. Inhabilitaciones/habilitaciones por período (día/semana/mes/año)
# ---------------------------------------------------------------------------
def exportar_serie_tiempo(periodo: str = 'mes', f: Filtros | None = None):
    if periodo not in ('dia', 'semana', 'mes', 'anio'):
        periodo = 'mes'
    etiqueta = {'dia': 'Día', 'semana': 'Semana', 'mes': 'Mes', 'anio': 'Año'}[periodo]
    wb, ws = _hoja(
        f'Tendencia por {etiqueta}',
        [etiqueta, 'Inhabilitaciones', 'Habilitaciones', 'Total'],
    )
    for row in serie_tiempo(acciones(f), periodo):
        total = row['inhabilitaciones'] + row['habilitaciones']
        ws.append([row['periodo'], row['inhabilitaciones'], row['habilitaciones'], total])
    _anchos(ws, {'A': 16, 'B': 18, 'C': 16, 'D': 12})
    return _respuesta_xlsx(wb, f'tendencia_{periodo}.xlsx')


# ---------------------------------------------------------------------------
# 4. Histórico de inhabilitación/habilitación por Serial
# ---------------------------------------------------------------------------
def exportar_historico_serial(f: Filtros | None = None):
    wb, ws = _hoja(
        'Histórico por Serial',
        ['Fecha', 'Serial', 'Dirección MAC', 'Acción', 'Resultado', 'Tipo', 'Usuario', 'IP'],
    )
    syncs, items = acciones_querysets(f)
    filas = []
    for j in syncs:
        filas.append((
            j.creado,
            j.televisor.serial_number if j.televisor else '',
            j.televisor.mac_address if j.televisor else '—',
            'Inhabilitar' if j.inhabilitar else 'Habilitar',
            {'terminado': 'Efectiva', 'error': 'Error'}.get(j.estado, 'En proceso'),
            'Individual',
            j.usuario.email if j.usuario else '',
            j.ip or '',
        ))
    for it in items:
        filas.append((
            it.job.creado,
            it.televisor.serial_number if it.televisor else '',
            it.mac_address,
            'Inhabilitar' if it.inhabilitar else 'Habilitar',
            {'ok': 'Efectiva', 'error': 'Error'}.get(it.estado, 'En proceso'),
            'Masivo',
            it.job.usuario.email if it.job.usuario else '',
            it.job.ip or '',
        ))

    filas.sort(key=lambda f: f[0], reverse=True)
    for f in filas:
        ws.append([_fmt(f[0]), f[1], f[2], f[3], f[4], f[5], f[6], f[7]])
    _anchos(ws, {'A': 18, 'B': 20, 'C': 20, 'D': 14, 'E': 12, 'F': 12, 'G': 26, 'H': 16})
    return _respuesta_xlsx(wb, 'historico_por_serial.xlsx')


# ---------------------------------------------------------------------------
# 5. Actividad por equipo (inhabilitaciones vs habilitaciones, agregado)
# ---------------------------------------------------------------------------
def exportar_actividad_equipo(f: Filtros | None = None):
    from .reportes import _actividad_por_equipo

    wb, ws = _hoja(
        'Actividad por equipo',
        ['Serial', 'Dirección MAC', 'Inhabilitaciones', 'Habilitaciones', 'Total'],
    )
    for eq in _actividad_por_equipo(acciones(f)):
        ws.append([
            eq['serial'],
            eq['mac'],
            eq['inhabilitaciones'],
            eq['habilitaciones'],
            eq['total'],
        ])
    _anchos(ws, {'A': 20, 'B': 20, 'C': 16, 'D': 16, 'E': 10})
    return _respuesta_xlsx(wb, 'actividad_por_equipo.xlsx')


# ---------------------------------------------------------------------------
# 6. Usuarios registrados en la plataforma y su estado
# ---------------------------------------------------------------------------
def exportar_usuarios():
    wb, ws = _hoja(
        'Usuarios',
        ['Correo', 'Nombres', 'Apellidos', 'Estado', 'Es staff', 'Fecha de registro'],
    )
    for u in User.objects.all():
        ws.append([
            u.email,
            u.first_name,
            u.last_name,
            'Activo' if u.is_active else 'Inactivo',
            'Sí' if u.is_staff else 'No',
            _fmt(u.date_joined),
        ])
    _anchos(ws, {'A': 30, 'B': 18, 'C': 18, 'D': 12, 'E': 10, 'F': 18})
    return _respuesta_xlsx(wb, 'usuarios.xlsx')


# ---------------------------------------------------------------------------
# 7. Registro de quién envía las acciones (con IP, fecha y hora)
# ---------------------------------------------------------------------------
def exportar_acciones_usuario(f: Filtros | None = None):
    f = f or Filtros()
    wb, ws = _hoja(
        'Acciones por Usuario',
        ['Fecha', 'Usuario', 'IP', 'Acción', 'Alcance', 'Objetivo', 'Serial', 'Resultado'],
    )
    syncs, _items = acciones_querysets(f)
    filas = []
    for j in syncs:
        filas.append((
            j.creado,
            j.usuario.email if j.usuario else '',
            j.ip or '',
            'Inhabilitar' if j.inhabilitar else 'Habilitar',
            'Individual',
            j.televisor.mac_address if j.televisor else '—',
            j.televisor.serial_number if j.televisor else '',
            {'terminado': 'Efectiva', 'error': 'Error'}.get(j.estado, 'En proceso'),
        ))
    # Un lote masivo no es de un solo equipo: solo tiene sentido incluirlo cuando
    # no se filtra por serial ni por estado. La fecha sí se respeta.
    if not f.serial and not f.estado:
        jobs = BulkSyncJob.objects.select_related('usuario').filter(modo=BulkSyncJob.SYNC)
        if f.desde:
            jobs = jobs.filter(creado__date__gte=f.desde)
        if f.hasta:
            jobs = jobs.filter(creado__date__lte=f.hasta)
        for job in jobs:
            filas.append((
                job.creado,
                job.usuario.email if job.usuario else '',
                job.ip or '',
                'Enrolar estado (masivo)',
                'Masivo',
                f'{job.total} equipos',
                '',  # un lote no tiene un serial único
                {'terminado': 'Terminado', 'error': 'Error'}.get(job.estado, 'En proceso'),
            ))
    filas.sort(key=lambda f: f[0], reverse=True)
    for f in filas:
        ws.append([_fmt(f[0]), f[1], f[2], f[3], f[4], f[5], f[6], f[7]])
    _anchos(ws, {'A': 18, 'B': 28, 'C': 16, 'D': 22, 'E': 12, 'F': 20, 'G': 20, 'H': 12})
    return _respuesta_xlsx(wb, 'acciones_por_usuario.xlsx')


# ---------------------------------------------------------------------------
# 8. Historial de acciones por equipo (masivo y unitario)
# ---------------------------------------------------------------------------
def exportar_historial_acciones(f: Filtros | None = None):
    wb, ws = _hoja(
        'Historial de Acciones',
        ['Fecha', 'Dirección MAC', 'Serial', 'Acción', 'Resultado', 'Tipo', 'Usuario', 'IP', 'Mensaje'],
    )
    syncs, items = acciones_querysets(f)
    filas = []
    for j in syncs:
        filas.append((
            j.creado,
            j.televisor.mac_address if j.televisor else '—',
            j.televisor.serial_number if j.televisor else '',
            'Inhabilitar' if j.inhabilitar else 'Habilitar',
            {'terminado': 'Efectiva', 'error': 'Error'}.get(j.estado, 'En proceso'),
            'Individual',
            j.usuario.email if j.usuario else '',
            j.ip or '',
            j.error or '',
        ))
    for it in items:
        filas.append((
            it.job.creado,
            it.mac_address,
            it.televisor.serial_number if it.televisor else '',
            'Inhabilitar' if it.inhabilitar else 'Habilitar',
            {'ok': 'Efectiva', 'error': 'Error'}.get(it.estado, 'En proceso'),
            'Masivo',
            it.job.usuario.email if it.job.usuario else '',
            it.job.ip or '',
            it.mensaje or '',
        ))
    filas.sort(key=lambda f: f[0], reverse=True)
    for f in filas:
        ws.append([_fmt(f[0]), f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8]])
    _anchos(ws, {'A': 18, 'B': 20, 'C': 20, 'D': 14, 'E': 12, 'F': 10, 'G': 26, 'H': 16, 'I': 40})
    return _respuesta_xlsx(wb, 'historial_acciones.xlsx')


# ---------------------------------------------------------------------------
# 9. Auditoría de pines entregados por usuario (en un período)
# ---------------------------------------------------------------------------
def exportar_pines_auditoria(f: Filtros | None = None):
    wb, ws = _hoja(
        'Auditoría de Pines',
        ['Fecha', 'Usuario', 'IP', 'Dirección MAC', 'Serial', 'Código de Acceso', 'Código Pin'],
    )
    qs = pines_filtrados(f).select_related('usuario', 'televisor')

    for p in qs:
        ws.append([
            _fmt(p.creado),
            p.usuario.email if p.usuario else '',
            p.ip or '',
            p.mac_address,
            p.televisor.serial_number if p.televisor else '',
            p.passcode,
            p.pin_code,
        ])
    _anchos(ws, {'A': 18, 'B': 28, 'C': 16, 'D': 20, 'E': 20, 'F': 18, 'G': 16})
    return _respuesta_xlsx(wb, 'auditoria_pines.xlsx')
