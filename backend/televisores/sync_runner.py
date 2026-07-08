"""Ejecución en segundo plano de la sincronización de un televisor con el portal.

Al guardar el estado de un TV se crea un SyncJob y se lanza un hilo daemon que
corre la automatización Selenium y va actualizando el porcentaje del job. El
frontend consulta el progreso por polling (igual que whaletv).
"""
from __future__ import annotations

import threading

from django.db import connections
from django.utils import timezone

from .models import SyncJob, Televisor
from .portal.selenium_sync import sincronizar_estado


def _ejecutar(job_id: int):
    try:
        job = SyncJob.objects.get(pk=job_id)
        tv = Televisor.objects.get(pk=job.televisor_id)

        SyncJob.objects.filter(pk=job_id).update(
            estado=SyncJob.CORRIENDO, porcentaje=5
        )

        def progreso(pct, _msg=''):
            SyncJob.objects.filter(pk=job_id).update(porcentaje=pct)

        res = sincronizar_estado(tv, progreso=progreso)

        if res.ok and res.aplicado:
            SyncJob.objects.filter(pk=job_id).update(
                estado=SyncJob.TERMINADO,
                porcentaje=100,
                terminado_en=timezone.now(),
            )
        else:
            SyncJob.objects.filter(pk=job_id).update(
                estado=SyncJob.ERROR,
                porcentaje=100,
                error=(res.error or 'No se pudo aplicar el cambio en el portal.')[:1000],
                terminado_en=timezone.now(),
            )
    except Exception as e:  # noqa: BLE001
        SyncJob.objects.filter(pk=job_id).update(
            estado=SyncJob.ERROR,
            porcentaje=100,
            error=f'{type(e).__name__}: {e}'[:1000],
            terminado_en=timezone.now(),
        )
    finally:
        # El hilo tiene su propia conexión a la BD; hay que cerrarla.
        connections.close_all()


def lanzar_sync_job(
    televisor: Televisor, inhabilitar: bool, usuario=None, ip: str | None = None
) -> SyncJob:
    """Crea el SyncJob y lanza el hilo que lo procesa. Devuelve el job."""
    job = SyncJob.objects.create(
        televisor=televisor,
        inhabilitar=inhabilitar,
        usuario=usuario if usuario and usuario.is_authenticated else None,
        ip=ip,
    )
    hilo = threading.Thread(target=_ejecutar, args=(job.pk,), daemon=True)
    hilo.start()
    return job
