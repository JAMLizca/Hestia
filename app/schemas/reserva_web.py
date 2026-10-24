"""
Esquemas de las reservas en línea (página pública /reservar).
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError, field_validator, model_validator

from app.schemas.precheckin import Acompanante, MotivoViaje, PreCheckinEnvio, Titular
from app.schemas.reserva import PreferenciasReserva

MAX_NOCHES = 30
MAX_DIAS_ANTICIPACION = 365
MAX_HUESPEDES = 10


class HotelPublico(BaseModel):
    nombre: str
    ciudad: str | None = None
    pais: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None
    hora_checkin: str
    hora_checkout: str
    moneda: str
    reservas_activas: bool
    horas_vencimiento: int  # 0 = las reservas pendientes no vencen
    pagos_activos: bool = False  # hay pasarela configurada y anticipo > 0
    anticipo_porcentaje: int = 0


class TipoPublico(BaseModel):
    """Una habitación de la oferta del hotel, sin números de habitación ni disponibilidad."""

    tipo_habitacion_id: int
    nombre: str
    descripcion: str | None = None
    capacidad_maxima: int
    camas: int
    metros_cuadrados: Decimal | None = None
    precio_noche: Decimal
    habitaciones: int  # cuántas habitaciones de este tipo tiene el hotel


class ServicioPublico(BaseModel):
    nombre: str
    descripcion: str | None = None
    categoria: str | None = None
    precio: Decimal


class CatalogoPublico(BaseModel):
    tipos: list[TipoPublico]
    servicios: list[ServicioPublico]


class TipoDisponible(BaseModel):
    tipo_habitacion_id: int
    nombre: str
    descripcion: str | None = None
    capacidad_maxima: int
    camas: int
    metros_cuadrados: Decimal | None = None
    precio_noche: Decimal
    noches: int
    precio_total: Decimal
    disponibles: int


class _Contacto(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# El titular de la reserva en línea es el mismo de un pre-check-in (documento, nombre, nacionalidad, nacimiento,
# teléfono, correo y procedencia): reservar y registrarse son un solo paso.
HuespedWeb = Titular


class ReservaWebCreate(_Contacto):
    tipo_habitacion_id: int
    fecha_checkin: date
    fecha_checkout: date
    num_huespedes: int = Field(ge=1, le=MAX_HUESPEDES)
    huesped: HuespedWeb
    # Registro de alojamiento (lo que antes era el pre-check-in aparte): acompañantes y datos de la llegada.
    acompanantes: list[Acompanante] = Field(default_factory=list, max_length=MAX_HUESPEDES - 1)
    hora_llegada: time | None = None
    motivo_viaje: MotivoViaje | None = None
    notas: str | None = Field(default=None, max_length=500)
    preferencias: PreferenciasReserva | None = None
    # Campo trampa: está oculto en el formulario; solo lo llenan los bots.
    sitio_web: str | None = Field(default=None, max_length=200)

    @field_validator("notas", mode="before")
    @classmethod
    def _notas(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v

    def registro(self) -> PreCheckinEnvio:
        """Los datos del registro de alojamiento, en el formato del pre-check-in (valida que no se repitan documentos)."""
        return PreCheckinEnvio(
            titular=self.huesped.model_dump(),
            acompanantes=[a.model_dump() for a in self.acompanantes],
            hora_llegada=self.hora_llegada,
            motivo_viaje=self.motivo_viaje,
            notas=self.notas,
        )

    @model_validator(mode="after")
    def _registro_coherente(self):
        maximo = self.num_huespedes - 1
        if len(self.acompanantes) > maximo:
            raise ValueError(
                f"La reserva es para {self.num_huespedes} {'persona' if self.num_huespedes == 1 else 'personas'}: "
                f"puedes registrar hasta {maximo} {'acompañante' if maximo == 1 else 'acompañantes'}."
            )
        try:
            self.registro()
        except ValidationError as exc:
            raise ValueError(exc.errors()[0]["msg"].removeprefix("Value error, ")) from None
        return self


class ConsultaWeb(_Contacto):
    codigo: str = Field(min_length=6, max_length=12)
    documento_identidad: str = Field(min_length=3, max_length=30)


class ReservaWebOut(BaseModel):
    codigo: str
    estado: str
    tipo_habitacion: str
    fecha_checkin: date
    fecha_checkout: date
    noches: int
    num_huespedes: int
    precio_total: Decimal
    moneda: str
    hora_checkin: str
    # Horas que tiene el hotel para confirmar antes de que la reserva pendiente venza (0 = no vence).
    horas_vencimiento: int
    puede_cancelar: bool
    motivo_cancelacion: str | None = None
    precheckin_enlace: str | None = None
    # Estado del registro de alojamiento: enviado (falta que el huésped lo complete) | completado | validado.
    registro: str | None = None
    # Pago en línea del anticipo (solo si el hotel lo tiene activo).
    puede_pagar: bool = False
    anticipo_monto: Decimal | None = None
    pagado: Decimal = Decimal("0")
    hotel_telefono: str | None = None
    hotel_email: str | None = None


class VerificarPago(ConsultaWeb):
    transaccion_id: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class PagoIniciado(BaseModel):
    url: str
    referencia: str
    monto: Decimal
    moneda: str
