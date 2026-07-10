"""Enrolar Estado: importar estados (habilitado/inhabilitado) masivamente.

Columnas reconocidas (encabezado, insensible a mayúsculas):
    - mac_address    (obligatoria)
    - estado         (obligatoria: habilitado/inhabilitado y sinónimos)
    - serial_number  (opcional)

Fija el estado LOCAL de cada televisor (creándolo si no existe) y devuelve la
lista de televisores cuyo estado cambió, para sincronizarlos con el portal.
"""
from __future__ import annotations

from django.db import transaction

from .api.imports import leer_filas
from .models import Televisor

# Sinónimos aceptados en la columna 'estado'.
_INHABILITADO = {
    'inhabilitado', 'inhabilitar', 'inhabilitacion', 'inhabilitación',
    'bloqueado', 'bloqueo', 'bloquear', 'lock', 'locked', 'si', 'sí',
    'true', '1', 'x', 'yes', 'y',
}
_HABILITADO = {
    'habilitado', 'habilitar', 'habilitacion', 'habilitación',
    'desbloqueado', 'desbloqueo', 'desbloquear', 'unlock', 'unlocked',
    'no', 'false', '0', 'n',
}

_COL_MAC = {'mac_address', 'mac', 'mac_address', 'direccion_mac', 'dirección_mac'}
_COL_ESTADO = {'estado', 'status', 'lock', 'lock_status', 'inhabilitado', 'bloqueo'}
_COL_SERIAL = {'serial_number', 'serial', 'sn', 'numero_de_serie', 'número_de_serie'}


def _parse_estado(valor: str):
    """True (inhabilitado), False (habilitado) o None si no se reconoce."""
    t = (valor or '').strip().lower()
    if t in _INHABILITADO:
        return True
    if t in _HABILITADO:
        return False
    return None


def _mapear_columnas(headers: list[str]) -> dict:
    mapa = {}
    for i, h in enumerate(headers):
        clave = (h or '').strip().lower().replace(' ', '_')
        if clave in _COL_MAC:
            mapa['mac'] = i
        elif clave in _COL_ESTADO:
            mapa['estado'] = i
        elif clave in _COL_SERIAL:
            mapa['serial'] = i
    return mapa


def procesar_enrolar_estado(nombre: str, data: bytes) -> dict:
    """Aplica los estados del archivo y devuelve el resumen + los TV cambiados.

    Return: {'creados', 'actualizados', 'errores': [..], 'cambiados': [Televisor,..]}
    """
    filas = leer_filas(nombre, data)
    if not filas:
        return {'creados': 0, 'actualizados': 0, 'errores': ['El archivo está vacío.'], 'cambiados': []}

    mapa = _mapear_columnas(filas[0])
    faltan = [c for c in ('mac', 'estado') if c not in mapa]
    if faltan:
        nombres = {'mac': 'mac_address', 'estado': 'estado'}
        return {
            'creados': 0,
            'actualizados': 0,
            'errores': ['Faltan columnas: ' + ', '.join(nombres[c] for c in faltan)],
            'cambiados': [],
        }

    errores: list[str] = []
    orden: list[str] = []
    deseado: dict[str, dict] = {}

    def celda(fila, i):
        return fila[i].strip() if i is not None and i < len(fila) else ''

    for n, fila in enumerate(filas[1:], start=2):
        mac = celda(fila, mapa['mac']).upper()
        estado = _parse_estado(celda(fila, mapa['estado']))
        serial = celda(fila, mapa.get('serial'))
        if not mac:
            continue
        if estado is None:
            errores.append(f'Fila {n} ({mac}): estado inválido (usa "habilitado" o "inhabilitado").')
            continue
        if mac not in deseado:
            orden.append(mac)
        deseado[mac] = {'mac': mac, 'estado': estado, 'serial': serial or deseado.get(mac, {}).get('serial', '')}

    if not orden:
        return {'creados': 0, 'actualizados': 0, 'errores': errores or ['No hay filas válidas.'], 'cambiados': []}

    existentes = {
        tv.mac_address.upper(): tv
        for tv in Televisor.objects.filter(mac_address__in=[deseado[k]['mac'] for k in orden])
    }

    cambiados: list[Televisor] = []
    nuevos: list[Televisor] = []
    actualizar: list[Televisor] = []

    for k in orden:
        d = deseado[k]
        tv = existentes.get(k)
        if tv is None:
            tv = Televisor(mac_address=d['mac'], serial_number=d['serial'])
            nuevos.append(tv)
        else:
            if d['serial'] and tv.serial_number != d['serial']:
                tv.serial_number = d['serial']
            actualizar.append(tv)

        if tv.inhabilitado != d['estado']:
            cambiados.append(tv)
        tv.inhabilitado = d['estado']

    # bulk_create/bulk_update no llaman a save(), así que la normalización que
    # hace Televisor.save() se aplica aquí a mano.
    for tv in (*nuevos, *actualizar):
        tv.mac_address = tv.mac_address.strip().upper()
        tv.serial_number = (tv.serial_number or '').strip()

    # Dos escrituras por lotes en vez de un save() por fila: contra una base de
    # datos remota, el round-trip por fila era el cuello de botella.
    with transaction.atomic():
        if nuevos:
            Televisor.objects.bulk_create(nuevos, batch_size=500)
        if actualizar:
            Televisor.objects.bulk_update(
                actualizar, ['serial_number', 'inhabilitado'], batch_size=500
            )

    creados = len(nuevos)
    actualizados = len(actualizar)
    return {
        'creados': creados,
        'actualizados': actualizados,
        'errores': errores,
        'cambiados': cambiados,
    }
