"""
Tabla puente entre Reserva y Servicio. El precio_unitario secongela al
momento de agregar el servicio (no cambia si lugo cambia el catálogo).
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class ReservaServicio(Base):
    __tablename__ = "reserva_servicios"

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=False)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    fecha_consumo = Column(DateTime(timezone=True), server_default=func.now())

    reserva = relationship("Reserva", backref="reserva_servicios")
    servicio = relationship("Servicio", backref="reserva_servicios")