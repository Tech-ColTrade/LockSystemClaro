from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

# Un número de crédito: solo dígitos, hasta 60 (se guarda como texto porque
# 60 dígitos no caben en ningún entero de base de datos).
validar_numero_credito = RegexValidator(
    r'^\d{0,60}$',
    'El número de crédito debe contener solo dígitos (máximo 60).',
)


class Televisor(models.Model):
    """Televisor del sistema de bloqueo (Locking System).

    Nota: la sincronización con el portal y los códigos pin se manejan en otras
    secciones; aquí solo vive el CRUD del dispositivo.
    """

    mac_address = models.CharField('Dirección MAC', max_length=50, unique=True)
    serial_number = models.CharField(
        'Número de serie', max_length=50, blank=True, default=''
    )
    numero_credito = models.CharField(
        'Número de crédito',
        max_length=60,
        blank=True,
        default='',
        validators=[validar_numero_credito],
    )

    # El estado (inhabilitado) se administra desde la sección de inhabilitaciones.
    inhabilitado = models.BooleanField('Inhabilitado', default=False)

    # Identificador del dispositivo en el portal WhaleTV. Si se deja vacío se
    # deriva de la MAC (EUI-48 -> EUI-64). Se permite override por si algún
    # dispositivo no sigue la derivación estándar.
    eui64 = models.CharField('EUI-64', max_length=32, blank=True, default='')

    # db_index: es la columna del `ordering` de abajo. Sin índice, servir una
    # página de 10 obliga a Postgres a ordenar la tabla entera.
    created_at = models.DateTimeField('Fecha de registro', auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'televisor'
        verbose_name_plural = 'televisores'
        ordering = ['-created_at']

    def __str__(self):
        return self.mac_address

    def save(self, *args, **kwargs):
        # Normaliza la MAC a mayúsculas para dedupe/búsqueda consistente.
        if self.mac_address:
            self.mac_address = self.mac_address.strip().upper()
        if self.serial_number:
            self.serial_number = self.serial_number.strip()
        if self.eui64:
            self.eui64 = self.eui64.strip().upper()
        super().save(*args, **kwargs)

    @property
    def eui64_portal(self) -> str:
        """EUI-64 efectivo para el portal: el guardado, o el derivado de la MAC."""
        from .portal.eui64 import mac_to_eui64

        if self.eui64:
            return self.eui64
        return mac_to_eui64(self.mac_address)

    @property
    def fecha_sincronizar(self):
        """Fecha (Next Installment Date) que se empuja al portal (igual a whaletv).

        - Inhabilitado -> hoy − N días (fecha vencida -> el portal lo bloquea).
        - Habilitado   -> hoy + N días (fecha futura -> el portal lo libera).
        """
        import datetime

        from django.conf import settings
        from django.utils import timezone

        dias = datetime.timedelta(days=settings.WHALETV_PORTAL['DIAS_DESFASE'])
        hoy = timezone.localdate()
        return hoy - dias if self.inhabilitado else hoy + dias


class SyncJob(models.Model):
    """Trabajo de sincronización en segundo plano de UN televisor con el portal.

    Guardar el estado (habilitado/inhabilitado) lanza uno de estos jobs; el
    frontend consulta su progreso por polling (igual que whaletv).
    """

    PENDIENTE = 'pendiente'
    CORRIENDO = 'corriendo'
    TERMINADO = 'terminado'
    ERROR = 'error'
    ESTADOS = [
        (PENDIENTE, 'Pendiente'),
        (CORRIENDO, 'Corriendo'),
        (TERMINADO, 'Terminado'),
        (ERROR, 'Error'),
    ]

    televisor = models.ForeignKey(
        Televisor, related_name='sync_jobs', on_delete=models.CASCADE
    )
    # Estado objetivo que se aplicará en el portal.
    inhabilitar = models.BooleanField()
    estado = models.CharField(max_length=12, choices=ESTADOS, default=PENDIENTE)
    porcentaje = models.PositiveSmallIntegerField(default=0)
    error = models.TextField(blank=True, default='')
    # Auditoría: quién lanzó la acción y desde qué IP.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sync_jobs',
    )
    ip = models.GenericIPAddressField('IP', null=True, blank=True)
    creado = models.DateTimeField(auto_now_add=True, db_index=True)
    actualizado = models.DateTimeField(auto_now=True)
    terminado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'sincronización'
        verbose_name_plural = 'sincronizaciones'
        ordering = ['-creado']

    def __str__(self):
        return f'Sync #{self.pk} {self.televisor.mac_address} ({self.estado})'

    @property
    def finalizado(self) -> bool:
        return self.estado in (self.TERMINADO, self.ERROR)


class BulkSyncJob(models.Model):
    """Sincronización masiva (Enrolar Estado): aplica el estado de varios TV
    en el portal en una sola corrida en segundo plano."""

    PENDIENTE = 'pendiente'
    CORRIENDO = 'corriendo'
    TERMINADO = 'terminado'
    ERROR = 'error'
    CANCELADO = 'cancelado'
    ESTADOS = [
        (PENDIENTE, 'Pendiente'),
        (CORRIENDO, 'Corriendo'),
        (TERMINADO, 'Terminado'),
        (ERROR, 'Error'),
        (CANCELADO, 'Cancelado'),
    ]

    SYNC = 'sync'
    VALIDACION = 'validacion'
    MODOS = [(SYNC, 'Sincronización'), (VALIDACION, 'Validación')]

    modo = models.CharField(max_length=12, choices=MODOS, default=SYNC)
    estado = models.CharField(max_length=12, choices=ESTADOS, default=PENDIENTE)
    # El usuario pidió cancelar: el hilo en segundo plano revisa este flag
    # entre televisor y televisor (no hay forma de matar el hilo a la fuerza).
    cancelar_solicitado = models.BooleanField(default=False)
    total = models.PositiveIntegerField(default=0)
    procesados = models.PositiveIntegerField(default=0)
    ok_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    # Resumen de la importación que originó el lote.
    creados = models.PositiveIntegerField(default=0)
    actualizados = models.PositiveIntegerField(default=0)
    errores_import = models.JSONField(default=list, blank=True)
    # Auditoría: quién lanzó el lote y desde qué IP.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='bulk_sync_jobs',
    )
    ip = models.GenericIPAddressField('IP', null=True, blank=True)
    creado = models.DateTimeField(auto_now_add=True, db_index=True)
    actualizado = models.DateTimeField(auto_now=True)
    terminado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'sincronización masiva'
        verbose_name_plural = 'sincronizaciones masivas'
        ordering = ['-creado']

    def __str__(self):
        return f'BulkSync #{self.pk} ({self.estado} {self.procesados}/{self.total})'

    @property
    def finalizado(self) -> bool:
        return self.estado in (self.TERMINADO, self.ERROR, self.CANCELADO)

    @property
    def porcentaje(self) -> int:
        if self.total <= 0:
            return 100 if self.finalizado else 0
        return min(100, round(self.procesados * 100 / self.total))


class PinCodeUsado(models.Model):
    """Bitácora de cada Código Pin usado a través de la app (MAC + passcode + pin)."""

    televisor = models.ForeignKey(
        Televisor,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='pincodes_usados',
    )
    mac_address = models.CharField('Mac Address', max_length=50)
    passcode = models.CharField('Código de Acceso', max_length=50)
    pin_code = models.CharField('Código Pin', max_length=50)
    # Auditoría: qué usuario entregó el pin y desde qué IP.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='pincodes_entregados',
    )
    ip = models.GenericIPAddressField('IP', null=True, blank=True)
    creado = models.DateTimeField('Fecha', auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'pin code usado'
        verbose_name_plural = 'pin codes usados'
        ordering = ['-creado']

    def __str__(self):
        return f'{self.mac_address} · {self.passcode} → {self.pin_code}'


class BulkSyncItem(models.Model):
    """Resultado de sincronizar un televisor dentro de un BulkSyncJob."""

    PENDIENTE = 'pendiente'
    OK = 'ok'
    ERROR = 'error'
    ESTADOS = [(PENDIENTE, 'Pendiente'), (OK, 'OK'), (ERROR, 'Error')]

    job = models.ForeignKey(BulkSyncJob, related_name='items', on_delete=models.CASCADE)
    televisor = models.ForeignKey(
        Televisor, null=True, blank=True, on_delete=models.SET_NULL
    )
    mac_address = models.CharField(max_length=50)
    inhabilitar = models.BooleanField()
    estado = models.CharField(max_length=10, choices=ESTADOS, default=PENDIENTE)
    mensaje = models.TextField(blank=True, default='')
    # Solo para modo validación: comparación portal vs app.
    remoto_inhabilitado = models.BooleanField(null=True, blank=True)
    local_inhabilitado = models.BooleanField(null=True, blank=True)
    coincide = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ['pk']

    def __str__(self):
        return f'{self.mac_address} ({self.estado})'
