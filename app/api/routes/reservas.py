"""
Endpoints de la entidad Reserva. Solo traducen HTTP: las reglas están en app/services/reservas.py.

Las reservas pendientes que superan el plazo configurado se cancelan solas antes de
atender cualquier petición (ver app/core/vencimiento.py).
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.models.usuario import Usuario
from app.schemas.reserva import EstadoReserva, ReservaCreate, ReservaOut, ReservaUpdate
from app.services import reservas as servicio

router = APIRouter(
    prefix="/reservas",
    tags=["Reservas"],
    dependencies=[Depends(get_current_user), Depends(liberar_pendientes_vencidas)],
)


@router.get("/", response_model=list[ReservaOut], summary="Lista reservas (filtra opcionalmente)")
def listar_reservas(
    huesped_id: int | None = Query(default=None),
    habitacion_id: int | None = Query(default=None),
    estado: EstadoReserva | None = Query(default=None),
    codigo: str | None = Query(default=None, description="Código de la reserva (ej. HST-K7M4QX)"),
    db: Session = Depends(get_db),
):
    return servicio.listar(db, huesped_id=huesped_id, habitacion_id=habitacion_id, estado=estado, codigo=codigo)


@router.get("/{reserva_id}", response_model=ReservaOut, summary="Consulta una reserva por id")
def obtener_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, reserva_id)


@router.post(
    "/",
    response_model=ReservaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una nueva reserva (valida disponibilidad automáticamente)",
)
def crear_reserva(reserva_in: ReservaCreate, db: Session = Depends(get_db), usuario_actual: Usuario = Depends(get_current_user)):
    return servicio.crear(db, reserva_in, usuario_actual)


@router.put("/{reserva_id}", response_model=ReservaOut, summary="Edita una reserva (habitación, fechas, huéspedes, canal, notas, preferencias)")
def editar_reserva(reserva_id: int, datos: ReservaUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, reserva_id, datos)


@router.post("/{reserva_id}/confirmar", response_model=ReservaOut, summary="Confirma una reserva pendiente")
def confirmar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.confirmar(db, reserva_id)


@router.post("/{reserva_id}/checkin", response_model=ReservaOut, summary="Registra el check-in de una reserva")
def checkin_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.hacer_checkin(db, reserva_id)


@router.post("/{reserva_id}/checkout", response_model=ReservaOut, summary="Registra el check-out de una reserva")
def checkout_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.hacer_checkout(db, reserva_id)


@router.post("/{reserva_id}/cancelar", response_model=ReservaOut, summary="Cancela una reserva pendiente o confirmada")
def cancelar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.cancelar(db, reserva_id)


@router.post(
    "/{reserva_id}/no-show",
    response_model=ReservaOut,
    summary="Marca que el huésped no se presentó (reserva confirmada cuya llegada ya pasó)",
)
def no_show_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.marcar_no_show(db, reserva_id)


@router.delete(
    "/{reserva_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina definitivamente una reserva (solo administrador)",
)
def eliminar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, reserva_id)
