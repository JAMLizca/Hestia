"""
Modulo que contiene la configuración de la aplicación, se incluye las var de entornos y config de la DB
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


CLAVES_INSEGURAS = {"change-this-secret-key", "changeme", "secret"}


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hestia - Sistema Inteligente de Gestión Hotelera"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    # Sin valor por defecto: debe definirse en `.env` (puede ser vacía).
    DB_PASSWORD: str 
    DB_NAME: str = "hestia_db"
    # Servicios de MySQL en la nube (Aiven, TiDB, etc.) exigen conexión cifrada.
    DB_SSL: bool = False
    # Certificado de la autoridad (ca.pem) para verificar el servidor: ruta a un archivo, o su contenido
    # pegado en DB_SSL_CA_PEM (útil en plataformas donde solo hay variables de entorno).
    DB_SSL_CA: str = ""
    DB_SSL_CA_PEM: str = ""

    # Sin valor por defecto: con una clave conocida cualquiera puede falsificar tokens.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Pagos en línea con Wompi (https://wompi.com). Vacíos = sin pagos en línea.
    # Las llaves salen del panel de Wompi: Desarrolladores → Secretos para integración técnica.
    WOMPI_PUBLIC_KEY: str = ""        # pub_test_... (pruebas) o pub_prod_... (producción)
    WOMPI_INTEGRITY_SECRET: str = ""  # firma del enlace de pago
    WOMPI_EVENTS_SECRET: str = ""     # verifica los avisos (webhook) que envía Wompi
    # Dirección pública del frontend: a ella vuelve el huésped después de pagar.
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("SECRET_KEY")
    @classmethod
    def validar_secret_key(cls, valor: str) -> str:
        if valor in CLAVES_INSEGURAS or len(valor) < 32:
            raise ValueError(
                "SECRET_KEY insegura: define en .env una clave aleatoria de al menos 32 "
                "caracteres (por ejemplo: python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
            )
        return valor

    @property
    def WOMPI_API_URL(self) -> str:
        return "https://sandbox.wompi.co/v1" if self.WOMPI_PUBLIC_KEY.startswith("pub_test_") else "https://production.wompi.co/v1"

    @property
    def WOMPI_CONFIGURADO(self) -> bool:
        return bool(self.WOMPI_PUBLIC_KEY and self.WOMPI_INTEGRITY_SECRET)

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()