"""
Modelo SQLAlchemy de la tabla roles.
"""
from sqlalchemy import Column, Integer, String, Column
from app.db.base_class import Base

class Role(Base):
     __tablename__="roles"
     id=Column(Integer, primary_key=True, index=True)
     nombre=Column(String(50), unique=True, nullable=False)
     description=Column(String(255), nullable=True)