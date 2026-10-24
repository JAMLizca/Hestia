"""
Permisos por rol. UNA sola tabla (PERMISOS) decide qué puede hacer cada rol en cada módulo: la API la aplica
a cada petición (app/api/deps.py: verificar_permiso) y la pantalla de Roles muestra esa misma tabla. Lo que no
está en la tabla se niega: un rol nuevo, o una ruta nueva sin clasificar, no puede hacer nada hasta que se
agregue aquí.
"""
from fastapi.routing import APIRoute

ADMIN, GERENTE, RECEPCION, AUDITOR = "administrador", "gerente", "recepcionista", "auditor"
_TODOS = (ADMIN, GERENTE, RECEPCION, AUDITOR)

# (módulo, acción) -> roles que pueden. Para cambiar un permiso se edita solo esta tabla.
#   - El administrador tiene todo MENOS operar Reservas, Habitaciones, Huéspedes y Servicios (incluye sus consumos): ahí solo ve.
#   - Recepción opera el día a día (reservas, huéspedes, habitaciones, servicios, consumos, pagos).
#   - Gerente supervisa: cambia estados de reservas, corrige pagos, gestiona tipos de habitación, ve reportes.
#   - Auditor solo consulta.
PERMISOS: dict[tuple[str, str], tuple[str, ...]] = {
    ("reservas", "ver"): _TODOS,
    ("reservas", "crear"): (RECEPCION,),
    ("reservas", "editar"): (RECEPCION,),
    ("reservas", "estado"): (GERENTE, RECEPCION),
    ("reservas", "eliminar"): (GERENTE,),
    ("consumos", "ver"): _TODOS,
    ("consumos", "crear"): (RECEPCION,),
    ("consumos", "editar"): (RECEPCION,),
    ("consumos", "eliminar"): (RECEPCION,),
    ("pagos", "ver"): _TODOS,
    ("pagos", "crear"): (ADMIN, RECEPCION),
    ("pagos", "editar"): (ADMIN, GERENTE),
    ("pagos", "estado"): (ADMIN, GERENTE),
    ("facturacion", "ver"): _TODOS,
    ("habitaciones", "ver"): _TODOS,
    ("habitaciones", "crear"): (RECEPCION,),
    ("habitaciones", "editar"): (RECEPCION,),
    ("habitaciones", "eliminar"): (RECEPCION,),
    ("tipos-habitacion", "ver"): _TODOS,
    ("tipos-habitacion", "crear"): (ADMIN, GERENTE),
    ("tipos-habitacion", "editar"): (ADMIN, GERENTE),
    ("tipos-habitacion", "eliminar"): (ADMIN, GERENTE),
    ("disponibilidad", "ver"): _TODOS,
    ("huespedes", "ver"): _TODOS,
    ("huespedes", "crear"): (RECEPCION,),
    ("huespedes", "editar"): (GERENTE, RECEPCION),
    ("huespedes", "eliminar"): (GERENTE,),
    ("servicios", "ver"): _TODOS,
    ("servicios", "crear"): (RECEPCION,),
    ("servicios", "editar"): (RECEPCION,),
    ("servicios", "eliminar"): (RECEPCION,),
    ("usuarios", "ver"): (ADMIN,),
    ("usuarios", "crear"): (ADMIN,),
    ("usuarios", "editar"): (ADMIN,),
    ("usuarios", "eliminar"): (ADMIN,),
    # Roles: la matriz de permisos la consulta cualquier usuario del personal (el menú se arma con ella).
    ("roles", "ver"): _TODOS,
    ("roles", "crear"): (ADMIN,),
    ("roles", "editar"): (ADMIN,),
    ("roles", "eliminar"): (ADMIN,),
    ("reportes", "ver"): (ADMIN, GERENTE, AUDITOR),
    # Configuración: todos la consultan (horarios, moneda, nombre del hotel); solo el administrador la cambia.
    ("configuracion", "ver"): _TODOS,
    ("configuracion", "editar"): (ADMIN,),
}


def roles_permitidos(modulo: str, accion: str) -> tuple[str, ...]:
    return PERMISOS.get((modulo, accion), ())

# Orden y nombre de los módulos conocidos. Un módulo nuevo se agrega solo al final.
MODULOS = {
    "reservas": "Reservas",
    "consumos": "Consumo de servicios",
    "pagos": "Pagos",
    "facturacion": "Facturación",
    "habitaciones": "Habitaciones",
    "tipos-habitacion": "Tipos de habitación",
    "disponibilidad": "Disponibilidad",
    "huespedes": "Huéspedes",
    "servicios": "Servicios (catálogo)",
    "usuarios": "Usuarios",
    "roles": "Roles",
    "reportes": "Reportes y datos",
    "configuracion": "Configuración",
}

ACCIONES = {
    "ver": "Ver",
    "crear": "Crear",
    "editar": "Editar",
    "estado": "Cambiar estado",
    "eliminar": "Eliminar",
}

_METODO_ACCION = {"GET": "ver", "POST": "crear", "PUT": "editar", "PATCH": "editar", "DELETE": "eliminar"}

#No se pueden leer de las rutas porque se aplican dentro del endpoint.
NOTAS: dict = {}

# "publico": enlaces sin sesión (pre-check-in del huésped); no pertenecen a ningún rol.
RUTAS_IGNORADAS = {"health", "auth", "publico", "cuenta"}  # 

def _iterar_rutas(rutas, prefijo=""):
    
    for route in rutas:
        if isinstance(route, APIRoute):
            yield prefijo + route.path, route
            continue
        interno = getattr(route, "original_router", None)
        if interno is not None:
            contexto = getattr(route, "include_context", None)
            yield from _iterar_rutas(interno.routes, prefijo + getattr(contexto, "prefix", ""))


def _clasificar(ruta: str, metodo: str):
    
    segmentos = [s for s in ruta.strip("/").split("/") if s]
    if not segmentos:
        return None
    primero = segmentos[0]
    accion = _METODO_ACCION.get(metodo)
    if accion is None:
        return None

    if primero == "auth":
        # El alta de usuarios es POST /auth/register.
        return ("usuarios", "crear") if segmentos[1:2] == ["register"] and metodo == "POST" else None
    if primero in RUTAS_IGNORADAS:
        return None

    if primero == "reservas" and len(segmentos) >= 3:
        anidado = segmentos[2]
        if anidado == "servicios":
            return ("consumos", accion)
        if anidado == "pagos":
            # anular un pago es cambiarle el estado, no crear uno nuevo
            return ("pagos", "estado" if segmentos[-1] == "anular" else accion)
        if anidado == "resumen":
            return ("facturacion", accion)
        if anidado == "precheckin":  # crear/regenerar el enlace y validar los datos es editar la reserva
            return ("reservas", "ver" if metodo == "GET" else "editar")
        if metodo == "POST":  # confirmar, checkin, checkout, cancelar
            return ("reservas", "estado")
    if primero == "usuarios" and segmentos[-1] == "password":
        return ("usuarios", "editar")
    return (primero, accion)


def clasificar_peticion(relativa: str, metodo: str):
    """(módulo, acción) de una ruta del personal, o None si no está sujeta a la matriz (pública, login, huésped)."""
    return _clasificar(relativa, metodo)


def construir_matriz(app, prefijo: str, nombres_roles: list[str]) -> list[dict]:
    """Qué puede hacer cada rol, a partir de PERMISOS y de las acciones que realmente existen en las rutas."""
    existentes: set[tuple[str, str]] = set()
    for ruta_completa, route in _iterar_rutas(app.routes):
        if not ruta_completa.startswith(prefijo):
            continue
        relativa = ruta_completa[len(prefijo):]
        for metodo in route.methods - {"HEAD", "OPTIONS"}:
            clave = _clasificar(relativa, metodo)
            if clave is not None:
                existentes.add(clave)

    orden_modulos = list(MODULOS) + sorted({m for m, _ in existentes} - set(MODULOS))
    resultado = []
    for modulo in orden_modulos:
        acciones = []
        for accion in ACCIONES:
            if (modulo, accion) not in existentes:
                continue
            permitidos = [n for n in nombres_roles if n in roles_permitidos(modulo, accion)]
            notas = {r: t for r, t in NOTAS.get((modulo, accion), {}).items() if r in permitidos}
            acciones.append({"accion": accion, "etiqueta": ACCIONES[accion], "roles": permitidos, "notas": notas})
        if acciones:
            resultado.append({"clave": modulo, "nombre": MODULOS.get(modulo, modulo.replace("-", " ").capitalize()), "acciones": acciones})
    return resultado
