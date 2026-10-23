"""
Modelo SQLAlchemy de la tabla `pagos`. Una reserva puede tener varios pagos.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    metodo_pago = Column(String(30), nullable=False)
    estado = Column(String(20), nullable=False, default="pagado")
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    # Pagos en línea: referencia que se envía a la pasarela y id de la transacción que ella devuelve.
    referencia = Column(String(64), unique=True, nullable=True)
    transaccion_id = Column(String(64), nullable=True)

    reserva = relationship("Reserva", backref="pagos")