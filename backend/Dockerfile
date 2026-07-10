# Imagen de producción del backend (Django + Gunicorn + Selenium/Chromium).
#
# Se usa Docker en lugar del runtime nativo de Render porque la sincronización
# con el portal WhaleTV necesita un navegador real: la Device Lock API sabe
# desbloquear, pero el bloqueo solo se puede hacer manejando el portal web.
#
# Debian trixie trae `chromium` y `chromium-driver` en sus repos oficiales, y
# apt garantiza que las versiones del navegador y del driver casen entre sí (el
# clásico dolor de cabeza al instalar chromedriver a mano). Se usa trixie y no
# bookworm porque este último ya es oldstable y arrastra CVEs sin parchear.

FROM python:3.13-slim-trixie

# - PYTHONUNBUFFERED: los logs salen al instante (Render los lee de stdout).
# - PYTHONDONTWRITEBYTECODE: no ensuciar la imagen con .pyc.
# - CHROME_BIN / CHROMEDRIVER: las lee televisores/portal/selenium_sync.py.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver

WORKDIR /app

# Dependencias del sistema.
#   chromium / chromium-driver -> Selenium
#   libpq5                     -> cliente PostgreSQL en runtime (psycopg binary)
#   fonts-liberation           -> sin fuentes, Chrome headless renderiza cajas y
#                                 algunos selectores por texto fallan
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        chromium \
        chromium-driver \
        libpq5 \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Capa de dependencias primero: si requirements.txt no cambia, Docker reutiliza
# la caché y el build es mucho más rápido.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usuario sin privilegios: el proceso web nunca necesita root.
# selenium_sync.py ya lanza Chromium con --no-sandbox y --disable-dev-shm-usage,
# que es lo que hace falta para que funcione dentro de un contenedor.
# El chmod es necesario porque el bit de ejecución no sobrevive a `git` en
# Windows, que es donde se desarrolla este proyecto.
RUN chmod +x /app/entrypoint.sh \
    && useradd --create-home --shell /bin/bash app \
    && mkdir -p /app/staticfiles \
    && chown -R app:app /app
USER app

# Render inyecta $PORT. El valor por defecto sirve para probar en local.
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
