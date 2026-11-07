"""
Todos los modelos (Role, Usuario, Huesped, Habitacion, Reserva, etc.) revisen el diagrama, deben
heredar de esta clase para que SQLAlchemy.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()
