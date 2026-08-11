"""Correos que envía la app `users`.

El HTML va en línea y sin imágenes externas a propósito: los clientes de correo
no cargan CSS remoto y bloquean imágenes por defecto, así que cualquier cosa que
dependa de una descarga se vería rota. Se acompaña siempre de una versión en
texto plano, que es lo que leen los clientes que no renderizan HTML.
"""
from __future__ import annotations

from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

# Ruta del frontend que recibe el token y muestra el formulario.
RUTA_RESTABLECER = '/restablecer-password'


def url_restablecer(token: str) -> str:
    return f'{settings.FRONTEND_URL}{RUTA_RESTABLECER}?token={quote(token)}'


def _texto(nombre: str, enlace: str, minutos: int, app: str) -> str:
    return f"""Hola {nombre}:

Recibimos una solicitud para restablecer la contraseña de tu cuenta en {app}.

Abre este enlace para elegir una nueva contraseña:

{enlace}

El enlace vence en {minutos} minutos y solo se puede usar una vez.

Si no fuiste tú, ignora este mensaje: tu contraseña seguirá siendo la misma.

— {app}
"""


def _html(nombre: str, enlace: str, minutos: int, app: str) -> str:
    return f"""\
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#ffffff;border-radius:12px;
                    border:1px solid #e4e4e7;overflow:hidden;
                    font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="background:#0a0a0a;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;
                         letter-spacing:-0.3px;">{app}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#18181b;">
              Restablecer tu contraseña
            </h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
              Hola {nombre}, recibimos una solicitud para restablecer la
              contraseña de tu cuenta.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
              Pulsa el botón para elegir una nueva:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:8px;background:#0a0a0a;">
                <a href="{enlace}"
                   style="display:inline-block;padding:13px 28px;font-size:15px;
                          font-weight:600;color:#ffffff;text-decoration:none;">
                  Restablecer contraseña
                </a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
              El enlace vence en <strong>{minutos} minutos</strong> y solo se
              puede usar una vez.
            </p>
            <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
              Si el botón no funciona, copia esta dirección en tu navegador:<br>
              <span style="color:#3f3f46;word-break:break-all;">{enlace}</span>
            </p>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
              Si no solicitaste este cambio, ignora este correo: tu contraseña
              seguirá siendo la misma.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              Este es un mensaje automático, no respondas a este correo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def enviar_recuperacion_password(*, user, token: str) -> None:
    """Envía el enlace de recuperación. Propaga los errores de envío."""
    enlace = url_restablecer(token)
    minutos = settings.PASSWORD_RESET_MINUTOS
    app = settings.APP_NOMBRE
    nombre = user.get_short_name()

    mensaje = EmailMultiAlternatives(
        subject=f'Restablece tu contraseña · {app}',
        body=_texto(nombre, enlace, minutos, app),
        from_email=f'{app} <{settings.DEFAULT_FROM_EMAIL}>',
        to=[user.email],
    )
    mensaje.attach_alternative(_html(nombre, enlace, minutos, app), 'text/html')
    mensaje.send(fail_silently=False)
