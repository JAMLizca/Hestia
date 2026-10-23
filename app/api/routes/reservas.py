"""
Endpoints de la entidad Reserva.

Las reservas pendientes que superan el plazo configurado se cancelan solas antes de
atender cualquier petición (ver app/core/vencimiento.py).
"""
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas, require_roles
from app.models.habitacion import Habitacion
from app.models.huesped import Huesped
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.reserva import EstadoReserva, ReservaCreate, ReservaOut, ReservaUpdate

router = APIRouter(
    prefix="/reservas",
    tags=["Reservas"],
    dependencies=[Depends(get_current_user), Depends(liberar_pendientes_vencidas)],
)

# Solo estas reservas "bloquean" una habitación al validar disponibilidad.
# Una reserva cancelada, o ya finalizada (checkout), no genera coflicto.
ESTADOS_QUE_BLOQUEAN = ("pendiente", "confirmada", "checkin")


# Sin 0/O ni 1/I/L: el código se dicta por teléfono y no debe confundirse.
_ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generar_codigo(db: Session) -> str:
    """Código corto y legible (HST-K7M4QX) que el huésped puede citar al llamar."""
    for _ in range(20):
        codigo = "HST-" + "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(6))
        if not db.query(Reserva.id).filter(Reserva.codigo == codigo).first():
            return codigo
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo generar un código de reserva único. Intenta de nuevo",
    )


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
    codigo: str | None = Query(default=None, description="Código de la reserva (ej. HST-K7M4QX)"),
    db: Session = Depends(get_db),
):
    query = db.query(Reserva)
    if huesped_id:
        query = query.filter(Reserva.huesped_id == huesped_id)
    if habitacion_id:
        query = query.filter(Reserva.habitacion_id == habitacion_id)
    if estado:
        query = query.filter(Reserva.estado == estado)
    if codigo:
        query = query.filter(Reserva.codigo == codigo.strip().upper())
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

    if reserva_in.fecha_checkin_prevista < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de check-in no puede ser pasada",
        )

    capacidad = habitacion.tipo_habitacion.capacidad_maxima
    if reserva_in.num_huespedes > capacidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La habitación admite máximo {capacidad} huéspedes",
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
        codigo=_generar_codigo(db),
        canal=reserva_in.canal,
        notas=reserva_in.notas,
    )
    db.add(nueva_reserva)
    db.commit()
    db.refresh(nueva_reserva)
    return nueva_reserva


# Qué se puede cambiar según el estado de la reserva.
_CAMPOS_EDITABLES = {
    "pendiente": {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal", "notas"},
    "confirmada": {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal", "notas"},
    "checkin": {"fecha_checkout_prevista", "num_huespedes", "notas"},
}


@router.put(
    "/{reserva_id}",
    response_model=ReservaOut,
    summary="Edita una reserva (habitación, fechas, huéspedes, canal, notas)",
)
def editar_reserva(reserva_id: int, datos: ReservaUpdate, db: Session = Depends(get_db)):
    """
    Edición parcial. Mientras la reserva está pendiente o confirmada se puede cambiar casi
    todo; en check-in solo la salida prevista, el número de huéspedes y las notas; en
    cualquier otro estado, solo las notas. El precio se recalcula con la tarifa vigente.
    """
    reserva = _obtener_o_404(db, reserva_id)
    cambios = datos.model_dump(exclude_unset=True)
    # Un campo enviado con el mismo valor que ya tiene no es un cambio.
    cambios = {k: v for k, v in cambios.items() if v != getattr(reserva, k)}
    if not cambios:
        return reserva

    permitidos = _CAMPOS_EDITABLES.get(reserva.estado, {"notas"})
    no_permitidos = set(cambios) - permitidos
    if no_permitidos:
        if reserva.estado in _CAMPOS_EDITABLES:
            detalle = f"En una reserva '{reserva.estado}' no se puede cambiar: {', '.join(sorted(no_permitidos))}"
        else:
            detalle = f"Una reserva '{reserva.estado}' ya no se puede modificar; solo se pueden editar las notas"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detalle)
    for campo in ("habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal"):
        if campo in cambios and cambios[campo] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El campo '{campo}' no puede ser nulo")

    habitacion_id = cambios.get("habitacion_id", reserva.habitacion_id)
    checkin = cambios.get("fecha_checkin_prevista", reserva.fecha_checkin_prevista)
    checkout = cambios.get("fecha_checkout_prevista", reserva.fecha_checkout_prevista)
    num_huespedes = cambios.get("num_huespedes", reserva.num_huespedes)

    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La habitación con id {habitacion_id} no existe")
    if "habitacion_id" in cambios and habitacion.estado == "mantenimiento":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La habitación está en mantenimiento y no se puede reservar")
    if checkout <= checkin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La fecha de checkout debe ser posterior a la de checkin")
    if "fecha_checkin_prevista" in cambios and checkin < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La fecha de check-in no puede ser pasada")

    capacidad = habitacion.tipo_habitacion.capacidad_maxima
    if num_huespedes > capacidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La habitación admite máximo {capacidad} huéspedes")

    if reserva.estado in ESTADOS_QUE_BLOQUEAN and _hay_solapamiento(db, habitacion_id, checkin, checkout, excluir_reserva_id=reserva.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La habitación ya está reservada en ese rango de fechas")

    precio_total = reserva.precio_total
    if {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista"} & set(cambios):
        precio_total = habitacion.tipo_habitacion.precio_base * (checkout - checkin).days
        pagado = sum((p.monto for p in reserva.pagos if p.estado == "pagado"), Decimal("0"))
        if precio_total < pagado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El nuevo total ({precio_total}) es menor que lo ya pagado ({pagado}). Gestiona primero ese pago",
            )

    for campo, valor in cambios.items():
        setattr(reserva, campo, valor)
    reserva.precio_total = precio_total
    db.commit()
    db.refresh(reserva)
    return reserva


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
    # La habitación debe estar libre: evita dos huéspedes en la misma habitación
    # y que se haga check-in sobre una habitación sin limpiar o en mantenimiento.
    if reserva.habitacion.estado != "disponible":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La habitación está '{reserva.habitacion.estado}' y no puede recibir el check-in",
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


@router.post(
    "/{reserva_id}/no-show",
    response_model=ReservaOut,
    summary="Marca que el huésped no se presentó (reserva confirmada cuya llegada ya pasó)",
)
def no_show_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_o_404(db, reserva_id)
    if reserva.estado not in ("pendiente", "confirmada"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar 'no se presentó' en una reserva pendiente o confirmada (actual: '{reserva.estado}')",
        )
    if reserva.fecha_checkin_prevista > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aún no llega la fecha de check-in: si el huésped ya no vendrá, cancela la reserva",
        )
    # Libera la habitación para las fechas restantes; los pagos recibidos se conservan.
    reserva.estado = "no_show"
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
    if reserva.pagos or reserva.reserva_servicios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: la reserva tiene pagos o servicios asociados. Cancélala en su lugar",
        )
    if reserva.precheckin:
        db.delete(reserva.precheckin)
    db.delete(reserva)
    db.commit()