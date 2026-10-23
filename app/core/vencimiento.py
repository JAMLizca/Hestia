"""
Vencimiento automático de reservas pendientes.

Una reserva que se toma por teléfono o por otro canal y nunca se confirma dejaría la
habitación bloqueada para siempre. Si el hotel lo configura (`horas_vencimiento_pendiente`,
24 por defecto; 0 = nunca), las reservas `pendiente` que superan ese plazo pasan a
`cancelada` con el motivo "Vencida". No se cancelan las que ya tienen un pago: un
anticipo cuenta como garantía. Tampoco las que tienen un pago en línea iniciado hace menos de
`MARGEN_PAGO_EN_CURSO_H` horas: el huésped puede estar pagando justo ahora.

No hay un proceso en segundo plano: la limpieza se ejecuta justo antes de atender
cualquier consulta de reservas o de disponibilidad (ver `liberar_pendientes_vencidas`
en app/api/deps.py), así que siempre se responde con la información al día.
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
    """Cancela las reservas pendientes vencidas y devuelve cuántas fueron."""
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    horas = config.horas_vencimiento_pendiente if config else VALORES_POR_DEFECTO["horas_vencimiento_pendiente"]
    if not horas:
        return 0

    # Se usa el reloj de la base de datos, el mismo que escribe `fecha_creacion`,
    # para no depender de la zona horaria del servidor de la API.
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
    # La actualización masiva no pasa por el ORM: hay que liberar a mano las noches que bloqueaban la habitación.
    ocupacion.liberar(db, [f[0] for f in db.query(Reserva.id).filter(Reserva.id.in_(ids), Reserva.estado == "cancelada").all()])
    if vencidas:
        db.commit()
    return vencidas
