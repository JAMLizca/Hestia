"""
Modelo SQLAlchemy de la tabla roles.
"""
from sqlalchemy import Column, Integer, String, column
from app.db.base_class import Base

class Role(Base):
     __tablename__="roles"
     id=column(Integer, primary_key=True, index=True)
     nombre=column(String(50), unique=True, nullable=False)
     description=column(String(255), nullable=True)