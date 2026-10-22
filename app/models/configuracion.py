"""
Modelo SQLAlchemy de la tabla `configuracion_hotel`: ajustes generales del hotel.

Es una tabla de una sola fila (id = 1): el hotel es uno solo. Mientras no se
guarde nada, la API responde con los valores por defecto (ver schemas/configuracion.py).
"""
from sqlalchemy import Column, DateTime, Integer, String, Time
from sqlalchemy.sql import func

from app.db.base_class import Base

CONFIG_ID = 1


class ConfiguracionHotel(Base):
    __tablename__ = "configuracion_hotel"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(150), nullable=False)
    razon_social = Column(String(150), nullable=True)
    nit = Column(String(30), nullable=True)
    direccion = Column(String(200), nullable=True)
    ciudad = Column(String(100), nullable=True)
    pais = Column(String(100), nullable=True)
    telefono = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    sitio_web = Column(String(200), nullable=True)
    hora_checkin = Column(Time, nullable=False)
    hora_checkout = Column(Time, nullable=False)
    moneda = Column(String(3), nullable=False)
    zona_horaria = Column(String(50), nullable=False)
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
