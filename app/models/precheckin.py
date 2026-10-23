"""
Modelo SQLAlchemy de la tabla `precheckins`: el registro previo que el huésped completa desde
un enlace antes de llegar. Cada reserva tiene como máximo uno.

Los datos que envía el huésped se guardan tal cual en `datos` (JSON) y solo pasan al registro
del huésped cuando recepción los valida.
"""
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class PreCheckin(Base):
    __tablename__ = "precheckins"

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), unique=True, nullable=False)
    # Valor secreto de la URL pública. Se regenera si el enlace se filtra o se pierde.
    token = Column(String(64), unique=True, nullable=False, index=True)
    # enviado (enlace creado) → completado (el huésped envió sus datos) → validado (recepción los aplicó)
    estado = Column(String(20), nullable=False, default="enviado")
    datos = Column(JSON, nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_completado = Column(DateTime(timezone=True), nullable=True)
    fecha_validacion = Column(DateTime(timezone=True), nullable=True)
    validado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    reserva = relationship("Reserva", backref=backref("precheckin", uselist=False, lazy="selectin"))
