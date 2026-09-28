"""
CRUD del catálogo de servicios. Consultar: autenticado. Escribir: admin/gerente.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.servicio import Servicio
from app.schemas.servicio import ServicioCreate, ServicioOut, ServicioUpdate

router = APIRouter(prefix="/servicios", tags=["Servicios"], dependencies=[Depends(get_current_user)])


def _obtener_o_404(db: Session, servicio_id: int) -> Servicio:
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id).first()
    if not servicio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No existe un servicio con id {servicio_id}")
    return servicio


@router.get("/", response_model=list[ServicioOut])
def listar_servicios(db: Session = Depends(get_db)):
    return db.query(Servicio).all()


@router.get("/{servicio_id}", response_model=ServicioOut)
def obtener_servicio(servicio_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, servicio_id)


@router.post("/", response_model=ServicioOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("administrador", "gerente"))])
def crear_servicio(servicio_in: ServicioCreate, db: Session = Depends(get_db)):
    existe = db.query(Servicio).filter(Servicio.nombre == servicio_in.nombre).first()
    if existe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ya existe un servicio con el nombre '{servicio_in.nombre}'")
    nuevo = Servicio(**servicio_in.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{servicio_id}", response_model=ServicioOut, dependencies=[Depends(require_roles("administrador", "gerente"))])
def actualizar_servicio(servicio_id: int, servicio_in: ServicioUpdate, db: Session = Depends(get_db)):
    servicio = _obtener_o_404(db, servicio_id)
    for campo, valor in servicio_in.model_dump(exclude_unset=True).items():
        setattr(servicio, campo, valor)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.delete("/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles("administrador", "gerente"))])
def eliminar_servicio(servicio_id: int, db: Session = Depends(get_db)):
    servicio = _obtener_o_404(db, servicio_id)
    if servicio.reserva_servicios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar: hay reservas que consumieron este servicio")
    db.delete(servicio)
    db.commit()
