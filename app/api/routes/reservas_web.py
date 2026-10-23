"""
Rutas públicas de la reserva en línea (página /reservar). Solo traducen HTTP y limitan el abuso por IP;
las reglas están en app/services/reservas_web.py.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_cuenta_actual, get_db, liberar_pendientes_vencidas
from app.core.errores import NoEncontrado
from app.core.limites import limitar_creacion, limitar_publico, registrar_creacion, registrar_fallo
from app.models.cuenta_huesped import CuentaHuesped
from app.models.reserva import Reserva
from app.schemas.reserva_web import (
    CatalogoPublico,
    ConsultaWeb,
    HotelPublico,
    PagoIniciado,
    ReservaWebCreate,
    ReservaWebOut,
    TipoDisponible,
    VerificarPago,
)
from app.services import reservas_web as servicio

router = APIRouter(
    prefix="/publico",
    tags=["Reservas en línea (público)"],
    dependencies=[Depends(limitar_publico), Depends(liberar_pendientes_vencidas)],
)


def _buscar(db: Session, datos: ConsultaWeb, request: Request) -> Reserva:
    """Un código o documento errado cuenta como intento fallido: 8 por minuto y por IP bloquean (429)."""
    try:
        return servicio.buscar(db, datos)
    except NoEncontrado:
        registrar_fallo(request)
        raise


@router.get("/hotel", response_model=HotelPublico, summary="Datos públicos del hotel y si acepta reservas en línea")
def datos_hotel(db: Session = Depends(get_db)):
    return servicio.datos_hotel(db)


@router.get("/catalogo", response_model=CatalogoPublico, summary="Habitaciones y servicios que ofrece el hotel (página principal)")
def catalogo_publico(db: Session = Depends(get_db)):
    return servicio.catalogo(db)


@router.get("/disponibilidad", response_model=list[TipoDisponible], summary="Tipos de habitación disponibles en un rango de fechas")
def disponibilidad_publica(
    fecha_checkin: date = Query(...),
    fecha_checkout: date = Query(...),
    huespedes: int = Query(default=1, ge=1, le=10),
    db: Session = Depends(get_db),
):
    return servicio.disponibilidad(db, fecha_checkin, fecha_checkout, huespedes)


@router.post(
    "/reservas",
    response_model=ReservaWebOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limitar_creacion)],
    summary="Crea una reserva pendiente desde la página pública (exige iniciar sesión con una cuenta de huésped)",
)
def crear_reserva_web(
    datos: ReservaWebCreate,
    request: Request,
    db: Session = Depends(get_db),
    cuenta: CuentaHuesped = Depends(get_cuenta_actual),
):
    salida = servicio.crear(db, datos, cuenta)
    registrar_creacion(request)  # solo cuentan las reservas realmente creadas
    return salida


@router.post("/reservas/consultar", response_model=ReservaWebOut, summary="Consulta una reserva con su código y el documento del titular")
def consultar_reserva_web(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    reserva = _buscar(db, datos, request)
    return servicio.salida(reserva, servicio.config_hotel(db))


@router.post("/reservas/cancelar", response_model=ReservaWebOut, summary="El huésped cancela su reserva pendiente o confirmada")
def cancelar_reserva_web(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    return servicio.cancelar(db, _buscar(db, datos, request))


@router.post("/reservas/pagar", response_model=PagoIniciado, summary="Inicia el pago del anticipo en Wompi y devuelve el enlace de pago")
def pagar_anticipo(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    config = servicio.exigir_pagos_activos(db)
    return servicio.iniciar_pago(db, _buscar(db, datos, request), config)


@router.post("/reservas/verificar-pago", response_model=ReservaWebOut, summary="Confirma un pago consultando la transacción a Wompi (respaldo del webhook)")
def verificar_pago(datos: VerificarPago, request: Request, db: Session = Depends(get_db)):
    return servicio.verificar_pago(db, _buscar(db, datos, request), datos.transaccion_id)
