"""
Modelo SQLAlchemy de la tabla `reserva_noches`: una fila por cada noche que una reserva «bloquea» una habitación.

Sirve para que la base de datos misma impida dos reservas simultáneas en una habitación (MySQL no tiene
restricciones de exclusión por rango): la restricción UNIQUE (habitacion_id, fecha) rechaza la segunda,
aunque dos peticiones lleguen a la vez. Las filas las mantiene app/services/ocupacion.py: no se escriben a mano.
Una reserva solo tiene filas mientras está pendiente, confirmada o en check-in; la noche de salida no cuenta.
"""
from sqlalchemy import Column, Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ReservaNoche(Base):
    __tablename__ = "reserva_noches"
    __table_args__ = (UniqueConstraint("habitacion_id", "fecha", name="uq_reserva_noches_habitacion_fecha"),)

    id = Column(Integer, primary_key=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id", ondelete="CASCADE"), nullable=False, index=True)
    habitacion_id = Column(Integer, ForeignKey("habitaciones.id"), nullable=False)
    fecha = Column(Date, nullable=False)

    reserva = relationship("Reserva", back_populates="noches")
