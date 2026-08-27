"""
Todos los modelos (Role, Usuario, Huesped, Habitacion, Reserva, etc.) revisen el diagrama, deben
heredar de esta clase para que SQLAlchemy y, más adelante, Alembic puedan
detectarlos y generar sus correspondietes tablas/migraciones automáticamente, sin que nosotros le metamos la mano tanto.
"""
from sqlalchemy.orm import declarative_base

Base = declarative_base()
