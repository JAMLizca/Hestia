"""
Endpoints CRUD de habitaciones. Consultar: cualquier usuario autenticado. Crear, editar y eliminar: solo recepción. Las reglas están en app/services/habitaciones.py.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.habitacion import EstadoHabitacion, HabitacionCreate, HabitacionOut, HabitacionUpdate
from app.services import habitaciones as servicio

router = APIRouter(prefix="/habitaciones", tags=["Habitaciones"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[HabitacionOut], summary="Lista habitaciones (filtra opcionalmente por estado)")
def listar_habitaciones(estado: EstadoHabitacion | None = Query(default=None, description="Filtra por estado operativo"), db: Session = Depends(get_db)):
    return servicio.listar(db, estado)


@router.get("/{habitacion_id}", response_model=HabitacionOut, summary="Consulta una habitación por id")
def obtener_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, habitacion_id)


@router.post(
    "/",
    response_model=HabitacionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una nueva habitación (solo recepción)",
)
def crear_habitacion(habitacion_in: HabitacionCreate, db: Session = Depends(get_db)):
    return servicio.crear(db, habitacion_in)


@router.put(
    "/{habitacion_id}",
    response_model=HabitacionOut,
    summary="Actualiza una habitación (solo recepción)",
)
def actualizar_habitacion(habitacion_id: int, habitacion_in: HabitacionUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, habitacion_id, habitacion_in)


@router.delete(
    "/{habitacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una habitación (solo recepción)",
)
def eliminar_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, habitacion_id)
