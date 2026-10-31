"""
Genera un historial SIMULADO de reservas dentro del propio sistema Hestia, para poder entrenar los modelos
de ML (predicción de ocupación y recomendación de habitaciones) sin descargar datos externos.

Los datos se escriben en las mismas tablas que usa la aplicación (huespedes, habitaciones, reservas, pagos,
reserva_servicios, reserva_noches), respetando sus reglas (UNIQUE por habitación y noche, CHECK, temporada,
precio = precio_base × noches). Después se exportan con el mismo código del reporte «dataset de reservas».

USO (recomendado: sobre una base NUEVA y local, no sobre la de producción):

    DB_NAME=hestia_ml python ml/generar_datos.py              # genera ~2 años de historia
    DB_NAME=hestia_ml python ml/generar_datos.py --ver        # solo resume qué haría
    DB_NAME=hestia_ml python ml/generar_datos.py --borrar     # quita todo lo simulado

Todo lo simulado se puede reconocer: huéspedes con documento «SIM000001…», correo @ejemplo.com y
habitaciones con la nota «Datos simulados (ML)».

IMPORTANTE (para la documentación): son datos sintéticos. Reproducen patrones plausibles de un hotel
(temporadas, fines de semana, canales, perfiles de huésped, cancelaciones), pero los modelos aprenderán esas
reglas del simulador, no el comportamiento de clientes reales. Cuando el hotel tenga historial real, se
reentrena con él con el mismo procedimiento.
"""
import argparse
import math
import random
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func  # noqa: E402

import app.db.base  # noqa: E402,F401
from app.db.session import SessionLocal  # noqa: E402
from app.models.habitacion import Habitacion  # noqa: E402
from app.models.huesped import Huesped  # noqa: E402
from app.models.pago import Pago  # noqa: E402
from app.models.reserva import Reserva  # noqa: E402
from app.models.reserva_noche import ReservaNoche  # noqa: E402
from app.models.reserva_servicio import ReservaServicio  # noqa: E402
from app.models.servicio import Servicio  # noqa: E402
from app.models.tipo_habitacion import TipoHabitacion  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
from app.services.temporada import temporada_para  # noqa: E402

MARCA_HABITACION = "Datos simulados (ML)"
PREFIJO_DOC = "SIM"
UTC = timezone.utc

# nombre del tipo → (cuántas habitaciones, pisos posibles)
INVENTARIO = {
    "Habitación Estándar": (8, (1, 2)),
    "Habitación Doble Twin": (5, (1, 2, 3)),
    "Habitación Superior": (5, (2, 3)),
    "Habitación Triple": (3, (2, 3)),
    "Suite Junior": (3, (3,)),
    "Suite Ejecutiva": (2, (4,)),
    "Suite Familiar": (3, (3, 4)),
    "Suite Presidencial": (1, (4,)),
}

# ── Perfiles latentes de huésped (no se guardan; el modelo debe deducirlos de lo observable) ──
PERFILES = {
    #            pax                          noches                        anticipación (media, días)  tipos preferidos
    "negocios": dict(pax={1: .65, 2: .35}, noches={1: .35, 2: .35, 3: .20, 4: .10}, lead=9,
                     tipos={"Habitación Estándar": .35, "Habitación Superior": .30, "Suite Ejecutiva": .15, "Suite Junior": .12, "Habitación Doble Twin": .08}),
    "pareja": dict(pax={2: 1.0}, noches={1: .15, 2: .40, 3: .30, 4: .10, 5: .05}, lead=22,
                   tipos={"Habitación Superior": .35, "Suite Junior": .30, "Habitación Estándar": .22, "Suite Presidencial": .05, "Suite Ejecutiva": .08}),
    "familia": dict(pax={3: .30, 4: .35, 5: .20, 6: .15}, noches={2: .20, 3: .30, 4: .25, 5: .15, 7: .10}, lead=40,
                    tipos={"Suite Familiar": .50, "Habitación Triple": .40, "Suite Junior": .10}),
    "amigos": dict(pax={2: .35, 3: .35, 4: .30}, noches={1: .20, 2: .40, 3: .30, 4: .10}, lead=15,
                   tipos={"Habitación Doble Twin": .50, "Habitación Triple": .30, "Habitación Estándar": .15, "Suite Familiar": .05}),
    "lujo": dict(pax={2: .70, 3: .10, 4: .20}, noches={2: .25, 3: .30, 4: .25, 5: .10, 6: .10}, lead=45,
                 tipos={"Suite Presidencial": .50, "Suite Junior": .20, "Suite Ejecutiva": .15, "Habitación Superior": .15}),
}
CANALES = {  # peso por perfil
    "negocios": {"presencial": .08, "telefono": .20, "whatsapp": .10, "correo": .22, "web": .35, "otro": .05},
    "pareja": {"presencial": .06, "telefono": .08, "whatsapp": .20, "correo": .06, "web": .55, "otro": .05},
    "familia": {"presencial": .05, "telefono": .15, "whatsapp": .28, "correo": .07, "web": .42, "otro": .03},
    "amigos": {"presencial": .10, "telefono": .10, "whatsapp": .35, "correo": .03, "web": .37, "otro": .05},
    "lujo": {"presencial": .05, "telefono": .20, "whatsapp": .20, "correo": .15, "web": .35, "otro": .05},
}
MULT_TEMPORADA = {"alta": 1.55, "media": 1.10, "baja": 0.85}
MULT_DIA = {0: .80, 1: .75, 2: .80, 3: .95, 4: 1.40, 5: 1.30, 6: .90}  # 0 = lunes
NACIONALIDADES = {"Colombia": .82, "Venezuela": .05, "Estados Unidos": .04, "España": .03, "Ecuador": .02, "México": .02, "Perú": .01, "Argentina": .01}
NOMBRES = ["Camila", "Andrés", "Valentina", "Santiago", "Laura", "Daniel", "Sofía", "Juan", "Mariana", "Felipe", "Natalia", "Carlos", "Paula", "Sebastián",
           "Daniela", "David", "Isabela", "Mateo", "Luisa", "Nicolás", "Carolina", "Julián", "Alejandra", "Esteban", "Manuela", "Diego", "Juliana", "Tomás"]
APELLIDOS = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez", "Ramírez", "Sánchez", "Torres", "Vargas", "Rojas", "Castro", "Ortiz", "Morales",
             "Cortés", "Silva", "Medina", "Herrera", "Castillo", "Cárdenas", "Trujillo", "Mosquera", "Cuéllar", "Perdomo", "Losada", "Ardila"]
METODOS = ["efectivo", "tarjeta", "transferencia", "wompi"]


def elegir(rng: random.Random, pesos: dict):
    claves = list(pesos)
    return rng.choices(claves, weights=[pesos[c] for c in claves])[0]


def poisson(rng: random.Random, lam: float) -> int:
    limite, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limite:
            return k
        k += 1


def sigmoide(x: float) -> float:
    return 1 / (1 + math.exp(-x))


# ───────────────────────────── preparación de la base ─────────────────────────────

def preparar_tipos_y_habitaciones(db, rng) -> dict[str, list[Habitacion]]:
    """Asegura los 8 tipos y el inventario objetivo (30 habitaciones). Usa el catálogo oficial de tipos."""
    from migraciones.cargar_tipos_habitacion import TIPOS  # noqa: E402

    tipos = {t.nombre: t for t in db.query(TipoHabitacion).all()}
    for nombre, descripcion, capacidad, camas, m2, precio in TIPOS:
        if nombre not in tipos:
            tipos[nombre] = TipoHabitacion(nombre=nombre, descripcion=descripcion, capacidad_maxima=capacidad, camas=camas, metros_cuadrados=Decimal(m2), precio_base=Decimal(precio))
            db.add(tipos[nombre])
    db.flush()

    numeros = {n for (n,) in db.query(Habitacion.numero).all()}
    por_tipo: dict[str, list[Habitacion]] = defaultdict(list)
    for h in db.query(Habitacion).all():
        por_tipo[h.tipo_habitacion.nombre].append(h)
    for nombre, (cuantas, pisos) in INVENTARIO.items():
        i = 0
        while len(por_tipo[nombre]) < cuantas:
            piso = pisos[i % len(pisos)]
            i += 1
            n = piso * 100 + 1
            while str(n) in numeros:
                n += 1
            numeros.add(str(n))
            h = Habitacion(tipo_habitacion_id=tipos[nombre].id, numero=str(n), piso=piso, estado="disponible", caracteristicas=MARCA_HABITACION)
            db.add(h)
            por_tipo[nombre].append(h)
    db.flush()
    return por_tipo


def preparar_servicios(db) -> list[Servicio]:
    if db.query(Servicio).count() == 0:
        try:
            from migraciones.cargar_servicios import SERVICIOS  # noqa: E402

            for cat, nombre, desc, precio in SERVICIOS:
                db.add(Servicio(nombre=nombre, descripcion=desc, precio=Decimal(precio), categoria=cat))
            db.flush()
        except ImportError:
            return []
    return db.query(Servicio).all()


# ───────────────────────────── simulación ─────────────────────────────

def nuevo_huesped(rng, n: int, perfil: str, creada: date) -> tuple[Huesped, dict]:
    nom, ape1, ape2 = rng.choice(NOMBRES), rng.choice(APELLIDOS), rng.choice(APELLIDOS)
    nac = elegir(rng, NACIONALIDADES)
    edad = rng.randint(22, 68)
    h = Huesped(
        documento_identidad=f"{PREFIJO_DOC}{n:06d}", tipo_documento="CC" if nac == "Colombia" else "PAS", nombres=nom, apellidos=f"{ape1} {ape2}",
        email=f"sim{n}@ejemplo.com", telefono=f"3{rng.randint(0, 2)}{rng.randint(10000000, 99999999)}", nacionalidad=nac,
        fecha_nacimiento=date(creada.year - edad, rng.randint(1, 12), rng.randint(1, 28)),
        fecha_registro=datetime.combine(creada, time(10, 0), tzinfo=UTC),
    )
    return h, {"perfil": perfil, "n": 0}


def perfil_del_dia(rng, d: date, temporada: str) -> str:
    finde = d.weekday() in (4, 5)
    pesos = {
        "negocios": 0.08 if finde else 0.30,
        "pareja": 0.38 if finde else 0.24,
        "familia": 0.15 * (2.2 if temporada == "alta" else 1.0),
        "amigos": 0.14 if finde else 0.10,
        "lujo": 0.05,
    }
    return elegir(rng, pesos)


def preferencias(rng, perfil: str, tipo: str, pax: int) -> dict | None:
    """Lo que el huésped pidió al reservar (mismas claves que usa la app). Correlacionado con el perfil y el tipo."""
    p: dict = {}
    if rng.random() < 0.55:
        if tipo == "Habitación Doble Twin":
            p["cama"] = "sencillas" if rng.random() < 0.80 else "doble"
        elif tipo == "Habitación Triple":
            p["cama"] = "sencillas" if rng.random() < 0.40 else "doble"
        else:
            p["cama"] = "doble" if rng.random() < 0.85 else "sencillas"
    if rng.random() < 0.50:
        alto = {"pareja": .55, "lujo": .65, "negocios": .45, "amigos": .40, "familia": .20}[perfil]
        p["piso"] = "alto" if rng.random() < alto else "bajo"
    if rng.random() < 0.45:
        p["vista"] = "exterior" if rng.random() < 0.65 else "interior"
    if rng.random() < {"negocios": .35, "pareja": .30, "lujo": .40, "familia": .10, "amigos": .05}[perfil]:
        p["tranquila"] = True
    if rng.random() < 0.04:
        p["accesible"] = True
        p["piso"] = "bajo"
    return p or None


def elegir_habitacion(rng, habs: list[Habitacion], libres: set[int], pref: dict | None) -> Habitacion | None:
    candidatas = [h for h in habs if h.id in libres]
    if not candidatas:
        return None
    pisos = (pref or {}).get("piso")
    if pisos and rng.random() < 0.85:
        ordenadas = sorted(candidatas, key=lambda h: h.piso or 0, reverse=(pisos == "alto"))
        mejor = [h for h in ordenadas if (h.piso or 0) == (ordenadas[0].piso or 0)]
        return rng.choice(mejor)
    if (pref or {}).get("tranquila") and rng.random() < 0.7:
        altas = [h for h in candidatas if (h.piso or 0) >= 3]
        if altas:
            return rng.choice(altas)
    return rng.choice(candidatas)


def probabilidades_desenlace(canal: str, lead: int, temporada: str, noches: int, pax: int, anticipo: bool, recurrente: bool, perfil: str) -> tuple[float, float]:
    z = -2.9 + {"web": .9, "whatsapp": .3, "presencial": -.7, "telefono": -.2, "correo": .0, "otro": .2}[canal]
    z += 0.8 if lead > 30 else 0.35 if lead >= 15 else -0.5 if lead < 3 else 0.0
    z += {"baja": .35, "media": .0, "alta": -.30}[temporada]
    z += 0.3 if noches >= 5 else 0.0
    z += -1.2 if anticipo else 0.0
    z += -0.6 if recurrente else 0.0
    z += {"negocios": .2, "familia": -.2}.get(perfil, 0.0) + (0.2 if pax == 1 else 0.0)
    p_cancel = sigmoide(z)
    w = -4.35 + (0.5 if canal == "web" else 0.0) + (0.9 if not anticipo else 0.0) + (0.3 if lead > 30 else 0.0)
    w += (0.3 if perfil == "negocios" else 0.0) + (-0.5 if recurrente else 0.0) + (0.2 if temporada == "baja" else 0.0)
    return p_cancel, sigmoide(w)


def simular(db, rng, hoy: date, dias_historia: int, demanda: float, servicios: list[Servicio], usuario_id: int, por_tipo: dict[str, list[Habitacion]]) -> Counter:
    inicio = hoy - timedelta(days=dias_historia)
    fin = hoy + timedelta(days=60)
    tipos = {n: hs[0].tipo_habitacion for n, hs in por_tipo.items()}
    cap_maxima = max(t.capacidad_maxima for t in tipos.values())  # un grupo mayor no cabría en ninguna habitación
    ocupado: dict[int, set[date]] = defaultdict(set)  # habitacion_id → noches ocupadas
    huespedes: list[tuple[Huesped, dict]] = []
    codigos: set[str] = set()
    alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    c = Counter()
    pesos_serv = [3.0 if s.categoria == "Alimentos" else 1.0 for s in servicios]

    d = inicio
    while d <= fin:
        temporada = temporada_para(d)
        anios = (d - inicio).days / 365
        lam = demanda * MULT_TEMPORADA[temporada] * MULT_DIA[d.weekday()] * (1 + 0.12 * anios) * math.exp(rng.gauss(0, 0.12))
        for _ in range(poisson(rng, lam)):
            # ── quién es ──
            if huespedes and rng.random() < 0.22:
                hu, meta = rng.choice(huespedes)  # huésped que vuelve (mantiene su perfil)
                perfil = meta["perfil"]
            else:
                perfil = perfil_del_dia(rng, d, temporada)
                hu = None
            P = PERFILES[perfil]
            pax, noches = min(elegir(rng, P["pax"]), cap_maxima), elegir(rng, P["noches"])
            canal = elegir(rng, CANALES[perfil])
            lead = max(0, int(rng.expovariate(1 / P["lead"]) + (3 if canal == "web" else 0)))
            creada = d - timedelta(days=lead)
            if creada > hoy:  # esa reserva todavía no se ha hecho
                continue
            llegada, salida = d, d + timedelta(days=noches)

            # ── qué tipo y habitación ──
            factibles = {n: w for n, w in P["tipos"].items() if tipos[n].capacidad_maxima >= pax}
            for n, t in tipos.items():
                if t.capacidad_maxima >= pax:
                    factibles.setdefault(n, 0.02)
            orden = sorted(factibles, key=lambda n: factibles[n] * rng.random(), reverse=True)
            pref = None
            habitacion = None
            tipo_nombre = orden[0]
            noches_rango = [llegada + timedelta(days=i) for i in range(noches)]
            for tn in orden:
                pref = preferencias(rng, perfil, tn, pax)
                libres = {h.id for h in por_tipo[tn] if not any(x in ocupado[h.id] for x in noches_rango)}
                habitacion = elegir_habitacion(rng, por_tipo[tn], libres, pref)
                if habitacion:
                    tipo_nombre = tn
                    break
            if not habitacion:
                c["demanda_perdida"] += 1
                continue

            # ── huésped, pago y desenlace ──
            if hu is None:
                hu, meta = nuevo_huesped(rng, len(huespedes) + 1, perfil, creada)
                db.add(hu)
                huespedes.append((hu, meta))
            recurrente = meta["n"] > 0
            meta["n"] += 1
            tipo = tipos[tipo_nombre]
            total = tipo.precio_base * noches
            anticipo = rng.random() < (0.55 if canal == "web" else 0.25)
            p_cancel, p_noshow = probabilidades_desenlace(canal, lead, temporada, noches, pax, anticipo, recurrente, perfil)
            cancelada = rng.random() < p_cancel
            no_show = (not cancelada) and llegada < hoy and rng.random() < p_noshow
            if cancelada:
                estado = "cancelada"
            elif no_show:
                estado = "no_show"
            elif salida <= hoy:
                estado = "checkout"
            elif llegada <= hoy:
                estado = "checkin"
            else:
                estado = "pendiente" if (creada >= hoy - timedelta(days=1) and canal == "web" and not anticipo) else "confirmada"

            codigo = "HST-" + "".join(rng.choice(alfabeto) for _ in range(6))
            while codigo in codigos:
                codigo = "HST-" + "".join(rng.choice(alfabeto) for _ in range(6))
            codigos.add(codigo)

            r = Reserva(
                huesped=hu, habitacion=habitacion, usuario_id=usuario_id, fecha_checkin_prevista=llegada, fecha_checkout_prevista=salida,
                num_huespedes=pax, estado=estado, precio_total=total, codigo=codigo, canal=canal, temporada=temporada_para(llegada),
                preferencias=pref, motivo_cancelacion=("Cambio de planes" if cancelada else None),
                fecha_creacion=datetime.combine(creada, time(rng.randint(7, 22), rng.randint(0, 59)), tzinfo=UTC),
            )
            if estado in ("checkout", "checkin"):
                r.fecha_checkin_real = datetime.combine(llegada, time(rng.randint(14, 20), rng.randint(0, 59)), tzinfo=UTC)
            if estado == "checkout":
                r.fecha_checkout_real = datetime.combine(salida, time(rng.randint(9, 12), rng.randint(0, 59)), tzinfo=UTC)
            db.add(r)

            if not cancelada:  # la cancelada libera la habitación; el no_show la bloqueó esa(s) noche(s)
                ocupado[habitacion.id].update(noches_rango)
            if estado in ("pendiente", "confirmada", "checkin"):  # así lo mantiene el sistema (app/services/ocupacion.py)
                for dia in noches_rango:
                    r.noches.append(ReservaNoche(habitacion_id=habitacion.id, fecha=dia))

            # pagos y consumos
            ref_fecha = datetime.combine(creada, time(12, 0), tzinfo=UTC)
            if anticipo:
                db.add(Pago(reserva=r, monto=(total * Decimal("0.3")).quantize(Decimal("1")), metodo_pago=rng.choice(METODOS), estado="pagado", fecha_pago=ref_fecha))
            costo_serv = Decimal(0)
            if estado == "checkout" and servicios:
                for _ in range(poisson(rng, noches * pax * 0.35)):
                    s = rng.choices(servicios, weights=pesos_serv)[0]
                    cant = rng.choice([1, 1, 1, 2, 3])
                    costo_serv += s.precio * cant
                    db.add(ReservaServicio(reserva=r, servicio_id=s.id, cantidad=cant, precio_unitario=s.precio,
                                           fecha_consumo=datetime.combine(llegada + timedelta(days=rng.randint(0, noches - 1)), time(rng.randint(8, 21), 0), tzinfo=UTC)))
            if estado == "checkout":
                ya = (total * Decimal("0.3")).quantize(Decimal("1")) if anticipo else Decimal(0)
                resto = total + costo_serv - ya
                if resto > 0:
                    db.add(Pago(reserva=r, monto=resto, metodo_pago=rng.choice(METODOS[:3]), estado="pagado", fecha_pago=r.fecha_checkout_real))
            elif estado in ("cancelada", "no_show") and anticipo and rng.random() < 0.5:
                db.add(Pago(reserva=r, monto=(total * Decimal("0.3")).quantize(Decimal("1")), metodo_pago="wompi", estado="anulado", fecha_pago=ref_fecha, motivo_anulacion="Reembolso"))
            c[estado] += 1
            c["total"] += 1
        d += timedelta(days=1)
        if (d - inicio).days % 60 == 0:
            db.flush()
    c["huespedes"] = len(huespedes)
    c["noches_ocupadas_hasta_hoy"] = sum(1 for hab in ocupado.values() for n in hab if inicio <= n < hoy)
    c["habitaciones"] = sum(len(v) for v in por_tipo.values())
    return c


def borrar_simulado(db) -> None:
    hu = [i for (i,) in db.query(Huesped.id).filter(Huesped.documento_identidad.like(f"{PREFIJO_DOC}%")).all()]
    rid = [i for (i,) in db.query(Reserva.id).filter(Reserva.huesped_id.in_(hu)).all()] if hu else []
    if rid:
        db.query(Pago).filter(Pago.reserva_id.in_(rid)).delete(synchronize_session=False)
        db.query(ReservaServicio).filter(ReservaServicio.reserva_id.in_(rid)).delete(synchronize_session=False)
        db.query(ReservaNoche).filter(ReservaNoche.reserva_id.in_(rid)).delete(synchronize_session=False)
        db.query(Reserva).filter(Reserva.id.in_(rid)).delete(synchronize_session=False)
    if hu:
        db.query(Huesped).filter(Huesped.id.in_(hu)).delete(synchronize_session=False)
    usadas = db.query(Reserva.habitacion_id).distinct()
    db.query(Habitacion).filter(Habitacion.caracteristicas == MARCA_HABITACION, ~Habitacion.id.in_(usadas)).delete(synchronize_session=False)
    db.commit()
    print(f"Quitado lo simulado: {len(hu)} huéspedes, {len(rid)} reservas (y sus pagos, consumos y noches).")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("USO")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dias", type=int, default=730, help="días de historia hacia atrás (por defecto 730 = 2 años)")
    ap.add_argument("--demanda", type=float, default=8.0, help="llegadas promedio por día en temporada media (ajusta la ocupación)")
    ap.add_argument("--semilla", type=int, default=42, help="semilla del azar: la misma semilla produce los mismos datos")
    ap.add_argument("--ver", action="store_true", help="simula y muestra el resumen, pero NO guarda nada")
    ap.add_argument("--borrar", action="store_true", help="quita todo lo simulado y termina")
    ap.add_argument("--permitir-remoto", action="store_true", help="permite correr contra una base que no es local (no recomendado)")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        url = db.get_bind().url
        local = (url.host or "").lower() in ("", "localhost", "127.0.0.1", "::1") or url.get_backend_name() == "sqlite"
        print(f"Base de datos: {url.get_backend_name()}://{url.host or '-'}/{url.database}")
        if not local and not args.permitir_remoto:
            print("ABORTADO: la base no es local. Estos datos son simulados y no deben mezclarse con los reales de la nube.")
            return 2
        if args.borrar:
            borrar_simulado(db)
            return 0
        if db.query(Reserva.id).first():
            print("ABORTADO: la base ya tiene reservas. Usa una base nueva (ej. DB_NAME=hestia_ml) o ejecuta antes con --borrar.")
            return 2
        usuario = db.query(Usuario).order_by(Usuario.id).first()
        if not usuario:
            print("ABORTADO: no hay usuarios. Prepara la base antes: DB_NAME=hestia_ml python deploy/inicializar.py (con ADMIN_*).")
            return 2

        rng = random.Random(args.semilla)
        por_tipo = preparar_tipos_y_habitaciones(db, rng)
        servicios = preparar_servicios(db)
        c = simular(db, rng, date.today(), args.dias, args.demanda, servicios, usuario.id, por_tipo)

        cerradas = c["checkout"] + c["cancelada"] + c["no_show"]
        ocup = c["noches_ocupadas_hasta_hoy"] / (c["habitaciones"] * args.dias) * 100
        print(f"\nReservas simuladas: {c['total']}  |  huéspedes: {c['huespedes']}  |  habitaciones: {c['habitaciones']}")
        print("  por estado:", {k: c[k] for k in ("checkout", "checkin", "confirmada", "pendiente", "cancelada", "no_show")})
        print(f"  cancelación: {c['cancelada'] / max(cerradas, 1):.1%}  |  no-show: {c['no_show'] / max(cerradas, 1):.1%}  (sobre reservas cerradas)")
        print(f"  ocupación promedio del periodo: {ocup:.0f}%  |  demanda perdida por falta de habitación: {c['demanda_perdida']}")
        if args.ver:
            db.rollback()
            print("\n(--ver: no se guardó nada)")
        else:
            db.commit()
            print("\nListo. Siguiente paso: python ml/exportar_dataset.py")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
