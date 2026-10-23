"""Tipos de habitación: consulta, alta, edición y baja."""
from sqlalchemy.orm import Session

from app.core.errores import NoEncontrado, SolicitudInvalida
from app.models.tipo_habitacion import TipoHabitacion
from app.schemas.tipo_habitacion import TipoHabitacionCreate, TipoHabitacionUpdate
from app.services._comun import confirmar_cambios

# Columnas NOT NULL: un null explícito en el PUT daría error 500 en la base de datos.
CAMPOS_OBLIGATORIOS = ("nombre", "capacidad_maxima", "precio_base", "camas")


def obtener(db: Session, tipo_id: int) -> TipoHabitacion:
    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == tipo_id).first()
    if not tipo:
        raise NoEncontrado(f"No existe un tipo de habitación con id {tipo_id}")
    return tipo


def listar(db: Session) -> list[TipoHabitacion]:
    return db.query(TipoHabitacion).all()


def crear(db: Session, datos: TipoHabitacionCreate) -> TipoHabitacion:
    if db.query(TipoHabitacion).filter(TipoHabitacion.nombre == datos.nombre).first():
        raise SolicitudInvalida(f"Ya existe un tipo de habitación con el nombre '{datos.nombre}'")
    nuevo = TipoHabitacion(**datos.model_dump())
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def editar(db: Session, tipo_id: int, datos_in: TipoHabitacionUpdate) -> TipoHabitacion:
    tipo = obtener(db, tipo_id)
    datos = datos_in.model_dump(exclude_unset=True)
    for campo in CAMPOS_OBLIGATORIOS:
        if campo in datos and datos[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")
    if "nombre" in datos and db.query(TipoHabitacion).filter(TipoHabitacion.nombre == datos["nombre"], TipoHabitacion.id != tipo_id).first():
        raise SolicitudInvalida(f"Ya existe un tipo de habitación con el nombre '{datos['nombre']}'")
    for campo, valor in datos.items():
        setattr(tipo, campo, valor)
    confirmar_cambios(db)
    db.refresh(tipo)
    return tipo


def eliminar(db: Session, tipo_id: int) -> None:
    tipo = obtener(db, tipo_id)
    if tipo.habitaciones:
        raise SolicitudInvalida("No se puede eliminar: hay habitaciones asociadas a este tipo")
    db.delete(tipo)
    confirmar_cambios(db)
