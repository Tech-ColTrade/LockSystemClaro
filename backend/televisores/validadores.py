"""Reglas de formato de los campos del televisor.

Vive aparte para que la misma regla valga en las tres puertas de entrada: el
formulario del panel (serializer), la carga masiva por archivo (imports) y la
API de integración. Antes cada una hacía lo suyo, y el número de serie no se
validaba en ninguna — hallazgo de las pruebas EXUS del InTec_EXUS_36.
"""
from __future__ import annotations

import re

# Solo letras y dígitos. Sin espacios, guiones, dos puntos ni signos: un número
# de serie es un identificador impreso en el equipo, no texto libre.
#
# Si algún día aparecen seriales de fábrica con guiones, este es el único sitio
# que hay que tocar (y avisar en el texto de ayuda del formulario).
SERIAL_RE = re.compile(r'^[A-Z0-9]+$')

SERIAL_MIN = 4
SERIAL_MAX = 50  # el máximo de la columna en la base de datos

MENSAJE_SERIAL = (
    'El número de serie solo puede tener letras y números, sin espacios ni '
    'caracteres especiales.'
)
MENSAJE_SERIAL_CORTO = f'El número de serie debe tener al menos {SERIAL_MIN} caracteres.'
MENSAJE_SERIAL_LARGO = f'El número de serie no puede superar {SERIAL_MAX} caracteres.'


class SerialInvalido(ValueError):
    """El número de serie no cumple el formato. El mensaje es para el usuario."""


def normalizar_serial(valor) -> str:
    """Limpia y valida un número de serie. Devuelve el valor normalizado.

    Vacío es válido: el número de serie es opcional (`blank=True` en el modelo)
    y hay televisores que se dan de alta solo con la MAC.

    Se pasa a mayúsculas igual que la MAC, para que `ABC123` y `abc123` no
    entren como dos equipos distintos.
    """
    texto = str(valor or '').strip().upper()
    if not texto:
        return ''
    if len(texto) < SERIAL_MIN:
        raise SerialInvalido(MENSAJE_SERIAL_CORTO)
    if len(texto) > SERIAL_MAX:
        raise SerialInvalido(MENSAJE_SERIAL_LARGO)
    if not SERIAL_RE.match(texto):
        raise SerialInvalido(MENSAJE_SERIAL)
    return texto


def validar_serial(valor):
    """Validador de Django para el campo del modelo.

    Al colgarlo del campo, la carga masiva por archivo lo hereda gratis: ya
    llama a `full_clean()` por fila y reporta el error con su número de fila.
    """
    from django.core.exceptions import ValidationError

    try:
        normalizar_serial(valor)
    except SerialInvalido as e:
        raise ValidationError(str(e)) from e
