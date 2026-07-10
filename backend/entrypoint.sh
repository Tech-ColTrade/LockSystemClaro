#!/usr/bin/env bash
# Arranque del contenedor en Render.
#
# migrate y collectstatic se ejecutan aquí (runtime) y no en el Dockerfile
# porque settings.py aborta con DEBUG=False si faltan los secretos de WhaleTV,
# y durante el build esas variables de entorno todavía no existen.
set -euo pipefail

echo "==> Aplicando migraciones"
python manage.py migrate --noinput

echo "==> Recolectando estáticos"
python manage.py collectstatic --noinput

# Gunicorn.
#   gthread   : las sincronizaciones lanzan hilos daemon (bulk_sync.py) que no
#               sobrevivirían al worker `sync` por defecto.
#   workers   : cada worker puede abrir un Chromium (~400 MB). Súbelo solo si el
#               plan de Render tiene RAM de sobra, o el servicio hará OOM.
#   timeout   : algunas vistas de sincronización tardan más de los 30 s por
#               defecto de gunicorn.
echo "==> Iniciando gunicorn en :${PORT}"
exec gunicorn core.wsgi:application \
    --bind "0.0.0.0:${PORT}" \
    --worker-class gthread \
    --workers "${WEB_CONCURRENCY:-2}" \
    --threads "${GUNICORN_THREADS:-4}" \
    --timeout "${GUNICORN_TIMEOUT:-120}" \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile -
