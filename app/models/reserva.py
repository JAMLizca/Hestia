"""
Modelo SQLAlchemy de la tabla `reservas`.

"""
from sqlalchemy import JSON, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.cuenta_huesped import CuentaHuesped  # noqa: F401  (el mapper necesita conocerla)
from app.models.reserva_noche import ReservaNoche  # noqa: F401  (el mapper necesita conocerla)

ESTADOS = ("pendiente", "confirmada", "checkin", "checkout", "cancelada", "no_show")
CANALES = ("presencial", "telefono", "whatsapp", "correo", "web", "otro")
TEMPORADAS = ("alta", "media", "baja")


def _en(columna: str, valores: tuple[str, ...]) -> str:
    return f"{columna} IN ({', '.join(repr(v) for v in valores)})"


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        CheckConstraint(_en("estado", ESTADOS), name="ck_reservas_estado"),
        CheckConstraint(_en("canal", CANALES), name="ck_reservas_canal"),
        CheckConstraint(_en("temporada", TEMPORADAS), name="ck_reservas_temporada"),
        CheckConstraint("fecha_checkout_prevista > fecha_checkin_prevista", name="ck_reservas_fechas"),
        CheckConstraint("num_huespedes >= 1", name="ck_reservas_huespedes"),
        CheckConstraint("precio_total >= 0", name="ck_reservas_precio"),
    )

    id = Column(Integer, primary_key=True, index=True)
    huesped_id = Column(Integer, ForeignKey("huespedes.id"), nullable=False)
    habitacion_id = Column(Integer, ForeignKey("habitaciones.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    # Cuenta de huésped que hizo la reserva en línea (NULL si la tomó el personal).
    cuenta_id = Column(Integer, ForeignKey("cuentas_huesped.id"), nullable=True, index=True)

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
    # Datos para el análisis y los modelos de Machine Learning (RF-20).
    # Temporada según la fecha de llegada (ver app/services/temporada.py); se guarda para conservar el histórico.
    temporada = Column(String(10), nullable=False, default="baja", server_default="baja")
    # Preferencias del huésped para esta estadía: {"piso": "alto", "vista": "exterior", "cama": "doble",
    # "tranquila": true, "accesible": true}; solo trae las que el huésped pidió.
    preferencias = Column(JSON, nullable=True)
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
    cuenta = relationship("CuentaHuesped", backref="reservas")
    noches = relationship("ReservaNoche", back_populates="reserva", cascade="all, delete-orphan")