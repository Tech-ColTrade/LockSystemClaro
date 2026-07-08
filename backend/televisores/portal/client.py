"""Cliente de la WhaleTV / Zeasn *Device Lock Service API*.

Autenticación (Device Lock Service API 1.0.3):
    ts         = timestamp actual en milisegundos (string)
    encryptStr = RequestURL + ts        # ej: /device-lock/api/v1/device/status
    signature  = Base64(HMAC_SHA1(SecretKey, encryptStr))
    Authorization = AccessKey + ":" + signature + ":" + ts

Todas las llamadas son GET con parámetros en la query. Solo usa la stdlib.

Capacidades de esta API (device-side):
    - get_status(eui64)  -> lee estado (lockStatus/paymentStatus/clearStatus)
    - unlock(eui64)      -> desbloquea (habilitar)
    NO existe un endpoint para bloquear: el bloqueo lo determina el estado de
    pago en el lado SaaS. Ver PortalLockNoSoportado.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


class PortalError(Exception):
    """Fallo al comunicarse con el portal o respuesta de error del mismo."""


class PortalDispositivoNoExiste(PortalError):
    """El eui64 no está registrado en el portal (errorCode 260001)."""


class PortalClient:
    def __init__(self, cfg: dict | None = None):
        self.cfg = cfg or settings.WHALETV_LOCK_API

    # -- autenticación --------------------------------------------------
    def _authorization(self, request_url: str) -> str:
        ts = str(int(time.time() * 1000))
        digest = hmac.new(
            self.cfg['SECRET_KEY'].encode('utf-8'),
            (request_url + ts).encode('utf-8'),
            hashlib.sha1,
        ).digest()
        signature = base64.b64encode(digest).decode('utf-8')
        return f"{self.cfg['ACCESS_KEY']}:{signature}:{ts}"

    # -- llamada base ---------------------------------------------------
    def _get(self, path: str, params: dict) -> dict:
        request_url = f"{self.cfg['API_BASE']}{path}"  # ruta firmada (sin host ni query)
        url = f"https://{self.cfg['HOST']}{request_url}?" + urllib.parse.urlencode(params)

        req = urllib.request.Request(url, method='GET')
        req.add_header('Authorization', self._authorization(request_url))
        req.add_header('Accept', 'application/json')

        try:
            with urllib.request.urlopen(req, timeout=self.cfg.get('TIMEOUT', 15)) as resp:
                body = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            detalle = e.read().decode('utf-8', errors='replace')
            raise PortalError(f'HTTP {e.code} del portal: {detalle}') from e
        except urllib.error.URLError as e:
            raise PortalError(f'No se pudo conectar con el portal: {e.reason}') from e

        error_code = str(body.get('errorCode'))
        if error_code == '260001':
            raise PortalDispositivoNoExiste(
                'El dispositivo no está registrado en el portal WhaleTV.'
            )
        if error_code != '0':
            raise PortalError(
                body.get('errorMsg') or f'El portal devolvió errorCode {error_code}.'
            )
        return body.get('data') or {}

    # -- operaciones ----------------------------------------------------
    def get_status(self, eui64: str) -> dict:
        """Devuelve {'lockStatus', 'paymentStatus', 'clearStatus'} como enteros."""
        data = self._get('/device/status', {'eui64': eui64})
        return {
            'lockStatus': int(data.get('lockStatus', 0)),
            'paymentStatus': int(data.get('paymentStatus', 0)),
            'clearStatus': int(data.get('clearStatus', 0)),
        }

    def unlock(self, eui64: str, passcode: str | None = None) -> None:
        """Desbloquea el dispositivo (habilitar). El portal fija lockStatus=0."""
        params = {'eui64': eui64}
        if passcode:
            params['unlockPassCode'] = passcode
        self._get('/device/unlocked', params)

    def get_pin_codes(self, eui64: str) -> list[dict]:
        """Grupos de Pin Code disponibles (sin usar) del dispositivo.

        Devuelve [{'codeId', 'passCode', 'pinCode'}, ...]. El televisor muestra
        un passCode; el pinCode asociado es el que lo desbloquea.
        """
        data = self._get('/device/pinCode', {'eui64': eui64})
        return [
            {
                'codeId': str(g.get('codeId', '')),
                'passCode': str(g.get('passCode', '')),
                'pinCode': str(g.get('pinCode', '')),
            }
            for g in (data or [])
        ]

    def marcar_pincodes_usados(self, eui64: str, passcodes: list[str]) -> None:
        """Marca pass codes como usados (para que no se reutilicen)."""
        self._get(
            '/device/pinCode/used',
            {'eui64': eui64, 'passCodes': ','.join(passcodes)},
        )
