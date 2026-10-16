"""
Endpoints CRUD de la entidad Huesped.

"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.huesped import Huesped
from app.schemas.huesped import HuespedCreate, HuespedOut, HuespedUpdate

router = APIRouter(
    prefix="/huespedes",
    tags=["Huéspedes"],
    dependencies=[Depends(get_current_user)],
)


def _obtener_o_404(db: Session, huesped_id: int) -> Huesped:
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un huésped con id {huesped_id}",
        )
    return huesped



@router.get("/", response_model=list[HuespedOut], summary="Lista todos los huéspedes")
def listar_huespedes(db: Session = Depends(get_db)):
    return db.query(Huesped).all()


@router.get("/{huesped_id}", response_model=HuespedOut, summary="Consulta un huésped por id")
def obtener_huesped(huesped_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, huesped_id)


@router.post(
    "/",
    response_model=HuespedOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra un nuevo huésped",
)
def crear_huesped(huesped_in: HuespedCreate, db: Session = Depends(get_db)):
    existe = (
        db.query(Huesped)
        .filter(Huesped.documento_identidad == huesped_in.documento_identidad)
        .first()
    )
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un huésped con el documento '{huesped_in.documento_identidad}'",
        )
    nuevo_huesped = Huesped(**huesped_in.model_dump())
    db.add(nuevo_huesped)
    db.commit()
    db.refresh(nuevo_huesped)

    return nuevo_huesped


@router.put("/{huesped_id}", response_model=HuespedOut, summary="Actualiza los datos de un huésped")
def actualizar_huesped(huesped_id: int, huesped_in: HuespedUpdate, db: Session = Depends(get_db)):
    huesped = _obtener_o_404(db, huesped_id)
    datos = huesped_in.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        setattr(huesped, campo, valor)
    db.commit()
    db.refresh(huesped)
    return huesped


@router.delete(
    "/{huesped_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un huésped (solo administrador/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def eliminar_huesped(huesped_id: int, db: Session = Depends(get_db)):
    huesped = _obtener_o_404(db, huesped_id)
    if huesped.reservas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: el huésped tiene reservas asociadas",
        )
    db.delete(huesped)
    db.commit()
