"""Modelos base abstractos, reutilizables por todas las apps del dominio.

Centralizar aquí las decisiones transversales (tipo de PK, auditoría de
tiempos) evita repetir campos y facilita cambiarlos de forma consistente a
medida que el proyecto crece.
"""
from __future__ import annotations

import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Añade marcas de tiempo de creación y actualización."""

    created_at = models.DateTimeField('creado', auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField('actualizado', auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class UUIDModel(models.Model):
    """Usa un UUID como clave primaria en lugar de un entero secuencial.

    Ventajas a gran escala:
    - No expone el volumen ni permite enumerar registros (seguridad).
    - Seguro para sistemas distribuidos / fusiones de bases de datos.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """Modelo base recomendado para las entidades del dominio."""

    class Meta:
        abstract = True
        ordering = ['-created_at']
