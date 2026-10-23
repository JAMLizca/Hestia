"""
Modelo SQLAlchemy de la tabla `tipos_habitacion`.
"""
from sqlalchemy import CheckConstraint, Column, Integer, Numeric, String

from app.db.base_class import Base


class TipoHabitacion(Base):
    __tablename__ = "tipos_habitacion"
    __table_args__ = (
        CheckConstraint("capacidad_maxima >= 1", name="ck_tipos_habitacion_capacidad"),
        CheckConstraint("precio_base >= 0", name="ck_tipos_habitacion_precio"),
    )

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    capacidad_maxima = Column(Integer, nullable=False)
    precio_base = Column(Numeric(10, 2), nullable=False)
    camas = Column(Integer, nullable=False, default=1)
    metros_cuadrados = Column(Numeric(6, 2), nullable=True)