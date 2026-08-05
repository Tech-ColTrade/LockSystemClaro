from django.apps import AppConfig


class TelevisoresConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'televisores'
    verbose_name = 'Televisores'

    # El barrido de jobs huérfanos al arrancar NO va aquí: Django desaconseja
    # consultar la base durante la inicialización de las apps. Se hace en
    # `entrypoint.sh` con `manage.py cerrar_jobs_huerfanos`, que además corre
    # una sola vez por despliegue y no una por worker de gunicorn.
