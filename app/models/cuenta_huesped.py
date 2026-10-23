"""
Modelo SQLAlchemy de la tabla `cuentas_huesped`.

Es la cuenta de quien reserva desde la página pública. Es una tabla aparte de `usuarios` (el personal):
así una cuenta de huésped no puede heredar permisos del panel por error, ni siquiera por tener el mismo id.
"""
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db.base_class import Base


class CuentaHuesped(Base):
    __tablename__ = "cuentas_huesped"

    id = Column(Integer, primary_key=True, index=True)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def nombre(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()
