"""
Vencimiento automático de reservas pendientes.
"""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.models.pago import Pago
from app.models.reserva import Reserva
from app.schemas.configuracion import VALORES_POR_DEFECTO
from app.services import ocupacion


MARGEN_PAGO_EN_CURSO_H = 2


def expirar_pendientes(db: Session) -> int:
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    horas = config.horas_vencimiento_pendiente if config else VALORES_POR_DEFECTO["horas_vencimiento_pendiente"]
    if not horas:
        return 0


    ahora = db.execute(select(func.now())).scalar()
    limite = ahora - timedelta(hours=horas)

    pagando = select(Pago.reserva_id).where(
        (Pago.estado == "pagado") | ((Pago.estado == "pendiente") & (Pago.fecha_pago > ahora - timedelta(hours=MARGEN_PAGO_EN_CURSO_H)))
    )
    candidatas = (
        db.query(Reserva.id)
        .filter(Reserva.estado == "pendiente", Reserva.fecha_creacion < limite, ~Reserva.id.in_(pagando))
        .all()
    )
    ids = [f[0] for f in candidatas]
    if not ids:
        return 0
    vencidas = (
        db.query(Reserva)
        .filter(Reserva.id.in_(ids), Reserva.estado == "pendiente")
        .update(
            {Reserva.estado: "cancelada", Reserva.motivo_cancelacion: f"Vencida: no se confirmó en {horas} h"},
            synchronize_session=False,
        )
    )

    ocupacion.liberar(db, [f[0] for f in db.query(Reserva.id).filter(Reserva.id.in_(ids), Reserva.estado == "cancelada").all()])
    if vencidas:
        db.commit()
    return vencidas
