"""
Modelo SQLAlchemy de la tabla `reservas`.

"""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, index=True)
    huesped_id = Column(Integer, ForeignKey("huespedes.id"), nullable=False)
    habitacion_id = Column(Integer, ForeignKey("habitaciones.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    fecha_checkin_prevista = Column(Date, nullable=False)
    fecha_checkout_prevista = Column(Date, nullable=False)
    fecha_checkin_real = Column(DateTime(timezone=True), nullable=True)
    fecha_checkout_real = Column(DateTime(timezone=True), nullable=True)

    num_huespedes = Column(Integer, nullable=False)
    # Valores esperados: pendiente | confirmada | checkin | checkout | cancelada | no_show
    estado = Column(String(20), nullable=False, default="pendiente")
    precio_total = Column(Numeric(10, 2), nullable=False)

    # Código legible para que el huésped lo cite al llamar (ej. HST-K7M4QX).
    codigo = Column(String(12), unique=True, nullable=False)
    # Cómo llegó la reserva: presencial | telefono | whatsapp | correo | web | otro
    canal = Column(String(20), nullable=False, default="presencial", server_default="presencial")
    notas = Column(String(500), nullable=True)
    # Solo se llena cuando el sistema cancela sola una reserva pendiente que venció.
    motivo_cancelacion = Column(String(100), nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def precheckin_estado(self) -> str | None:
        """Estado del pre-check-in (enviado | completado | validado) o None si no se ha creado."""
        return self.precheckin.estado if self.precheckin else None

    huesped = relationship("Huesped", backref="reservas")
    habitacion = relationship("Habitacion", backref="reservas")
    usuario = relationship("Usuario", backref="reservas")