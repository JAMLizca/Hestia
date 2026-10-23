"""
Modelo SQLAlchemy de la tabla `habitaciones`.
"""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Habitacion(Base):
    __tablename__ = "habitaciones"
    __table_args__ = (
        CheckConstraint("estado IN ('disponible', 'ocupada', 'mantenimiento', 'limpieza')", name="ck_habitaciones_estado"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tipo_habitacion_id = Column(Integer, ForeignKey("tipos_habitacion.id"), nullable=False)
    numero = Column(String(10), unique=True, nullable=False)
    piso = Column(Integer, nullable=True)
    
    # Valores esperados: disponible | ocupada | mantenimiento | limpieza
    
    estado = Column(String(20), nullable=False, default="disponible")
    caracteristicas = Column(String(255), nullable=True)

    tipo_habitacion = relationship("TipoHabitacion", backref="habitaciones")