"""
Endpoints CRUD de la entidad Habitacion.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.habitacion import Habitacion
from app.models.tipo_habitacion import TipoHabitacion
from app.schemas.habitacion import EstadoHabitacion, HabitacionCreate, HabitacionOut, HabitacionUpdate

router = APIRouter(
    prefix="/habitaciones",
    tags=["Habitaciones"],
    dependencies=[Depends(get_current_user)],
)


def _obtener_o_404(db: Session, habitacion_id: int) -> Habitacion:
    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe una habitación con id {habitacion_id}",
        )
    return habitacion


@router.get("/", response_model=list[HabitacionOut], summary="Lista habitaciones (filtra opcionalmente por estado)")
def listar_habitaciones(
    estado: EstadoHabitacion | None = Query(default=None, description="Filtra por estado operativo"),
    db: Session = Depends(get_db),
):
    query = db.query(Habitacion)
    if estado:
        query = query.filter(Habitacion.estado == estado)
    return query.all()


@router.get("/{habitacion_id}", response_model=HabitacionOut, summary="Consulta una habitación por id")
def obtener_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, habitacion_id)


@router.post(
    "/",
    response_model=HabitacionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una nueva habitación (admin/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def crear_habitacion(habitacion_in: HabitacionCreate, db: Session = Depends(get_db)):
    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == habitacion_in.tipo_habitacion_id).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El tipo de habitación con id {habitacion_in.tipo_habitacion_id} no existe",
        )

    existe = db.query(Habitacion).filter(Habitacion.numero == habitacion_in.numero).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una habitación con el número '{habitacion_in.numero}'",
        )

    nueva_habitacion = Habitacion(**habitacion_in.model_dump())
    db.add(nueva_habitacion)
    db.commit()
    db.refresh(nueva_habitacion)
    return nueva_habitacion


@router.put(
    "/{habitacion_id}",
    response_model=HabitacionOut,
    summary="Actualiza una habitación (admin/gerente/recepcionista)",
    dependencies=[Depends(require_roles("administrador", "gerente", "recepcionista"))],
)
def actualizar_habitacion(habitacion_id: int, habitacion_in: HabitacionUpdate, db: Session = Depends(get_db)):
    habitacion = _obtener_o_404(db, habitacion_id)
    datos = habitacion_in.model_dump(exclude_unset=True)

    if "tipo_habitacion_id" in datos:
        tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == datos["tipo_habitacion_id"]).first()
        if not tipo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El tipo de habitación con id {datos['tipo_habitacion_id']} no existe",
            )

    for campo, valor in datos.items():
        setattr(habitacion, campo, valor)
    db.commit()
    db.refresh(habitacion)
    return habitacion


@router.delete(
    "/{habitacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una habitación (admin/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def eliminar_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    habitacion = _obtener_o_404(db, habitacion_id)
    db.delete(habitacion)
    db.commit()