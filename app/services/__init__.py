"""
Capa de servicios: las reglas de negocio de Hestia.

Las rutas (app/api/routes) solo reciben la petición HTTP, llaman a un servicio y devuelven la respuesta;
los servicios aplican las reglas, consultan y escriben mediante los modelos (app/models) y avisan de los
incumplimientos con `ErrorNegocio` (app/core/errores.py), que `main.py` convierte en una respuesta HTTP.
Los servicios no importan nada de FastAPI.
"""
