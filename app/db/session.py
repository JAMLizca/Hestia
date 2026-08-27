"""
Config de la conexión a la DB mediante SQLAlchemy.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import db
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

"""
Dependencia de la sesión de datos por request y la cerra automaticamente al finalizar.
"""
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()