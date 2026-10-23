"""
CRUD del catálogo de servicios. Consultar: autenticado. Escribir: solo recepción.
Las reglas están en app/services/servicios.py.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.schemas.servicio import ServicioCreate, ServicioOut, ServicioUpdate
from app.services import servicios as servicio

router = APIRouter(prefix="/servicios", tags=["Servicios"], dependencies=[Depends(get_current_user)])

_SOLO_RECEPCION = [Depends(require_roles("recepcionista"))]


@router.get("/", response_model=list[ServicioOut])
def listar_servicios(db: Session = Depends(get_db)):
    return servicio.listar(db)


@router.get("/{servicio_id}", response_model=ServicioOut)
def obtener_servicio(servicio_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, servicio_id)


@router.post("/", response_model=ServicioOut, status_code=status.HTTP_201_CREATED, dependencies=_SOLO_RECEPCION)
def crear_servicio(servicio_in: ServicioCreate, db: Session = Depends(get_db)):
    return servicio.crear(db, servicio_in)


@router.put("/{servicio_id}", response_model=ServicioOut, dependencies=_SOLO_RECEPCION)
def actualizar_servicio(servicio_id: int, servicio_in: ServicioUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, servicio_id, servicio_in)


@router.delete("/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_SOLO_RECEPCION)
def eliminar_servicio(servicio_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, servicio_id)
