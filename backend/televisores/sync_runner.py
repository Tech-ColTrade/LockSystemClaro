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
from .portal import open_sync
from .portal.selenium_sync import sincronizar_estado as sincronizar_con_selenium


def _sincronizar(tv, progreso):
    """Aplica el estado: primero por API, y si falla el servicio, por Selenium.

    La API es el camino normal (~3 s en vez de ~15-20 s). Selenium queda de red
    de seguridad: si la API se cae, o Zeasn vuelve a perder la vinculación de
    marca, el bloqueo se aplica igual y el operador no se entera.

    No se reintenta cuando el fallo es del dato (MAC que no existe en el
    portal, parámetros inválidos): Selenium daría el mismo error 15 s después.
    """
    if not open_sync.usa_open():
        return sincronizar_con_selenium(tv, progreso=progreso)

    res, usar_respaldo = open_sync.intentar(tv, progreso=progreso)
    if res.ok or not usar_respaldo:
        return res

    fallo_api = res.error
    res = sincronizar_con_selenium(tv, progreso=progreso)
    res.log.insert(0, f'La API falló ({fallo_api}). Se reintentó con Selenium.')
    if not res.ok and res.error:
        res.error = f'API: {fallo_api} | Selenium: {res.error}'
    return res


def _ejecutar(job_id: int):
    try:
        job = SyncJob.objects.get(pk=job_id)
        tv = Televisor.objects.get(pk=job.televisor_id)

        # `actualizado` es el LATIDO que usa televisores/watchdog.py para saber
        # si este hilo sigue vivo. Va a mano en cada update porque
        # `QuerySet.update()` no dispara el `auto_now` del campo.
        SyncJob.objects.filter(pk=job_id).update(
            estado=SyncJob.CORRIENDO, porcentaje=5, actualizado=timezone.now()
        )

        def progreso(pct, _msg=''):
            SyncJob.objects.filter(pk=job_id).update(
                porcentaje=pct, actualizado=timezone.now()
            )

        res = _sincronizar(tv, progreso)

        if res.ok and res.aplicado:
            SyncJob.objects.filter(pk=job_id).update(
                estado=SyncJob.TERMINADO,
                porcentaje=100,
                terminado_en=timezone.now(),
                actualizado=timezone.now(),
            )
        else:
            SyncJob.objects.filter(pk=job_id).update(
                estado=SyncJob.ERROR,
                porcentaje=100,
                error=(res.error or 'No se pudo aplicar el cambio en el portal.')[:1000],
                terminado_en=timezone.now(),
                actualizado=timezone.now(),
            )
    except Exception as e:  # noqa: BLE001
        SyncJob.objects.filter(pk=job_id).update(
            estado=SyncJob.ERROR,
            porcentaje=100,
            error=f'{type(e).__name__}: {e}'[:1000],
            terminado_en=timezone.now(),
            actualizado=timezone.now(),
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
