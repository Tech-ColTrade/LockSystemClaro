"""Cierra los jobs de sincronización que se quedaron colgados.

Se ejecuta en `entrypoint.sh` antes de arrancar gunicorn: tras un redespliegue,
los hilos del proceso anterior ya no existen, pero sus filas siguen en
`corriendo` y quien haga polling esperaría un final que no llega.

También sirve a mano:

    python manage.py cerrar_jobs_huerfanos
    python manage.py cerrar_jobs_huerfanos --minutos 30
"""
from django.core.management.base import BaseCommand

from televisores.watchdog import marcar_huerfanos


class Command(BaseCommand):
    help = 'Marca como error los jobs de sincronización que ya no dan señales de vida.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutos',
            type=int,
            default=None,
            help=(
                'Minutos sin latido para darlos por muertos. Por defecto usa '
                'JOBS_TIMEOUT_MINUTOS (10).'
            ),
        )

    def handle(self, *args, **opciones):
        cerrados = marcar_huerfanos(minutos=opciones.get('minutos'))
        if cerrados:
            self.stdout.write(
                self.style.WARNING(f'{cerrados} job(s) huérfano(s) cerrados.')
            )
        else:
            self.stdout.write('No había jobs huérfanos.')
