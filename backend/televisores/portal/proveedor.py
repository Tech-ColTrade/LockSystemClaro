"""De dónde se leen el estado y los Códigos Pin: de la API o del portal web.

Hay dos implementaciones equivalentes:

    Device Lock API (`client.PortalClient`)  -> rápida (~1 s), completa.
    Portal web      (`scraper.PortalScraper`) -> lenta (~30 s), incompleta.

Se elige SOLA según la configuración: si `WHALETV_LOCK_API_ACCESS_KEY` y
`WHALETV_LOCK_API_SECRET_KEY` tienen valor se usa la API; si están vacías se
cae al portal. Así, el día que lleguen las llaves del entorno correcto basta con
pegarlas en el `.env` (y en Render) para volver al modo rápido sin tocar código.

Diferencias del modo portal, que quien consuma esto debe tolerar:
  - `paymentStatus` y `clearStatus` salen como None (el portal no los publica).
  - `pin_codes()` lanza PortalCapacidadNoDisponible (el portal no lista la bolsa
    de códigos; solo resuelve un passcode concreto).

Ver `MODO_PORTAL.md` en la raíz del backend.
"""
from __future__ import annotations

import contextlib

from django.conf import settings

from .client import PortalClient
from .scraper import PortalScraper


def usa_portal() -> bool:
    """True si toca leer del portal (no hay credenciales de la Device Lock API)."""
    cfg = settings.WHALETV_LOCK_API
    return not (cfg.get('ACCESS_KEY') and cfg.get('SECRET_KEY'))


def modo() -> str:
    """'portal' o 'api'. Se expone en las respuestas para no adivinar."""
    return 'portal' if usa_portal() else 'api'


class _ProveedorApi:
    """Adaptador sobre PortalClient. Direcciona por EUI-64."""

    def __init__(self):
        self._client = PortalClient()

    def get_status(self, tv) -> dict:
        return self._client.get_status(tv.eui64_portal)

    def get_pin_codes(self, tv) -> list[dict]:
        return self._client.get_pin_codes(tv.eui64_portal)

    def usar_pincode(self, tv, passcode: str) -> str:
        grupos = self._client.get_pin_codes(tv.eui64_portal)
        grupo = next((g for g in grupos if g['passCode'] == passcode), None)
        if grupo is None:
            from .scraper import PortalPasscodeInvalido

            raise PortalPasscodeInvalido(
                'No hay un Código Pin disponible para ese Código de Acceso.'
            )
        # Marcar como usado es best-effort: si falla, el pin ya se entregó.
        from .client import PortalError

        try:
            self._client.marcar_pincodes_usados(tv.eui64_portal, [passcode])
        except PortalError:
            pass
        return grupo['pinCode']


class _ProveedorPortal:
    """Adaptador sobre PortalScraper. Direcciona por MAC."""

    def __init__(self, driver=None, wait=None):
        self._scraper = PortalScraper(driver=driver, wait=wait)

    def get_status(self, tv) -> dict:
        return self._scraper.get_status(tv.mac_address)

    def get_pin_codes(self, tv) -> list[dict]:
        return self._scraper.get_pin_codes(tv.mac_address)

    def usar_pincode(self, tv, passcode: str) -> str:
        return self._scraper.usar_pincode(tv.mac_address, passcode)


def proveedor():
    """El proveedor que toque según la configuración."""
    return _ProveedorPortal() if usa_portal() else _ProveedorApi()


@contextlib.contextmanager
def sesion_proveedor():
    """Proveedor para procesos por lotes.

    En modo portal abre UN navegador para todo el lote (una sola vez el login)
    en vez de uno por televisor; en modo API es simplemente el proveedor normal.
    """
    if not usa_portal():
        yield _ProveedorApi()
        return

    from .scraper import NAVEGADOR_LOCK
    from .selenium_sync import abrir_sesion

    with NAVEGADOR_LOCK:
        driver = None
        try:
            driver, wait = abrir_sesion()
            yield _ProveedorPortal(driver=driver, wait=wait)
        finally:
            if driver is not None:
                driver.quit()
