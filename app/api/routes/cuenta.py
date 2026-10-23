"""
Cuenta del huésped: registro, perfil y sus propias reservas. Solo traducen HTTP; las reglas están en
app/services/cuentas.py y app/services/reservas_web.py.

Todo lo que está aquí es del huésped autenticado (token de tipo "cliente"); el personal no entra por estas rutas y el
huésped no entra por las del panel. Estas rutas no forman parte de la matriz de permisos de los roles.
"""
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import TIPO_CLIENTE, get_cuenta_actual, get_db, liberar_pendientes_vencidas
from app.core.limites import limitar_publico, limitar_registro, registrar_registro
from app.core.security import create_access_token
from app.models.cuenta_huesped import CuentaHuesped
from app.schemas.cuenta import CuentaOut, RegistroCuenta
from app.schemas.reserva_web import PagoIniciado, ReservaWebOut
from app.schemas.usuario import Token
from app.services import cuentas
from app.services import reservas_web as web

router = APIRouter(prefix="/cuenta", tags=["Cuenta del huésped"], dependencies=[Depends(limitar_publico)])


class TransaccionPago(BaseModel):
    transaccion_id: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


@router.post(
    "/registro",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limitar_registro)],
    summary="Crea una cuenta de huésped y deja la sesión iniciada",
)
def registrar(datos: RegistroCuenta, request: Request, db: Session = Depends(get_db)):
    cuenta = cuentas.registrar(db, datos)
    registrar_registro(request)
    return Token(access_token=create_access_token(subject=str(cuenta.id), extra_claims={"tipo": TIPO_CLIENTE}))


@router.get("/me", response_model=CuentaOut, summary="Datos de la cuenta de huésped autenticada")
def mi_cuenta(cuenta: CuentaHuesped = Depends(get_cuenta_actual)):
    return cuenta


@router.get(
    "/reservas",
    response_model=list[ReservaWebOut],
    dependencies=[Depends(liberar_pendientes_vencidas)],
    summary="Reservas hechas con esta cuenta",
)
def mis_reservas(cuenta: CuentaHuesped = Depends(get_cuenta_actual), db: Session = Depends(get_db)):
    config = web.config_hotel(db)
    return [web.salida(r, config) for r in cuentas.reservas_de(db, cuenta)]


@router.post(
    "/reservas/{codigo}/cancelar",
    response_model=ReservaWebOut,
    dependencies=[Depends(liberar_pendientes_vencidas)],
    summary="Cancela una reserva de esta cuenta",
)
def cancelar(codigo: str, cuenta: CuentaHuesped = Depends(get_cuenta_actual), db: Session = Depends(get_db)):
    return web.cancelar(db, cuentas.reserva_de(db, cuenta, codigo))


@router.post(
    "/reservas/{codigo}/pagar",
    response_model=PagoIniciado,
    dependencies=[Depends(liberar_pendientes_vencidas)],
    summary="Inicia el pago del anticipo de una reserva de esta cuenta",
)
def pagar(codigo: str, cuenta: CuentaHuesped = Depends(get_cuenta_actual), db: Session = Depends(get_db)):
    config = web.exigir_pagos_activos(db)
    return web.iniciar_pago(db, cuentas.reserva_de(db, cuenta, codigo), config)


@router.post(
    "/reservas/{codigo}/verificar-pago",
    response_model=ReservaWebOut,
    dependencies=[Depends(liberar_pendientes_vencidas)],
    summary="Confirma un pago de esta cuenta consultando la transacción a Wompi",
)
def verificar_pago(codigo: str, datos: TransaccionPago, cuenta: CuentaHuesped = Depends(get_cuenta_actual), db: Session = Depends(get_db)):
    return web.verificar_pago(db, cuentas.reserva_de(db, cuenta, codigo), datos.transaccion_id)
