"""
Endpoints de la entidad Reserva.

"""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.habitacion import Habitacion
from app.models.huesped import Huesped
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.reserva import EstadoReserva, ReservaCreate, ReservaOut

router = APIRouter(
    prefix="/reservas",
    tags=["Reservas"],
    dependencies=[Depends(get_current_user)],
)

# Solo estas reservas "bloquean" una habitación al validar disponibilidad.
# Una reserva cancelada, o ya finalizada (checkout), no genera coflicto.
ESTADOS_QUE_BLOQUEAN = ("pendiente", "confirmada", "checkin")


def _obtener_o_404(db: Session, reserva_id: int) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe una reserva con id {reserva_id}",
        )
    return reserva


def _hay_solapamiento(
    db: Session,
    habitacion_id: int,
    checkin: date,
    checkout: date,
    excluir_reserva_id: int | None = None,
) -> bool:
   
    query = db.query(Reserva).filter(
        Reserva.habitacion_id == habitacion_id,
        Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
        Reserva.fecha_checkin_prevista < checkout,
        Reserva.fecha_checkout_prevista > checkin,
    )
    if excluir_reserva_id is not None:
        query = query.filter(Reserva.id != excluir_reserva_id)
    return db.query(query.exists()).scalar()


@router.get("/", response_model=list[ReservaOut], summary="Lista reservas (filtra opcionalmente)")
def listar_reservas(
    huesped_id: int | None = Query(default=None),
    habitacion_id: int | None = Query(default=None),
    estado: EstadoReserva | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Reserva)
    if huesped_id:
        query = query.filter(Reserva.huesped_id == huesped_id)
    if habitacion_id:
        query = query.filter(Reserva.habitacion_id == habitacion_id)
    if estado:
        query = query.filter(Reserva.estado == estado)
    return query.all()


@router.get("/{reserva_id}", response_model=ReservaOut, summary="Consulta una reserva por id")
def obtener_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, reserva_id)


@router.post(
    "/",
    response_model=ReservaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una nueva reserva (valida disponibilidad automáticamente)",
)
def crear_reserva(
    reserva_in: ReservaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
   
    huesped = db.query(Huesped).filter(Huesped.id == reserva_in.huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El huésped con id {reserva_in.huesped_id} no existe",
        )

    habitacion = db.query(Habitacion).filter(Habitacion.id == reserva_in.habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La habitación con id {reserva_in.habitacion_id} no existe",
        )

    if habitacion.estado == "mantenimiento":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La habitación está en mantenimiento y no se puede reservar",
        )

    if _hay_solapamiento(
        db,
        reserva_in.habitacion_id,
        reserva_in.fecha_checkin_prevista,
        reserva_in.fecha_checkout_prevista,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La habitación ya está reservada en ese rango de fechas",
        )

    noches = (reserva_in.fecha_checkout_prevista - reserva_in.fecha_checkin_prevista).days
    precio_total = habitacion.tipo_habitacion.precio_base * noches

    nueva_reserva = Reserva(
        huesped_id=reserva_in.huesped_id,
        habitacion_id=reserva_in.habitacion_id,
        usuario_id=usuario_actual.id,
        fecha_checkin_prevista=reserva_in.fecha_checkin_prevista,
        fecha_checkout_prevista=reserva_in.fecha_checkout_prevista,
        num_huespedes=reserva_in.num_huespedes,
        estado="pendiente",
        precio_total=precio_total,
    )
    db.add(nueva_reserva)
    db.commit()
    db.refresh(nueva_reserva)
    return nueva_reserva


@router.post(
    "/{reserva_id}/confirmar",
    response_model=ReservaOut,
    summary="Confirma una reserva pendiente",
)
def confirmar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    if reserva.estado != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede confirmar una reserva en estado 'pendiente' (actual: '{reserva.estado}')",
        )
    reserva.estado = "confirmada"
    db.commit()
    db.refresh(reserva)
    return reserva


@router.post(
    "/{reserva_id}/checkin",
    response_model=ReservaOut,
    summary="Registra el check-in de una reserva",
)
def checkin_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    if reserva.estado != "confirmada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede hacer check-in de una reserva 'confirmada' (actual: '{reserva.estado}')",
        )
    reserva.estado = "checkin"
    reserva.fecha_checkin_real = datetime.now(timezone.utc)
    reserva.habitacion.estado = "ocupada"
    db.commit()
    db.refresh(reserva)
    return reserva


@router.post(
    "/{reserva_id}/checkout",
    response_model=ReservaOut,
    summary="Registra el check-out de una reserva",
)
def checkout_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    if reserva.estado != "checkin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede hacer check-out de una reserva en 'checkin' (actual: '{reserva.estado}')",
        )
    reserva.estado = "checkout"
    reserva.fecha_checkout_real = datetime.now(timezone.utc)
    # Al hacer checkout, la habitación pasa a limpieza, no directo a disponible.
    reserva.habitacion.estado = "limpieza"
    db.commit()
    db.refresh(reserva)
    return reserva


@router.post(
    "/{reserva_id}/cancelar",
    response_model=ReservaOut,
    summary="Cancela una reserva pendiente o confirmada",
)
def cancelar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    if reserva.estado not in ("pendiente", "confirmada"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede cancelar una reserva en estado '{reserva.estado}'",
        )
    reserva.estado = "cancelada"
    db.commit()
    db.refresh(reserva)
    return reserva


@router.delete(
    "/{reserva_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina definitivamente una reserva (solo administrador)",
    dependencies=[Depends(require_roles("administrador"))],
)
def eliminar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    db.delete(reserva)
    db.commit()
