"""Enrolar Estado: importar estados (habilitado/inhabilitado) masivamente.

Columnas reconocidas (encabezado, insensible a mayúsculas):
    - serial_number  (obligatoria)
    - estado         (obligatoria: habilitado/inhabilitado y sinónimos)

Fija el estado LOCAL de cada televisor y devuelve la lista de aquellos cuyo
estado cambió, para sincronizarlos con el portal.

**Solo actualiza; no crea televisores.** Un televisor necesita su MAC —es su
identificador único y de ella se deriva el EUI-64 con el que se le habla al
portal—, y por serial no hay forma de averiguarla. Los seriales que no existan
se reportan en `errores` sin frenar al resto; hay que enrolarlos antes desde
"Enrolar Televisores".
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
        if clave in _COL_ESTADO:
            mapa['estado'] = i
        elif clave in _COL_SERIAL:
            mapa['serial'] = i
    return mapa


def _parse_estado_json(valor):
    """Estado desde JSON: acepta booleano (`true`=inhabilitado) o texto/sinónimo."""
    if isinstance(valor, bool):
        return valor
    if valor is None:
        return None
    return _parse_estado(str(valor))


def procesar_enrolar_estado_serial(payload) -> dict:
    """Enrolar Estado por API (JSON), direccionado por SERIAL.

    A diferencia del Excel del panel, aquí NO se crean televisores: el integrador
    opera dispositivos que ya existen (los direcciona por su serial). Los seriales
    que no existan se reportan en `errores`, sin frenar a los demás.

    Formatos aceptados en el cuerpo (uno u otro, o ambos combinados):
        {"inhabilitar": ["S1", "S2"], "habilitar": ["S3"]}
        {"items": [{"serial_number": "S1", "inhabilitar": true}, ...]}

    Return: {'creados', 'actualizados', 'errores': [..], 'cambiados': [Televisor,..]}
    """
    vacio = {'creados': 0, 'actualizados': 0, 'errores': [], 'cambiados': []}
    if not isinstance(payload, dict):
        return {**vacio, 'errores': ['El cuerpo debe ser un objeto JSON.']}

    errores: list[str] = []
    orden: list[str] = []
    deseado: dict[str, bool] = {}
    conflicto: set[str] = set()

    def agregar(serial, estado, ctx):
        s = str(serial or '').strip()
        if not s:
            errores.append(f'{ctx}: serial vacío.')
            return
        if estado is None:
            errores.append(f'{ctx} ({s}): estado inválido (usa habilitar/inhabilitar).')
            return
        if s in deseado:
            if deseado[s] != estado and s not in conflicto:
                conflicto.add(s)
                errores.append(f'{s}: enviado como habilitar e inhabilitar a la vez; se ignora.')
            return
        orden.append(s)
        deseado[s] = estado

    # Forma agrupada: listas de seriales por acción.
    for clave, estado in (('inhabilitar', True), ('habilitar', False)):
        valor = payload.get(clave)
        if valor is None:
            continue
        if not isinstance(valor, list):
            errores.append(f'"{clave}" debe ser una lista de seriales.')
            continue
        for s in valor:
            agregar(s, estado, f'"{clave}"')

    # Forma por items: un objeto por televisor con su estado.
    items = payload.get('items')
    if items is not None:
        if not isinstance(items, list):
            errores.append('"items" debe ser una lista.')
        else:
            for i, it in enumerate(items, start=1):
                if not isinstance(it, dict):
                    errores.append(f'items[{i}]: cada elemento debe ser un objeto.')
                    continue
                serial = it.get('serial_number', it.get('serial'))
                bruto = it.get('inhabilitar', it.get('estado'))
                agregar(serial, _parse_estado_json(bruto), f'items[{i}]')

    if not orden:
        return {**vacio, 'errores': errores or ['No se enviaron seriales.']}

    # Direccionado por serial (primero gana si hubiera seriales duplicados en BD).
    existentes: dict[str, Televisor] = {}
    for tv in Televisor.objects.filter(serial_number__in=orden):
        existentes.setdefault(tv.serial_number, tv)

    cambiados: list[Televisor] = []
    actualizar: list[Televisor] = []
    for s in orden:
        if s in conflicto:
            continue
        tv = existentes.get(s)
        if tv is None:
            errores.append(f'{s}: no existe un televisor con ese serial.')
            continue
        estado = deseado[s]
        if tv.inhabilitado != estado:
            cambiados.append(tv)
        tv.inhabilitado = estado
        actualizar.append(tv)

    if actualizar:
        with transaction.atomic():
            Televisor.objects.bulk_update(actualizar, ['inhabilitado'], batch_size=500)

    return {
        'creados': 0,
        'actualizados': len(actualizar),
        'errores': errores,
        'cambiados': cambiados,
    }


def procesar_enrolar_estado(nombre: str, data: bytes) -> dict:
    """Aplica los estados del archivo y devuelve el resumen + los TV cambiados.

    Return: {'creados', 'actualizados', 'errores': [..], 'cambiados': [Televisor,..]}
    """
    filas = leer_filas(nombre, data)
    if not filas:
        return {'creados': 0, 'actualizados': 0, 'errores': ['El archivo está vacío.'], 'cambiados': []}

    mapa = _mapear_columnas(filas[0])
    faltan = [c for c in ('serial', 'estado') if c not in mapa]
    if faltan:
        nombres = {'serial': 'serial_number', 'estado': 'estado'}
        return {
            'creados': 0,
            'actualizados': 0,
            'errores': ['Faltan columnas: ' + ', '.join(nombres[c] for c in faltan)],
            'cambiados': [],
        }

    errores: list[str] = []
    orden: list[str] = []
    deseado: dict[str, bool] = {}

    def celda(fila, i):
        return fila[i].strip() if i is not None and i < len(fila) else ''

    for n, fila in enumerate(filas[1:], start=2):
        serial = celda(fila, mapa['serial'])
        if not serial:
            continue
        estado = _parse_estado(celda(fila, mapa['estado']))
        if estado is None:
            errores.append(
                f'Fila {n} ({serial}): estado inválido (usa "habilitado" o "inhabilitado").'
            )
            continue
        if serial in deseado:
            # Serial repetido en el archivo: gana la primera fila, para que el
            # resultado no dependa del orden de lectura.
            if deseado[serial] != estado:
                errores.append(
                    f'Fila {n} ({serial}): repetido con un estado distinto; se ignora.'
                )
            continue
        orden.append(serial)
        deseado[serial] = estado

    if not orden:
        return {
            'creados': 0,
            'actualizados': 0,
            'errores': errores or ['No hay filas válidas.'],
            'cambiados': [],
        }

    # Direccionado por serial. `setdefault`: si la base tuviera dos televisores
    # con el mismo serial (la columna no es única), gana el primero.
    existentes: dict[str, Televisor] = {}
    for tv in Televisor.objects.filter(serial_number__in=orden):
        existentes.setdefault(tv.serial_number, tv)

    cambiados: list[Televisor] = []
    actualizar: list[Televisor] = []

    for serial in orden:
        tv = existentes.get(serial)
        if tv is None:
            # Sin MAC no se puede crear ni sincronizar: ver la nota del módulo.
            errores.append(
                f'{serial}: no existe un televisor con ese serial. '
                'Enrólalo primero en "Enrolar Televisores".'
            )
            continue
        estado = deseado[serial]
        if tv.inhabilitado != estado:
            cambiados.append(tv)
        tv.inhabilitado = estado
        actualizar.append(tv)

    # Una escritura por lotes en vez de un save() por fila: contra una base de
    # datos remota, el round-trip por fila era el cuello de botella.
    if actualizar:
        with transaction.atomic():
            Televisor.objects.bulk_update(actualizar, ['inhabilitado'], batch_size=500)

    return {
        # Este flujo ya no crea televisores; se mantiene la clave para no
        # romper a quien lea el resumen (la interfaz muestra el contador).
        'creados': 0,
        'actualizados': len(actualizar),
        'errores': errores,
        'cambiados': cambiados,
    }
