"""
Punto único de registro de todos los modelos del proyecto.
"""
from app.db.base_class import Base  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.huesped import Huesped  # noqa: F401
