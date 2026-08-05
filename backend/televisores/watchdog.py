"""Detección de jobs huérfanos (los que se quedaron "corriendo" para siempre).

Las sincronizaciones corren en hilos daemon dentro del proceso web. Si el
proceso muere a mitad (redespliegue de Render, reciclado de un worker de
gunicorn, un Ctrl-C en local), el hilo se va con él pero la fila del job se
queda en `corriendo`: quien haga polling espera eternamente un final que ya
nunca llega.

La detección se basa en el LATIDO: `sync_runner` y `bulk_sync` refrescan
`actualizado` en cada avance, así que un job vivo late cada 10-40 s. Si lleva
más de `JOBS_TIMEOUT_MINUTOS` sin latir, su hilo ya no existe.

(Cuidado al tocar los runners: `QuerySet.update()` NO dispara `auto_now`, por eso
el latido se escribe a mano con `actualizado=timezone.now()`. Si se quita, todo
esto deja de funcionar en silencio y volvemos a los jobs colgados.)

Se invoca de dos formas, ninguna necesita cron:
  - al arrancar el servicio (`apps.py`), que limpia lo que dejó el reinicio;
  - al consultar cualquier job, para que el cliente se entere en el momento.
"""
from __future__ import annotations

import datetime

from django.conf import settings
from django.utils import timezone

from .models import BulkSyncJob, SyncJob

MENSAJE = (
    'La sincronización se interrumpió sin terminar (probablemente el servidor se '
    'reinició mientras corría). No se aplicó el cambio: vuelve a lanzarla.'
)


def _limite(minutos: int | None = None) -> datetime.datetime:
    if minutos is None:
        minutos = getattr(settings, 'JOBS_TIMEOUT_MINUTOS', 10)
    return timezone.now() - datetime.timedelta(minutes=minutos)


def esta_vivo(job) -> bool:
    """True si el job sigue latiendo (su hilo existe y avanza)."""
    if job.finalizado:
        return False
    return job.actualizado >= _limite()


def marcar_huerfanos(minutos: int | None = None) -> int:
    """Marca como error los jobs sin latido. Devuelve cuántos cerró.

    Es una sola UPDATE por tabla, así que sale barato llamarlo en cada polling.
    """
    limite = _limite(minutos)
    ahora = timezone.now()

    cerrados = SyncJob.objects.filter(
        estado__in=[SyncJob.PENDIENTE, SyncJob.CORRIENDO],
        actualizado__lt=limite,
    ).update(
        estado=SyncJob.ERROR,
        error=MENSAJE,
        porcentaje=100,
        terminado_en=ahora,
        actualizado=ahora,
    )

    cerrados += BulkSyncJob.objects.filter(
        estado__in=[BulkSyncJob.PENDIENTE, BulkSyncJob.CORRIENDO],
        actualizado__lt=limite,
    ).update(
        estado=BulkSyncJob.ERROR,
        terminado_en=ahora,
        actualizado=ahora,
    )

    return cerrados
