"""Ejecución en segundo plano de una sincronización masiva (Enrolar Estado).

Un solo hilo abre UNA sesión del portal (un login) y recorre los televisores del
lote aplicando su estado, actualizando el progreso del BulkSyncJob. El frontend
consulta el avance por polling.
"""
from __future__ import annotations

import threading

from django.db import connections
from django.utils import timezone

from .models import BulkSyncItem, BulkSyncJob, Televisor
from .portal.client import PortalClient, PortalError
from .portal.selenium_sync import abrir_sesion, aplicar_en_sesion


def _ejecutar(job_id: int):
    driver = None
    try:
        BulkSyncJob.objects.filter(pk=job_id).update(estado=BulkSyncJob.CORRIENDO)
        items = list(
            BulkSyncItem.objects.filter(job_id=job_id).values_list('pk', 'televisor_id')
        )

        driver, wait = abrir_sesion()

        ok = 0
        err = 0
        cancelado = False
        for procesados, (item_pk, tv_id) in enumerate(items, start=1):
            if BulkSyncJob.objects.filter(
                pk=job_id, cancelar_solicitado=True
            ).exists():
                cancelado = True
                break

            try:
                tv = Televisor.objects.get(pk=tv_id)
                res = aplicar_en_sesion(driver, wait, tv)
                if res.ok and res.aplicado:
                    estado_item = BulkSyncItem.OK
                    mensaje = 'Inhabilitado' if tv.inhabilitado else 'Habilitado'
                    ok += 1
                else:
                    estado_item = BulkSyncItem.ERROR
                    mensaje = res.error or 'No se pudo aplicar.'
                    err += 1
            except Exception as e:  # noqa: BLE001
                estado_item = BulkSyncItem.ERROR
                mensaje = f'{type(e).__name__}: {e}'
                err += 1

            BulkSyncItem.objects.filter(pk=item_pk).update(
                estado=estado_item, mensaje=mensaje[:500]
            )
            BulkSyncJob.objects.filter(pk=job_id).update(
                procesados=procesados, ok_count=ok, error_count=err
            )

        BulkSyncJob.objects.filter(pk=job_id).update(
            estado=BulkSyncJob.CANCELADO if cancelado else BulkSyncJob.TERMINADO,
            terminado_en=timezone.now(),
        )
    except Exception as e:  # noqa: BLE001
        # Falló el arranque/login: se marcan los items pendientes como error.
        BulkSyncItem.objects.filter(
            job_id=job_id, estado=BulkSyncItem.PENDIENTE
        ).update(estado=BulkSyncItem.ERROR, mensaje=f'{type(e).__name__}: {e}'[:500])
        BulkSyncJob.objects.filter(pk=job_id).update(
            estado=BulkSyncJob.ERROR,
            error_count=BulkSyncItem.objects.filter(
                job_id=job_id, estado=BulkSyncItem.ERROR
            ).count(),
            terminado_en=timezone.now(),
        )
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:  # noqa: BLE001
                pass
        connections.close_all()


def _ejecutar_validacion(job_id: int):
    """Validación masiva (dry-run): lee el estado del portal por API y lo compara
    con el estado local. No modifica nada."""
    try:
        BulkSyncJob.objects.filter(pk=job_id).update(estado=BulkSyncJob.CORRIENDO)
        items = list(
            BulkSyncItem.objects.filter(job_id=job_id).values_list('pk', 'televisor_id')
        )
        client = PortalClient()

        ok = 0
        err = 0
        cancelado = False
        for procesados, (item_pk, tv_id) in enumerate(items, start=1):
            if BulkSyncJob.objects.filter(
                pk=job_id, cancelar_solicitado=True
            ).exists():
                cancelado = True
                break

            try:
                tv = Televisor.objects.get(pk=tv_id)
                data = client.get_status(tv.eui64_portal)
                remoto = data['lockStatus'] == 1
                local = bool(tv.inhabilitado)
                coincide = remoto == local
                estado_item = BulkSyncItem.OK if coincide else BulkSyncItem.ERROR
                txt = 'Inhabilitado' if remoto else 'Habilitado'
                txt_local = 'Inhabilitado' if local else 'Habilitado'
                mensaje = (
                    f'Coinciden ({txt}).'
                    if coincide
                    else f'Portal: {txt} | App: {txt_local}. Conviene sincronizar.'
                )
                BulkSyncItem.objects.filter(pk=item_pk).update(
                    estado=estado_item,
                    mensaje=mensaje,
                    remoto_inhabilitado=remoto,
                    local_inhabilitado=local,
                    coincide=coincide,
                )
                ok += 1 if coincide else 0
                err += 0 if coincide else 1
            except PortalError as e:
                BulkSyncItem.objects.filter(pk=item_pk).update(
                    estado=BulkSyncItem.ERROR, mensaje=str(e)[:500]
                )
                err += 1
            except Exception as e:  # noqa: BLE001
                BulkSyncItem.objects.filter(pk=item_pk).update(
                    estado=BulkSyncItem.ERROR, mensaje=f'{type(e).__name__}: {e}'[:500]
                )
                err += 1

            BulkSyncJob.objects.filter(pk=job_id).update(
                procesados=procesados, ok_count=ok, error_count=err
            )

        BulkSyncJob.objects.filter(pk=job_id).update(
            estado=BulkSyncJob.CANCELADO if cancelado else BulkSyncJob.TERMINADO,
            terminado_en=timezone.now(),
        )
    except Exception as e:  # noqa: BLE001
        BulkSyncJob.objects.filter(pk=job_id).update(
            estado=BulkSyncJob.ERROR, terminado_en=timezone.now()
        )
        print(f'[validacion] error: {e}')
    finally:
        connections.close_all()


def lanzar_validacion_masiva() -> BulkSyncJob | None:
    """Crea un BulkSyncJob de validación para TODOS los TV y lanza el hilo."""
    televisores = list(Televisor.objects.all())
    if not televisores:
        return None
    job = BulkSyncJob.objects.create(
        modo=BulkSyncJob.VALIDACION, total=len(televisores)
    )
    BulkSyncItem.objects.bulk_create([
        BulkSyncItem(
            job=job,
            televisor=tv,
            mac_address=tv.mac_address,
            inhabilitar=tv.inhabilitado,
        )
        for tv in televisores
    ])
    threading.Thread(target=_ejecutar_validacion, args=(job.pk,), daemon=True).start()
    return job


def lanzar_bulk_job(
    cambiados: list[Televisor], resumen: dict, usuario=None, ip: str | None = None
) -> BulkSyncJob:
    """Crea el BulkSyncJob + items para los TV cambiados y lanza el hilo."""
    job = BulkSyncJob.objects.create(
        total=len(cambiados),
        creados=resumen.get('creados', 0),
        actualizados=resumen.get('actualizados', 0),
        errores_import=resumen.get('errores', []),
        usuario=usuario if usuario and usuario.is_authenticated else None,
        ip=ip,
    )
    BulkSyncItem.objects.bulk_create([
        BulkSyncItem(
            job=job,
            televisor=tv,
            mac_address=tv.mac_address,
            inhabilitar=tv.inhabilitado,
        )
        for tv in cambiados
    ])
    hilo = threading.Thread(target=_ejecutar, args=(job.pk,), daemon=True)
    hilo.start()
    return job
