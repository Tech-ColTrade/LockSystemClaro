"""Autenticación JWT con revocación server-side y sesión única.

SimpleJWT es stateless: un token válido lo es hasta que expira. Sobre eso se
añaden dos controles, ambos por claims que se comparan contra la base:

- **Revocación (`tv`)**: cada JWT lleva la versión de token con la que se
  emitió. El logout incrementa `user.token_version`, de modo que todos los
  tokens anteriores dejan de coincidir. Es exacto: no tiene la ambigüedad de
  segundos que tendría comparar por fecha de emisión (`iat`). Se hace así, y no
  con la app `token_blacklist`, porque esta está bloqueada en este entorno por
  el límite de longitud de rutas de Windows.

- **Sesión única (`sid`)**: el identificador de la fila `SesionActiva` del
  usuario. Una cuenta solo puede tener una sesión abierta, así que si el `sid`
  del token no es el de la sesión vigente, ese token pertenece a una sesión ya
  cerrada (o reemplazada) y no vale.

Los dos claims viajan tanto en el access como en el refresh, porque SimpleJWT
copia los claims personalizados del refresh al access que deriva de él.
"""
from __future__ import annotations

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

# Nombre del claim que transporta la versión de token.
TOKEN_VERSION_CLAIM = 'tv'
# Nombre del claim que identifica la sesión (id de SesionActiva).
SESSION_CLAIM = 'sid'


def token_esta_revocado(user, validated_token) -> bool:
    """True si la versión del token no coincide con la vigente del usuario."""
    return validated_token.get(TOKEN_VERSION_CLAIM) != getattr(user, 'token_version', 0)


def token_de_sesion_ajena(user, validated_token) -> bool:
    """True si el token no pertenece a la sesión abierta ahora mismo.

    Cubre tres casos: la sesión se cerró (logout o cierre forzado), caducó por
    inactividad, o fue sustituida por otra.
    """
    # Import local: services importa modelos, y este módulo lo carga el arranque
    # de DRF antes de que las apps estén listas.
    from users.services import sesion_vigente

    sesion = sesion_vigente(user)
    if sesion is None:
        return True
    return str(sesion.id) != str(validated_token.get(SESSION_CLAIM) or '')


class RevocationAwareJWTAuthentication(JWTAuthentication):
    """JWTAuthentication que respeta la revocación y la sesión única."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if token_esta_revocado(user, validated_token):
            raise InvalidToken('La sesión fue cerrada. Inicia sesión de nuevo.')
        if token_de_sesion_ajena(user, validated_token):
            raise InvalidToken(
                'Tu sesión ya no está activa. Inicia sesión de nuevo.'
            )
        return user
