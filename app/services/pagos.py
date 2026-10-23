"""
Pagos de una reserva: registrar, corregir y anular.

Un pago nunca se borra (queda el rastro contable): se corrige mientras esté `pagado` o se anula con un
motivo. Los pagos hechos por la pasarela (llevan `referencia`) no se tocan a mano: su dinero se devuelve
desde el panel de Wompi.
"""
from sqlalchemy.orm import Session

from app.core.errores import Conflicto, NoEncontrado, SolicitudInvalida
from app.models.pago import Pago
from app.models.reserva import Reserva
from app.schemas.pago import PagoAnular, PagoCreate, PagoUpdate
from app.services import facturacion
from app.services._comun import confirmar_cambios

obtener_reserva = facturacion.obtener_reserva


def listar(db: Session, reserva_id: int) -> list[Pago]:
    obtener_reserva(db, reserva_id)
    return db.query(Pago).filter(Pago.reserva_id == reserva_id).order_by(Pago.id).all()


def _obtener_pago(db: Session, reserva_id: int, pago_id: int) -> tuple[Reserva, Pago]:
    reserva = obtener_reserva(db, reserva_id)
    pago = db.query(Pago).filter(Pago.id == pago_id, Pago.reserva_id == reserva_id).first()
    if pago is None:
        raise NoEncontrado("No existe ese pago dentro de la reserva")
    return reserva, pago


def registrar(db: Session, reserva_id: int, datos: PagoCreate) -> Pago:
    reserva = obtener_reserva(db, reserva_id)
    if reserva.estado == "cancelada":
        raise SolicitudInvalida("No se pueden registrar pagos sobre una reserva cancelada")
    saldo = facturacion.saldo_pendiente(reserva)
    if saldo <= 0:
        raise SolicitudInvalida("La reserva no tiene saldo pendiente")
    if datos.monto > saldo:
        raise SolicitudInvalida(f"El monto supera el saldo pendiente ({saldo})")
    pago = Pago(reserva_id=reserva_id, monto=datos.monto, metodo_pago=datos.metodo_pago, estado="pagado")
    db.add(pago)
    confirmar_cambios(db)
    db.refresh(pago)
    return pago


def _exigir_manual_y_pagado(pago: Pago, accion: str) -> None:
    if pago.referencia:
        raise Conflicto(f"Los pagos hechos en línea con Wompi no se pueden {accion} aquí: se devuelven desde el panel de Wompi")
    if pago.estado != "pagado":
        raise Conflicto(f"Solo se puede {accion} un pago en estado 'pagado'; este está '{pago.estado}'")


def editar(db: Session, reserva_id: int, pago_id: int, datos: PagoUpdate) -> Pago:
    reserva, pago = _obtener_pago(db, reserva_id, pago_id)
    if reserva.estado == "cancelada":
        raise SolicitudInvalida("No se pueden modificar pagos de una reserva cancelada")
    _exigir_manual_y_pagado(pago, "editar")
    cambios = datos.model_dump(exclude_unset=True)
    if "monto" in cambios:
        nuevo_total = facturacion.total_pagado(reserva) - pago.monto + cambios["monto"]
        if nuevo_total > facturacion.costo_total(reserva):
            tope = facturacion.costo_total(reserva) - (facturacion.total_pagado(reserva) - pago.monto)
            raise SolicitudInvalida(f"Con ese monto los pagos superarían el total de la reserva (máximo para este pago: {tope})")
    for campo, valor in cambios.items():
        setattr(pago, campo, valor)
    confirmar_cambios(db)
    db.refresh(pago)
    return pago


def anular(db: Session, reserva_id: int, pago_id: int, datos: PagoAnular) -> Pago:
    _, pago = _obtener_pago(db, reserva_id, pago_id)
    _exigir_manual_y_pagado(pago, "anular")
    pago.estado = "anulado"
    pago.motivo_anulacion = datos.motivo
    confirmar_cambios(db)
    db.refresh(pago)
    return pago
