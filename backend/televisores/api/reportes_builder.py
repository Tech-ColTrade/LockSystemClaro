"""Constructor de reportes: orígenes con lista blanca de campos.

El usuario elige un ORIGEN (televisores / sincronizaciones / códigos pin) y un
subconjunto de sus CAMPOS. El backend valida TODO contra esta lista blanca y
arma el queryset con el ORM: nunca hay SQL libre ni acceso a campos fuera de los
definidos aquí. Del usuario solo se expone el NOMBRE (nunca email/IP/rol).

Cada origen es "plano" (una fila por registro), así que no hay relaciones que el
usuario pueda armar mal: elige un origen y sus columnas, y ya. Es de solo
lectura y lo puede usar cualquier usuario autenticado.
"""
from __future__ import annotations

from typing import Callable

from django.db.models import Q, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from rest_framework import serializers, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from televisores.models import PinCodeUsado, ReporteGuardado, Televisor

from .exports import _estilar_encabezado, _respuesta_xlsx
from .filtros import filtrar_por_fecha
from .registros import (
    _resultado_item,
    _resultado_syncjob,
    nombre_usuario,
    qs_sincronizaciones,
)


def _fecha(dt) -> str:
    return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M') if dt else '—'


def _mes(dt) -> str:
    return timezone.localtime(dt).strftime('%Y-%m') if dt else '—'


def _dia(dt) -> str:
    return timezone.localtime(dt).strftime('%d/%m/%Y') if dt else '—'


class Campo:
    """Una columna elegible: su clave, etiqueta, tipo y cómo se renderiza.

    `render` recibe la fila cruda (dict de `.values()`) y devuelve el valor ya
    listo para mostrar/exportar. Así el frontend y el Excel comparten formato.
    """

    def __init__(self, key: str, label: str, tipo: str, render: Callable[[dict], object]):
        self.key = key
        self.label = label
        self.tipo = tipo  # 'texto' | 'fecha' | 'booleano' | 'usuario'
        self.render = render


# --- Origen: Televisores ----------------------------------------------------
def _qs_televisores(f: dict):
    qs = Televisor.objects.all()
    q = (f.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(serial_number__icontains=q)
            | Q(mac_address__icontains=q)
            | Q(numero_credito__icontains=q)
        )
    inhab = f.get('inhabilitado')
    if inhab in ('true', 'false'):
        qs = qs.filter(inhabilitado=(inhab == 'true'))
    qs = filtrar_por_fecha(qs, f.get('desde'), f.get('hasta'), campo='created_at')
    return qs.order_by('-created_at').values(
        'serial_number', 'mac_address', 'numero_credito',
        'inhabilitado', 'eui64', 'created_at',
    )


CAMPOS_TELEVISORES = [
    Campo('serial_number', 'Número de serie', 'texto', lambda r: r['serial_number'] or '—'),
    Campo('mac_address', 'Dirección MAC', 'texto', lambda r: r['mac_address'] or '—'),
    Campo('numero_credito', 'Número de crédito', 'texto', lambda r: r['numero_credito'] or '—'),
    Campo('inhabilitado', 'Estado', 'booleano',
          lambda r: 'Inhabilitado' if r['inhabilitado'] else 'Habilitado'),
    Campo('eui64', 'EUI-64', 'texto', lambda r: r['eui64'] or '—'),
    Campo('created_at', 'Fecha de registro', 'fecha', lambda r: _fecha(r['created_at'])),
]

# Dimensiones agrupables (modo "agrupado": conteo por grupo). Se reutiliza la
# clase Campo: aquí `render` devuelve la etiqueta del grupo de cada fila.
DIMENSIONES_TELEVISORES = [
    Campo('estado', 'Estado', 'booleano',
          lambda r: 'Inhabilitado' if r['inhabilitado'] else 'Habilitado'),
    Campo('mes_registro', 'Mes de registro', 'fecha', lambda r: _mes(r['created_at'])),
]


# --- Origen: Sincronizaciones (individuales + masivas) ----------------------
def _qs_sincronizaciones(f: dict):
    # Reutiliza el UNION que ya alimenta la vista /sincronizaciones: filas con
    # las claves fecha, mac, serial, usuario_nombre, inhabilitar, estado, tipo.
    return qs_sincronizaciones(desde=f.get('desde'), hasta=f.get('hasta'))


CAMPOS_SINCRONIZACIONES = [
    Campo('fecha', 'Fecha', 'fecha', lambda r: _fecha(r['fecha'])),
    Campo('serial_number', 'Número de serie', 'texto', lambda r: r['serial'] or '—'),
    Campo('mac_address', 'Dirección MAC', 'texto', lambda r: r['mac'] or '—'),
    Campo('usuario', 'Usuario', 'usuario', lambda r: r['usuario_nombre'] or '—'),
    Campo('accion', 'Acción', 'texto',
          lambda r: 'Inhabilitar' if r['inhabilitar'] else 'Habilitar'),
    Campo('resultado', 'Resultado', 'texto',
          lambda r: _resultado_syncjob(r['estado'])
          if r['tipo'] == 'Individual' else _resultado_item(r['estado'])),
    Campo('tipo', 'Tipo', 'texto', lambda r: r['tipo']),
]

DIMENSIONES_SINCRONIZACIONES = [
    Campo('usuario', 'Usuario', 'usuario', lambda r: r['usuario_nombre'] or '—'),
    Campo('accion', 'Acción', 'texto',
          lambda r: 'Inhabilitar' if r['inhabilitar'] else 'Habilitar'),
    Campo('resultado', 'Resultado', 'texto',
          lambda r: _resultado_syncjob(r['estado'])
          if r['tipo'] == 'Individual' else _resultado_item(r['estado'])),
    Campo('tipo', 'Tipo', 'texto', lambda r: r['tipo']),
    Campo('mes', 'Mes', 'fecha', lambda r: _mes(r['fecha'])),
]


# --- Origen: Códigos Pin usados ---------------------------------------------
def _qs_pincodes(f: dict):
    qs = PinCodeUsado.objects.all()
    q = (f.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(mac_address__icontains=q)
            | Q(passcode__icontains=q)
            | Q(pin_code__icontains=q)
        )
    qs = filtrar_por_fecha(qs, f.get('desde'), f.get('hasta'), campo='creado')
    return (
        qs.order_by('-creado')
        .annotate(
            usuario_nombre=nombre_usuario('usuario'),
            serial=Coalesce('televisor__serial_number', Value('—')),
        )
        .values('creado', 'serial', 'mac_address', 'usuario_nombre', 'passcode', 'pin_code')
    )


CAMPOS_PINCODES = [
    Campo('fecha', 'Fecha', 'fecha', lambda r: _fecha(r['creado'])),
    Campo('serial_number', 'Número de serie', 'texto', lambda r: r['serial'] or '—'),
    Campo('mac_address', 'Dirección MAC', 'texto', lambda r: r['mac_address'] or '—'),
    Campo('usuario', 'Usuario', 'usuario', lambda r: r['usuario_nombre'] or '—'),
    Campo('passcode', 'Código de Acceso', 'texto', lambda r: r['passcode']),
    Campo('pin_code', 'Código Pin', 'texto', lambda r: r['pin_code']),
]

DIMENSIONES_PINCODES = [
    Campo('usuario', 'Usuario', 'usuario', lambda r: r['usuario_nombre'] or '—'),
    Campo('mes', 'Mes', 'fecha', lambda r: _mes(r['creado'])),
    Campo('dia', 'Día', 'fecha', lambda r: _dia(r['creado'])),
]


# --- Registro de orígenes ----------------------------------------------------
ORIGENES = {
    'televisores': {
        'label': 'Televisores',
        'descripcion': 'Una fila por televisor: datos del equipo.',
        'campos': CAMPOS_TELEVISORES,
        'dimensiones': DIMENSIONES_TELEVISORES,
        'filtros': {'fecha': True, 'inhabilitado': True, 'busqueda': True},
        'queryset': _qs_televisores,
    },
    'sincronizaciones': {
        'label': 'Sincronizaciones',
        'descripcion': 'Una fila por sincronización (individual o masiva), con quién la hizo.',
        'campos': CAMPOS_SINCRONIZACIONES,
        'dimensiones': DIMENSIONES_SINCRONIZACIONES,
        'filtros': {'fecha': True, 'inhabilitado': False, 'busqueda': False},
        'queryset': _qs_sincronizaciones,
    },
    'pincodes': {
        'label': 'Códigos Pin',
        'descripcion': 'Una fila por cada código pin entregado, con quién lo entregó.',
        'campos': CAMPOS_PINCODES,
        'dimensiones': DIMENSIONES_PINCODES,
        'filtros': {'fecha': True, 'inhabilitado': False, 'busqueda': True},
        'queryset': _qs_pincodes,
    },
}


class ReporteInvalido(Exception):
    """La definición del reporte pide un origen o campo fuera de la lista blanca."""


def metadata() -> dict:
    """Descripción de orígenes/campos/filtros para que el frontend pinte la UI."""
    return {
        'origenes': [
            {
                'key': key,
                'label': o['label'],
                'descripcion': o['descripcion'],
                'filtros': o['filtros'],
                'campos': [
                    {'key': c.key, 'label': c.label, 'tipo': c.tipo}
                    for c in o['campos']
                ],
                'dimensiones': [
                    {'key': d.key, 'label': d.label, 'tipo': d.tipo}
                    for d in o['dimensiones']
                ],
            }
            for key, o in ORIGENES.items()
        ]
    }


def _validar(origen_key: str, campos_pedidos: list[str]):
    """Resuelve el origen y los campos, rechazando cualquier cosa fuera de la
    lista blanca. Sin campos pedidos, devuelve todos (en su orden natural)."""
    origen = ORIGENES.get(origen_key)
    if origen is None:
        raise ReporteInvalido(f'Origen no válido: «{origen_key}».')
    por_key = {c.key: c for c in origen['campos']}
    if not campos_pedidos:
        return origen, list(origen['campos'])
    seleccion = []
    for k in campos_pedidos:
        campo = por_key.get(k)
        if campo is None:
            raise ReporteInvalido(
                f'Campo no válido para «{origen["label"]}»: «{k}».'
            )
        seleccion.append(campo)
    return origen, seleccion


def _leer_filtros(params) -> dict:
    return {
        'desde': params.get('desde'),
        'hasta': params.get('hasta'),
        'inhabilitado': params.get('inhabilitado'),
        'q': params.get('q'),
    }


def _campos_pedidos(params) -> list[str]:
    raw = params.get('campos') or ''
    return [c for c in (s.strip() for s in raw.split(',')) if c]


def _validar_dimension(origen, dim_key: str):
    """Resuelve la dimensión de agrupación contra la lista blanca del origen."""
    por_key = {d.key: d for d in origen['dimensiones']}
    dim = por_key.get(dim_key)
    if dim is None:
        raise ReporteInvalido(
            f'Agrupación no válida para «{origen["label"]}»: «{dim_key}».'
        )
    return dim


def _agrupar(origen, dimension, filtros) -> list[tuple[str, int]]:
    """Cuenta registros por grupo (GROUP BY + COUNT), en Python.

    Se agrupa en Python y no en SQL porque un origen puede ser un UNION (las
    sincronizaciones), sobre el que anotar un Count es engorroso. El volumen es
    de escala administrativa, así que contar sobre las mismas filas del modo
    lista es simple y correcto. Orden: por cantidad desc, luego etiqueta.
    """
    from collections import Counter

    conteo: Counter = Counter()
    for row in origen['queryset'](filtros):
        conteo[dimension.render(row)] += 1
    return sorted(conteo.items(), key=lambda kv: (-kv[1], str(kv[0])))


def _campos_agrupado(dimension) -> list[dict]:
    return [
        {'key': 'grupo', 'label': dimension.label, 'tipo': dimension.tipo},
        {'key': 'cantidad', 'label': 'Cantidad', 'tipo': 'numero'},
    ]


def _es_agrupado(params) -> bool:
    return params.get('modo') == 'agrupado'


# --- Vistas -----------------------------------------------------------------
class ReportesCamposView(APIView):
    """Metadatos: qué orígenes, campos y filtros existen. Cualquier autenticado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(metadata())


class ReportesConsultarView(APIView):
    """Previsualización paginada: las filas que se van a exportar.

    Modo 'lista' (por defecto): filas planas de los campos elegidos.
    Modo 'agrupado': conteo por la dimensión elegida (+ total general).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        origen = ORIGENES.get(params.get('origen', ''))
        if origen is None:
            return Response(
                {'detail': f'Origen no válido: «{params.get("origen", "")}».'},
                status=400,
            )
        filtros = _leer_filtros(params)
        paginator = PageNumberPagination()

        if _es_agrupado(params):
            try:
                dimension = _validar_dimension(origen, params.get('dimension', ''))
            except ReporteInvalido as e:
                return Response({'detail': str(e)}, status=400)
            items = _agrupar(origen, dimension, filtros)
            total = sum(n for _, n in items)
            page = paginator.paginate_queryset(items, request, view=self)
            rows = [[etiqueta, n] for etiqueta, n in page]
            return Response({
                'count': paginator.page.paginator.count,
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'campos': _campos_agrupado(dimension),
                'rows': rows,
                'total': total,
            })

        try:
            _, seleccion = _validar(params.get('origen', ''), _campos_pedidos(params))
        except ReporteInvalido as e:
            return Response({'detail': str(e)}, status=400)
        qs = origen['queryset'](filtros)
        page = paginator.paginate_queryset(qs, request, view=self)
        rows = [[c.render(r) for c in seleccion] for r in page]
        return Response({
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'campos': [
                {'key': c.key, 'label': c.label, 'tipo': c.tipo} for c in seleccion
            ],
            'rows': rows,
            'total': None,
        })


class ReportesExportarView(APIView):
    """Excel (.xlsx) con TODAS las filas del reporte (mismo look de marca)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        origen_key = params.get('origen', '')
        origen = ORIGENES.get(origen_key)
        if origen is None:
            return Response({'detail': f'Origen no válido: «{origen_key}».'}, status=400)
        filtros = _leer_filtros(params)

        wb = Workbook()
        ws = wb.active
        ws.title = 'Reporte'

        if _es_agrupado(params):
            try:
                dimension = _validar_dimension(origen, params.get('dimension', ''))
            except ReporteInvalido as e:
                return Response({'detail': str(e)}, status=400)
            items = _agrupar(origen, dimension, filtros)
            ws.append([dimension.label, 'Cantidad'])
            _estilar_encabezado(ws)
            for etiqueta, n in items:
                ws.append([etiqueta, n])
            ws.append(['Total', sum(n for _, n in items)])
            for col, ancho in (('A', 28), ('B', 14)):
                ws.column_dimensions[col].width = ancho
            return _respuesta_xlsx(wb, f'reporte_{origen_key}_agrupado.xlsx')

        try:
            _, seleccion = _validar(origen_key, _campos_pedidos(params))
        except ReporteInvalido as e:
            return Response({'detail': str(e)}, status=400)
        ws.append([c.label for c in seleccion])
        _estilar_encabezado(ws)
        for row in origen['queryset'](filtros):
            ws.append([c.render(row) for c in seleccion])
        for i in range(1, len(seleccion) + 1):
            ws.column_dimensions[get_column_letter(i)].width = 22
        return _respuesta_xlsx(wb, f'reporte_{origen_key}.xlsx')


# --- Reportes guardados (por usuario) ---------------------------------------
def _validar_definicion(definicion) -> None:
    """Valida una definición guardada contra la lista blanca (mismo criterio
    que las consultas): así no se persiste un origen/campo/dimensión inventado."""
    if not isinstance(definicion, dict):
        raise ReporteInvalido('La definición del reporte es inválida.')
    origen = ORIGENES.get(definicion.get('origen', ''))
    if origen is None:
        raise ReporteInvalido(f'Origen no válido: «{definicion.get("origen", "")}».')
    if definicion.get('modo') == 'agrupado':
        _validar_dimension(origen, definicion.get('dimension', ''))
    else:
        _validar(definicion.get('origen', ''), definicion.get('campos') or [])


class ReporteGuardadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReporteGuardado
        fields = ['id', 'nombre', 'definicion', 'creado']
        read_only_fields = ['id', 'creado']

    def validate_nombre(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Ponle un nombre.')
        return value

    def validate_definicion(self, value):
        try:
            _validar_definicion(value)
        except ReporteInvalido as e:
            raise serializers.ValidationError(str(e))
        return value

    def validate(self, attrs):
        # Nombre único por usuario (mensaje claro en vez de un 500 por IntegrityError).
        usuario = self.context['request'].user
        nombre = attrs.get('nombre')
        qs = ReporteGuardado.objects.filter(usuario=usuario, nombre=nombre)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if nombre and qs.exists():
            raise serializers.ValidationError(
                {'nombre': 'Ya tienes un reporte guardado con ese nombre.'}
            )
        return attrs


class ReporteGuardadoViewSet(viewsets.ModelViewSet):
    """CRUD de los reportes guardados del usuario autenticado (privados).

    `get_queryset` acota a los del usuario, así nadie ve ni toca los de otro.
    """

    serializer_class = ReporteGuardadoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # lista completa: son pocos por usuario

    def get_queryset(self):
        return ReporteGuardado.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
