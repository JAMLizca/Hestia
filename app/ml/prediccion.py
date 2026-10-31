"""
Predicción con los modelos de Hestia, en Python puro (sin scikit-learn, pandas ni numpy).

Los modelos que se despliegan son lineales (regresión Ridge para la ocupación, regresión logística para el
recomendador). `ml/paso5_exportar_modelos.py` los guarda como JSON (coeficientes, medias y categorías) y este
módulo los evalúa con aritmética simple. Ventajas: la API no necesita las librerías de ciencia de datos (imagen
más liviana, menos memoria en Render) y no puede romperse por una diferencia de versión de scikit-learn.

El resultado es el mismo que daría scikit-learn: el script de exportación lo comprueba antes de guardar.
"""
import json
import math
from functools import lru_cache
from pathlib import Path

CARPETA = Path(__file__).resolve().parent / "modelos"


class ModeloNoDisponible(Exception):
    """El archivo del modelo no existe o está dañado."""


def _normalizar(valor, numerica: bool):
    """Las categorías numéricas (día, mes, huéspedes) llegan como int; las demás, como texto."""
    return int(valor) if numerica else str(valor)


class ModeloLineal:
    def __init__(self, datos: dict):
        self.datos = datos
        self.tipo = datos["tipo"]  # "regresion" | "clasificacion"
        self.numericas = datos["numericas"]
        self.categoricas = datos["categoricas"]
        self.coeficientes = datos["coeficientes"]
        self.intercepto = datos["intercepto"]
        self.clases = datos.get("clases")
        self.recorte = datos.get("recorte")
        self.meta = datos.get("meta", {})

    def _vector(self, fila: dict) -> list[float]:
        x = [(float(fila[n["nombre"]]) - n["media"]) / n["escala"] for n in self.numericas]
        for c in self.categoricas:
            valor = _normalizar(fila[c["nombre"]], c["numerica"])
            x.extend(1.0 if categoria == valor else 0.0 for categoria in c["categorias"])  # categoría desconocida → todo en 0
        return x

    def predecir(self, fila: dict) -> float:
        """Regresión: un número (recortado al rango del modelo si lo tiene)."""
        x = self._vector(fila)
        y = self.intercepto + sum(c * v for c, v in zip(self.coeficientes, x))
        if self.recorte:
            y = min(max(y, self.recorte[0]), self.recorte[1])
        return y

    def probabilidades(self, fila: dict) -> dict[str, float]:
        """Clasificación: {clase: probabilidad}, suman 1."""
        x = self._vector(fila)
        puntajes = [b + sum(c * v for c, v in zip(pesos, x)) for pesos, b in zip(self.coeficientes, self.intercepto)]
        m = max(puntajes)
        exp = [math.exp(p - m) for p in puntajes]
        total = sum(exp)
        return {clase: e / total for clase, e in zip(self.clases, exp)}


@lru_cache(maxsize=None)
def cargar(nombre: str) -> ModeloLineal:
    """Carga (una sola vez) app/ml/modelos/<nombre>.json."""
    ruta = CARPETA / f"{nombre}.json"
    try:
        return ModeloLineal(json.loads(ruta.read_text(encoding="utf-8")))
    except (OSError, ValueError, KeyError) as e:
        raise ModeloNoDisponible(f"No se pudo cargar el modelo «{nombre}» ({e.__class__.__name__})") from e
