"""
Modelo SQLAlchemy de la tabla `configuracion_hotel`: ajustes generales del hotel.
"""
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Time
from sqlalchemy.sql import expression
from sqlalchemy.sql import func

from app.db.base_class import Base

CONFIG_ID = 1


class ConfiguracionHotel(Base):
    __tablename__ = "configuracion_hotel"
    __table_args__ = (
        CheckConstraint("horas_vencimiento_pendiente BETWEEN 0 AND 720", name="ck_configuracion_horas"),
        CheckConstraint("anticipo_porcentaje BETWEEN 0 AND 100", name="ck_configuracion_anticipo"),
    )

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
    horas_vencimiento_pendiente = Column(Integer, nullable=False, default=24, server_default="24")
    reservas_web_activas = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    anticipo_porcentaje = Column(Integer, nullable=False, default=0, server_default="0")
    moneda = Column(String(3), nullable=False)
    zona_horaria = Column(String(50), nullable=False)
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
