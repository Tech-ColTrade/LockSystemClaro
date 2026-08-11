"""Filtros compartidos entre los listados y sus exportaciones a Excel.

Que la vista y el export usen la misma función es lo que garantiza que el Excel
contenga exactamente las filas que el usuario está viendo en pantalla.
"""
from __future__ import annotations

from datetime import date


def parsear_fecha(valor: str | None) -> date | None:
    """'YYYY-MM-DD' -> date. Devuelve None si falta o no es válida."""
    if not valor:
        return None
    try:
        return date.fromisoformat(valor.strip())
    except ValueError:
        return None


def filtrar_por_fecha(queryset, desde: str | None, hasta: str | None, campo: str = 'creado'):
    """Acota un queryset a un rango de fechas inclusivo (ambos extremos).

    Se compara con `__date` y no con el datetime crudo para que 'hasta' incluya
    el día entero: con `creado__lte=2026-07-10` se perdería todo lo registrado
    después de la medianoche de ese día. La conversión usa TIME_ZONE
    (America/Bogota), que es la fecha que el usuario ve en la tabla.
    """
    d = parsear_fecha(desde)
    h = parsear_fecha(hasta)
    if d:
        queryset = queryset.filter(**{f'{campo}__date__gte': d})
    if h:
        queryset = queryset.filter(**{f'{campo}__date__lte': h})
    return queryset


def filtrar_cambios(queryset, desde=None, hasta=None, buscar=None, campo=None):
    """Filtros del historial de cambios: rango de fechas, texto y campo.

    `buscar` mira en serial, MAC y número de crédito a la vez, que es como el
    usuario piensa el dato que tiene a mano ("busco este equipo") sin tener que
    acertar en qué casilla va cada cosa. Es el mismo criterio del buscador del
    listado de televisores.
    """
    queryset = filtrar_por_fecha(queryset, desde, hasta, campo='creado')

    texto = (buscar or '').strip()
    if texto:
        from django.db.models import Q

        queryset = queryset.filter(
            Q(serial_number__icontains=texto)
            | Q(mac_address__icontains=texto)
            | Q(numero_credito__icontains=texto)
        )

    if campo:
        queryset = queryset.filter(campo=campo)

    return queryset


def filtrar_sincronizaciones(syncs, items, desde=None, hasta=None):
    """Acota los dos orígenes del historial de sincronizaciones al mismo rango.

    Un BulkSyncItem no tiene fecha propia: la suya es la del lote que lo creó,
    de ahí el `job__creado`.
    """
    return (
        filtrar_por_fecha(syncs, desde, hasta, campo='creado'),
        filtrar_por_fecha(items, desde, hasta, campo='job__creado'),
    )
