"""
Matriz de permisos por módulo, calculada a partir de las rutas reales de la APII.
"""
from fastapi.routing import APIRoute

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
NOTAS = {
    ("habitaciones", "editar"): {"recepcionista": "Solo el estado de la habitación"},
}

RUTAS_IGNORADAS = {"health", "auth"}  # 

def _iterar_rutas(rutas, prefijo=""):
    
    for route in rutas:
        if isinstance(route, APIRoute):
            yield prefijo + route.path, route
            continue
        interno = getattr(route, "original_router", None)
        if interno is not None:
            contexto = getattr(route, "include_context", None)
            yield from _iterar_rutas(interno.routes, prefijo + getattr(contexto, "prefix", ""))


def _roles_exigidos(dependant):
    for sub in dependant.dependencies:
        roles = getattr(sub.call, "roles_permitidos", None)
        if roles is not None:
            yield set(roles)
        yield from _roles_exigidos(sub)


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
            return ("pagos", accion)
        if anidado == "resumen":
            return ("facturacion", accion)
        if metodo == "POST":  # confirmar, checkin, checkout, cancelar
            return ("reservas", "estado")
    if primero == "usuarios" and segmentos[-1] == "password":
        return ("usuarios", "editar")
    return (primero, accion)


def construir_matriz(app, prefijo: str, nombres_roles: list[str]) -> list[dict]:
   
    grupos: dict[tuple[str, str], list[set | None]] = {}
    for ruta_completa, route in _iterar_rutas(app.routes):
        if not ruta_completa.startswith(prefijo):
            continue
        relativa = ruta_completa[len(prefijo):]
        restricciones = list(_roles_exigidos(route.dependant))
        for metodo in route.methods - {"HEAD", "OPTIONS"}:
            clave = _clasificar(relativa, metodo)
            if clave is None:
                continue
            # varias restricciones en una misma ruta se acumulan (hay que cumplir todas)
            grupos.setdefault(clave, []).append(restricciones)

    orden_modulos = list(MODULOS) + sorted({m for m, _ in grupos} - set(MODULOS))
    resultado = []
    for modulo in orden_modulos:
        acciones = []
        for accion in ACCIONES:
            rutas = grupos.get((modulo, accion))
            if not rutas:
                continue
            permitidos = [
                nombre
                for nombre in nombres_roles
                if all(nombre in r for restricciones in rutas for r in restricciones)
            ]
            notas = {r: t for r, t in NOTAS.get((modulo, accion), {}).items() if r in permitidos}
            acciones.append({"accion": accion, "etiqueta": ACCIONES[accion], "roles": permitidos, "notas": notas})
        if acciones:
            resultado.append({"clave": modulo, "nombre": MODULOS.get(modulo, modulo.replace("-", " ").capitalize()), "acciones": acciones})
    return resultado