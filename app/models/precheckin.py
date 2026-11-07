"""
Modelo SQLAlchemy de la tabla `precheckins
"""
from sqlalchemy import JSON, CheckConstraint, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class PreCheckin(Base):
    __tablename__ = "precheckins"
    __table_args__ = (CheckConstraint("estado IN ('enviado', 'completado', 'validado')", name="ck_precheckins_estado"),)

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), unique=True, nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    estado = Column(String(20), nullable=False, default="enviado")
    datos = Column(JSON, nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_completado = Column(DateTime(timezone=True), nullable=True)
    fecha_validacion = Column(DateTime(timezone=True), nullable=True)
    validado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    reserva = relationship("Reserva", backref=backref("precheckin", uselist=False, lazy="selectin"))
