"""
Punto único de registro de todos los modelos del proyecto.
"""
from app.db.base_class import Base  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.usuario import Usuario  # noqa: F401
from app.models.tipo_habitacion import TipoHabitacion  # noqa: F401
from app.models.habitacion import Habitacion  # noqa: F401
from app.models.huesped import Huesped  # noqa: F401
from app.models.reserva import Reserva  # noqa: F401