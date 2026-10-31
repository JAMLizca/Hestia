"""Respuestas de Hestia Intelligence (predicción de ocupación y recomendación de habitaciones)."""
from datetime import date

from pydantic import BaseModel


class DiaPronostico(BaseModel):
    fecha: date
    ocupacion_pct: float
    horizonte_dias: int  # con cuántos días de anticipación se hace la predicción de ese día


class PrediccionOcupacion(BaseModel):
    desde: date
    dias: list[DiaPronostico]
    promedio_pct: float
    dia_pico: date
    dia_pico_pct: float
    confianza_pct: int  # % de los días de prueba en que el modelo se equivocó por menos de 10 puntos
    error_medio_pp: float  # error medio del modelo (puntos de ocupación) en los días de prueba
    habitaciones: int
    entrenado: str | None = None


class RecomendacionOut(BaseModel):
    tipo_habitacion_id: int
    tipo: str
    habitacion_id: int | None = None  # None en la versión pública: el huésped elige tipo y recepción asigna la habitación
    numero: str | None = None
    piso: int | None = None
    precio_noche: float
    afinidad_pct: int  # reparte 100 entre los tipos disponibles que caben al grupo
    motivos: list[str]
    disponibles: int  # habitaciones libres de ese tipo en las fechas pedidas
