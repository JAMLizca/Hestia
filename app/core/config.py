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

    # Sin valor por defecto: con una clave conocida cualquiera puede falsificar tokens.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

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
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

        )
    
settings = Settings()
