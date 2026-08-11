"""Listados paginados para las secciones del sidebar:
Sincronizaciones y Pincodes usados (10 registros por página)."""
from __future__ import annotations

from django.db.models import CharField, F, Value
from django.db.models.functions import Coalesce, Concat, NullIf, Trim
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView

from televisores.models import (
    BulkSyncItem,
    BulkSyncJob,
    CambioTelevisor,
    PinCodeUsado,
    SyncJob,
)

from .filtros import filtrar_cambios, filtrar_por_fecha, filtrar_sincronizaciones
from .serializers import CambioTelevisorSerializer, PinCodeUsadoSerializer


def _resultado_syncjob(estado: str) -> str:
    return {'terminado': 'Aplicado', 'error': 'Error'}.get(estado, 'En proceso')


def _resultado_item(estado: str) -> str:
    return {'ok': 'Aplicado', 'error': 'Error'}.get(estado, 'Pendiente')


def nombre_usuario(prefix: str):
    """Expresión SQL con el nombre completo del usuario que lanzó la acción.

    `prefix` es la ruta a la relación de usuario ('usuario' o 'job__usuario').
    Arma 'Nombres Apellidos'; si ambos están vacíos cae al email, y si no hay
    usuario (SET_NULL) queda '—'.
    """
    completo = Trim(
        Concat(
            Coalesce(f'{prefix}__first_name', Value('')),
            Value(' '),
            Coalesce(f'{prefix}__last_name', Value('')),
            output_field=CharField(),
        )
    )
    return Coalesce(
        NullIf(completo, Value('')),
        f'{prefix}__email',
        Value('—'),
        output_field=CharField(),
    )


def qs_sincronizaciones(televisor=None, desde=None, hasta=None):
    """Historial unificado (individuales + masivos) como UN queryset ordenado.

    Se usa UNION en vez de juntar las dos listas en Python porque así el ORDER
    BY y el LIMIT/OFFSET los resuelve Postgres: la vista paginada trae 10 filas
    en vez de traerse la tabla entera para quedarse con 10.

    Las columnas de ambas ramas deben coincidir en número, orden y tipo.
    """
    syncs = SyncJob.objects.all()
    items = BulkSyncItem.objects.filter(job__modo=BulkSyncJob.SYNC)
    if televisor is not None:
        syncs = syncs.filter(televisor=televisor)
        items = items.filter(televisor=televisor)
    syncs, items = filtrar_sincronizaciones(syncs, items, desde, hasta)

    individuales = syncs.annotate(
        fecha=F('creado'),
        # El televisor es SET_NULL: puede haberse borrado y dejar la fila huérfana.
        mac=Coalesce('televisor__mac_address', Value('—')),
        serial=Coalesce('televisor__serial_number', Value('—')),
        usuario_nombre=nombre_usuario('usuario'),
        tipo=Value('Individual', output_field=CharField()),
    ).values(
        'fecha', 'mac', 'serial', 'usuario_nombre', 'inhabilitar', 'estado', 'tipo', 'id'
    )

    masivos = items.annotate(
        # Un BulkSyncItem no tiene fecha propia: hereda la del lote.
        fecha=F('job__creado'),
        mac=F('mac_address'),
        serial=Coalesce('televisor__serial_number', Value('—')),
        usuario_nombre=nombre_usuario('job__usuario'),
        tipo=Value('Masivo', output_field=CharField()),
    ).values(
        'fecha', 'mac', 'serial', 'usuario_nombre', 'inhabilitar', 'estado', 'tipo', 'id'
    )

    # all=True -> UNION ALL. Sin él, `union()` deduplica: dos filas idénticas
    # (mismo lote, misma MAC, misma acción y resultado) se fundirían en una y
    # el historial perdería registros.
    #
    # El desempate por (tipo, id) no es cosmético: todos los items de un lote
    # comparten la fecha del lote, y ORDER BY solo por fecha deja el orden de
    # los empates a criterio de Postgres. Con LIMIT/OFFSET eso hace que al
    # pasar de página se repitan o se pierdan filas.
    return individuales.union(masivos, all=True).order_by('-fecha', 'tipo', '-id')


def _fila(r: dict) -> dict:
    """Fila cruda del UNION -> forma que espera el frontend.

    El código de estado significa cosas distintas según el origen ('terminado'
    vs 'ok'), por eso se traduce aquí y no en SQL.
    """
    resultado = (
        _resultado_syncjob(r['estado'])
        if r['tipo'] == 'Individual'
        else _resultado_item(r['estado'])
    )
    return {
        'fecha': r['fecha'].isoformat(),
        'mac_address': r['mac'],
        'serial_number': r['serial'],
        'usuario': r['usuario_nombre'],
        'accion': 'Inhabilitar' if r['inhabilitar'] else 'Habilitar',
        'resultado': resultado,
        'tipo': r['tipo'],
    }


def construir_sincronizaciones(televisor=None, desde=None, hasta=None) -> list[dict]:
    """Lista completa (sin paginar). La usa el detalle de un televisor."""
    return [_fila(r) for r in qs_sincronizaciones(televisor, desde, hasta)]


class SincronizacionesView(APIView):
    """Historial de sincronizaciones al portal (individuales + masivas)."""

    def get(self, request):
        qs = qs_sincronizaciones(
            desde=request.query_params.get('desde'),
            hasta=request.query_params.get('hasta'),
        )
        paginator = PageNumberPagination()
        # paginate_queryset hace COUNT + LIMIT/OFFSET contra la base: solo se
        # materializan las 10 filas de la página.
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([_fila(r) for r in page])


def qs_cambios(request):
    """Queryset del historial ya filtrado con los parámetros de la petición.

    Vive aquí para que la vista y la exportación a Excel compartan filtro: es lo
    que garantiza que el archivo traiga exactamente lo que se ve en pantalla.
    """
    return filtrar_cambios(
        # select_related: la tabla muestra el nombre del usuario en cada fila.
        CambioTelevisor.objects.select_related('usuario'),
        desde=request.query_params.get('desde'),
        hasta=request.query_params.get('hasta'),
        buscar=request.query_params.get('buscar'),
        campo=request.query_params.get('campo'),
    )


class CambiosTelevisorView(ListAPIView):
    """Historial de cambios en los datos de los televisores.

    Solo lectura: estas filas las escribe el propio sistema al editar un
    televisor, nunca un usuario.
    """

    serializer_class = CambioTelevisorSerializer

    def get_queryset(self):
        return qs_cambios(self.request)


class CambiosTelevisorExportView(APIView):
    """Excel del historial de cambios, con los mismos filtros de la pantalla."""

    def get(self, request):
        from .exports import exportar_cambios

        return exportar_cambios(
            qs_cambios(request),
            desde=request.query_params.get('desde'),
            hasta=request.query_params.get('hasta'),
        )


class PincodesUsadosView(ListAPIView):
    """Bitácora de los Códigos Pin/Acceso que se han usado a través de la app."""

    serializer_class = PinCodeUsadoSerializer
    queryset = PinCodeUsado.objects.all()
    search_fields = ['mac_address', 'passcode', 'pin_code']

    def get_queryset(self):
        return filtrar_por_fecha(
            super().get_queryset(),
            self.request.query_params.get('desde'),
            self.request.query_params.get('hasta'),
        )
