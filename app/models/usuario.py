"""
Modelo SQLAlchemy de la tabla `usuarios`.
"""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    rol = relationship("Role", backref="usuarios")