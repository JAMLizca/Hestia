"""Depedencias reutilizables para los endpoints de la API.  
"""

from app.db.session import get_db
__all__ = ["get_db"]