"""
Modelo SQLAlchemy de la tabla `servicios` (catálogo).
"""
from sqlalchemy import Column, Integer, Numeric, String

from app.db.base_class import Base


class Servicio(Base):
    __tablename__ = "servicios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    precio = Column(Numeric(10, 2), nullable=False)
    categoria = Column(String(50), nullable=True)