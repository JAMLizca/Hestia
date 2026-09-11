"""
Modelo SQLAlchemy de la tabla huespedes.
"""
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db.base_class import Base


class Huesped(Base):
    __tablename__ = "huespedes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    tipo_documento = Column(String(20), nullable=False)
    numero_documento = Column(String(30), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=True)
    telefono = Column(String(20), nullable=True)
    nacionalidad = Column(String(50), nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    direccion = Column(String(255), nullable=True)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)