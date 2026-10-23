"""Catálogo de servicios del hotel."""
from sqlalchemy.orm import Session

from app.core.errores import NoEncontrado, SolicitudInvalida
from app.models.servicio import Servicio
from app.schemas.servicio import ServicioCreate, ServicioUpdate
from app.services._comun import confirmar_cambios

# Columnas NOT NULL: un null explícito en el PUT daría error 500 en la base de datos.
CAMPOS_OBLIGATORIOS = ("nombre", "precio")


def obtener(db: Session, servicio_id: int) -> Servicio:
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id).first()
    if not servicio:
        raise NoEncontrado(f"No existe un servicio con id {servicio_id}")
    return servicio


def listar(db: Session) -> list[Servicio]:
    return db.query(Servicio).all()


def crear(db: Session, datos: ServicioCreate) -> Servicio:
    if db.query(Servicio).filter(Servicio.nombre == datos.nombre).first():
        raise SolicitudInvalida(f"Ya existe un servicio con el nombre '{datos.nombre}'")
    nuevo = Servicio(**datos.model_dump())
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def editar(db: Session, servicio_id: int, datos_in: ServicioUpdate) -> Servicio:
    servicio = obtener(db, servicio_id)
    datos = datos_in.model_dump(exclude_unset=True)
    for campo in CAMPOS_OBLIGATORIOS:
        if campo in datos and datos[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")
    if "nombre" in datos and db.query(Servicio).filter(Servicio.nombre == datos["nombre"], Servicio.id != servicio_id).first():
        raise SolicitudInvalida(f"Ya existe un servicio con el nombre '{datos['nombre']}'")
    for campo, valor in datos.items():
        setattr(servicio, campo, valor)
    confirmar_cambios(db)
    db.refresh(servicio)
    return servicio


def eliminar(db: Session, servicio_id: int) -> None:
    servicio = obtener(db, servicio_id)
    if servicio.reserva_servicios:
        raise SolicitudInvalida("No se puede eliminar: hay reservas que consumieron este servicio")
    db.delete(servicio)
    confirmar_cambios(db)
