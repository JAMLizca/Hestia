"""
Config de la conexión a la DB mediante SQLAlchemy.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import db
from app.core.config import settings



def _argumentos_conexion() -> dict:
    """Conexión cifrada (TLS) cuando DB_SSL=true. Con certificado de la CA se verifica el servidor."""
    if not settings.DB_SSL:
        return {}
    ca = settings.DB_SSL_CA
    if not ca and settings.DB_SSL_CA_PEM.strip():
        import tempfile

        archivo = tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False)
        archivo.write(settings.DB_SSL_CA_PEM.replace("\\n", "\n"))
        archivo.close()
        ca = archivo.name
    if ca:
        return {"ssl": {"ca": ca}}
    # Cifrado sin verificar el certificado del servidor: mejor que texto plano, peor que usar el ca.pem.
    import ssl

    contexto = ssl.create_default_context()
    contexto.check_hostname = False
    contexto.verify_mode = ssl.CERT_NONE
    return {"ssl": contexto}


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=_argumentos_conexion(),
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