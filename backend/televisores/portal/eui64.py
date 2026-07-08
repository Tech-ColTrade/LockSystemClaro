"""Conversión de MAC (EUI-48) a EUI-64, que es como el portal WhaleTV identifica
al dispositivo en su Device Lock API.

Regla estándar EUI-48 -> EUI-64: se parte la MAC en OUI (3 bytes) + NIC (3 bytes)
y se inserta ``FFFE`` en medio. Ej: B4:04:29:7E:3A:ED -> B40429FFFE7E3AED.
(Verificado contra el portal real: ese mapeo es el que reconoce el dispositivo.)
"""
from __future__ import annotations


def mac_to_eui64(mac: str) -> str:
    hexmac = mac.replace(':', '').replace('-', '').strip().upper()
    if len(hexmac) != 12 or not all(c in '0123456789ABCDEF' for c in hexmac):
        raise ValueError(f'MAC inválida para derivar EUI-64: {mac!r}')
    return hexmac[:6] + 'FFFE' + hexmac[6:]
