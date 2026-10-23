"""Habitaciones: consulta, alta, edición y baja."""
from sqlalchemy.orm import Session

from app.core.errores import Conflicto, NoEncontrado, SolicitudInvalida
from app.models.habitacion import Habitacion
from app.models.reserva import Reserva
from app.models.tipo_habitacion import TipoHabitacion
from app.schemas.habitacion import HabitacionCreate, HabitacionUpdate
from app.services._comun import confirmar_cambios


def obtener(db: Session, habitacion_id: int) -> Habitacion:
    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise NoEncontrado(f"No existe una habitación con id {habitacion_id}")
    return habitacion


def listar(db: Session, estado: str | None = None) -> list[Habitacion]:
    consulta = db.query(Habitacion)
    if estado:
        consulta = consulta.filter(Habitacion.estado == estado)
    return consulta.all()


def crear(db: Session, datos: HabitacionCreate) -> Habitacion:
    if not db.query(TipoHabitacion).filter(TipoHabitacion.id == datos.tipo_habitacion_id).first():
        raise SolicitudInvalida(f"El tipo de habitación con id {datos.tipo_habitacion_id} no existe")
    if db.query(Habitacion).filter(Habitacion.numero == datos.numero).first():
        raise SolicitudInvalida(f"Ya existe una habitación con el número '{datos.numero}'")
    nueva = Habitacion(**datos.model_dump())
    db.add(nueva)
    confirmar_cambios(db)
    db.refresh(nueva)
    return nueva


def editar(db: Session, habitacion_id: int, datos_in: HabitacionUpdate) -> Habitacion:
    habitacion = obtener(db, habitacion_id)
    datos = datos_in.model_dump(exclude_unset=True)

    # Estos dos campos son NOT NULL en la base de datos: un null explícito daría error 500.
    for campo in ("tipo_habitacion_id", "estado"):
        if campo in datos and datos[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")

    # Con un huésped alojado (reserva en 'checkin') la habitación debe seguir 'ocupada'. El estado cambia solo con
    # el check-out; así no se salta la validación del check-in.
    if "estado" in datos and datos["estado"] != habitacion.estado:
        alojado = db.query(db.query(Reserva).filter(Reserva.habitacion_id == habitacion_id, Reserva.estado == "checkin").exists()).scalar()
        if alojado and datos["estado"] != "ocupada":
            raise Conflicto("La habitación tiene un huésped alojado (check-in activo); registra primero el check-out")

    if "tipo_habitacion_id" in datos and not db.query(TipoHabitacion).filter(TipoHabitacion.id == datos["tipo_habitacion_id"]).first():
        raise SolicitudInvalida(f"El tipo de habitación con id {datos['tipo_habitacion_id']} no existe")

    for campo, valor in datos.items():
        setattr(habitacion, campo, valor)
    confirmar_cambios(db)
    db.refresh(habitacion)
    return habitacion


def eliminar(db: Session, habitacion_id: int) -> None:
    habitacion = obtener(db, habitacion_id)
    if habitacion.reservas:
        raise SolicitudInvalida("No se puede eliminar: la habitación tiene reservas asociadas")
    db.delete(habitacion)
    confirmar_cambios(db)
