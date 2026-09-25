"""
Modelo SQLAlchemy de la tabla `huespedes`.
"""
from sqlalchemy import Column, Date, DateTime, Integer, String
from sqlalchemy.sql import func
from app.db.base_class import Base


class Huesped(Base):
    __tablename__ = "huespedes"

    id = Column(Integer, primary_key=True, index=True)
    documento_identidad = Column(String(30), unique=True, nullable=False, index=True)
    tipo_documento = Column(String(20), nullable=False, default="CC")
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    email = Column(String(150), nullable=True)
    telefono = Column(String(30), nullable=True)
    nacionalidad = Column(String(60), nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    preferencias = Column(String(255), nullable=True)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())