"""Backend de correo de Django que envía a través de la API de Gmail (OAuth2).

Por qué OAuth2 y no SMTP con contraseña: Google retiró las contraseñas de
aplicación para cuentas sin 2FA y el acceso "apps menos seguras" ya no existe.
La vía soportada es OAuth2: se guarda un **refresh token** de larga vida y con
él se pide un access token efímero antes de cada envío.

Por qué la API REST y no SMTP+XOAUTH2: el refresh token de este proyecto está
emitido con el scope `gmail.send`, que autoriza exactamente una cosa —enviar por
la API—. SMTP habría exigido el scope total `https://mail.google.com/`, que da
acceso de lectura a todo el buzón. Quedarse en `gmail.send` es el mínimo
privilegio: si el token se filtra, sirve para mandar correos, no para leerlos.

Por qué no `google-api-python-client`: arrastra una docena de dependencias para
lo que aquí son dos peticiones HTTP. `urllib` (stdlib) hace lo mismo sin tocar
`requirements.txt`.

Cómo obtener el refresh token (una sola vez, con la cuenta remitente): flujo
OAuth con el scope `https://www.googleapis.com/auth/gmail.send` y
`access_type=offline`.

Configuración — ver `GMAIL` en `settings.py`. Si falta alguna credencial, en
DEBUG los correos caen a consola; en producción `settings.py` aborta el arranque.
"""
from __future__ import annotations

import base64
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

TOKEN_URL = 'https://oauth2.googleapis.com/token'
SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

# Margen de seguridad: renueva el access token un minuto antes de que expire,
# para que no venza entre que lo pedimos y el servidor lo valida.
_EXPIRY_MARGIN = 60

# Caché en memoria del access token. Los tokens de Google duran ~1 h, así que sin
# esto pediríamos uno nuevo en cada correo. Cada worker de Gunicorn tiene el
# suyo: son procesos separados y no comparten memoria, lo cual es aceptable.
_token_lock = threading.Lock()
_token_cache: dict[str, object] = {'value': None, 'expires_at': 0.0}


class GmailError(RuntimeError):
    """Fallo hablando con Google (OAuth o envío)."""


def _obtener_access_token(*, forzar: bool = False) -> str:
    """Devuelve un access token vigente, canjeando el refresh token si hace falta."""
    with _token_lock:
        if not forzar:
            cached = _token_cache['value']
            expires_at = _token_cache['expires_at']
            if cached and isinstance(expires_at, float) and time.time() < expires_at:
                return str(cached)

        datos = urllib.parse.urlencode({
            'client_id': settings.GMAIL['CLIENT_ID'],
            'client_secret': settings.GMAIL['CLIENT_SECRET'],
            'refresh_token': settings.GMAIL['REFRESH_TOKEN'],
            'grant_type': 'refresh_token',
        }).encode()

        payload = _post(TOKEN_URL, datos, 'application/x-www-form-urlencoded')

        token = payload.get('access_token')
        if not token:
            raise GmailError('La respuesta de Google no trae access_token.')

        _token_cache['value'] = token
        _token_cache['expires_at'] = (
            time.time() + int(payload.get('expires_in', 3600)) - _EXPIRY_MARGIN
        )
        return str(token)


def _post(url: str, datos: bytes, content_type: str, token: str | None = None) -> dict:
    """POST JSON contra Google, convirtiendo sus errores en algo legible."""
    cabeceras = {'Content-Type': content_type}
    if token:
        cabeceras['Authorization'] = f'Bearer {token}'

    peticion = urllib.request.Request(url, data=datos, headers=cabeceras)
    try:
        with urllib.request.urlopen(peticion, timeout=30) as respuesta:
            return json.loads(respuesta.read().decode())
    except urllib.error.HTTPError as exc:
        # El cuerpo del error de Google explica la causa real (refresh token
        # revocado, scope insuficiente, cuenta equivocada); sin él es opaco.
        detalle = exc.read().decode(errors='replace')[:400]
        raise GmailError(f'Google respondió HTTP {exc.code}: {detalle}') from exc
    except OSError as exc:
        raise GmailError(f'No se pudo contactar a Google: {exc}') from exc


class GmailOAuth2EmailBackend(BaseEmailBackend):
    """Envía por la API de Gmail (`users.messages.send`).

    No mantiene conexión persistente: cada envío es una petición HTTPS
    independiente, así que `open()`/`close()` no tienen nada que hacer.
    """

    def open(self) -> bool:
        return False

    def close(self) -> None:
        return None

    def send_messages(self, email_messages) -> int:
        if not email_messages:
            return 0
        return sum(1 for mensaje in email_messages if self._enviar(mensaje))

    def _enviar(self, mensaje) -> bool:
        if not mensaje.recipients():
            return False

        # Gmail envía siempre desde la cuenta dueña del token; poner ese remitente
        # desde el principio evita un From que no coincide con el sobre.
        if not mensaje.from_email:
            mensaje.from_email = settings.GMAIL['FROM']

        # La API recibe el mensaje RFC 2822 completo en base64url.
        crudo = base64.urlsafe_b64encode(mensaje.message().as_bytes()).decode()
        cuerpo = json.dumps({'raw': crudo}).encode()

        try:
            self._llamar(cuerpo)
        except GmailError as exc:
            # Un access token cacheado pudo vencer o ser revocado: reintenta una
            # vez con uno recién pedido antes de darlo por fallido.
            if '401' in str(exc):
                try:
                    self._llamar(cuerpo, forzar_token=True)
                    return True
                except GmailError:
                    if not self.fail_silently:
                        raise
                    return False
            if not self.fail_silently:
                raise
            return False
        return True

    def _llamar(self, cuerpo: bytes, *, forzar_token: bool = False) -> None:
        _post(
            SEND_URL,
            cuerpo,
            'application/json',
            token=_obtener_access_token(forzar=forzar_token),
        )
