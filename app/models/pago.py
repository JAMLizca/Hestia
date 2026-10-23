"""
Modelo SQLAlchemy de la tabla `pagos`. Una reserva puede tener varios pagos.
"""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Pago(Base):
    __tablename__ = "pagos"
    __table_args__ = (
        CheckConstraint("estado IN ('pagado', 'pendiente', 'rechazado', 'anulado')", name="ck_pagos_estado"),
        CheckConstraint("monto > 0", name="ck_pagos_monto"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    metodo_pago = Column(String(30), nullable=False)
    estado = Column(String(20), nullable=False, default="pagado")
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    # Pagos en línea: referencia que se envía a la pasarela y id de la transacción que ella devuelve.
    referencia = Column(String(64), unique=True, nullable=True)
    transaccion_id = Column(String(64), nullable=True)
    # Por qué se anuló el pago (RF-16): los pagos no se borran, se anulan dejando el motivo.
    motivo_anulacion = Column(String(200), nullable=True)

    reserva = relationship("Reserva", backref="pagos")