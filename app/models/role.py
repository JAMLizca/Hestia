"""
Modelo SQLAlchemy de la tabla roles.
"""
from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class Role(Base):
     __tablename__="roles"
     