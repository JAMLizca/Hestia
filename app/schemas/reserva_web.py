"""
Esquemas de las reservas en línea (página pública /reservar).
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.precheckin import TipoDocumento

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


class HuespedWeb(_Contacto):
    tipo_documento: TipoDocumento
    documento_identidad: str = Field(min_length=3, max_length=30)
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    email: EmailStr
    telefono: str = Field(min_length=7, max_length=30)
    nacionalidad: str | None = Field(default=None, max_length=60)

    @field_validator("nacionalidad", mode="before")
    @classmethod
    def _vacio_a_none(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v


class ReservaWebCreate(_Contacto):
    tipo_habitacion_id: int
    fecha_checkin: date
    fecha_checkout: date
    num_huespedes: int = Field(ge=1, le=MAX_HUESPEDES)
    huesped: HuespedWeb
    notas: str | None = Field(default=None, max_length=500)
    # Campo trampa: está oculto en el formulario; solo lo llenan los bots.
    sitio_web: str | None = Field(default=None, max_length=200)

    @field_validator("notas", mode="before")
    @classmethod
    def _notas(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v


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
