"""
Temporada de una estadía, según su fecha de llegada (RF-20: dato de entrada para los modelos de ML).

Es una regla práctica pensada para el turismo en Colombia; ajústala aquí si el hotel usa otra:
  - alta:  vacaciones de fin de año (15-dic a 15-ene), de mitad de año (15-jun a 15-jul) y Semana Santa.
  - media: resto del receso de mitad de año (16-jul a 31-ago) y la semana de receso de octubre (1 a 15-oct).
  - baja:  el resto del año.
La temporada se guarda en cada reserva al crearla (o al cambiarle la fecha de llegada), de modo que un cambio
posterior en esta regla no altera el histórico.
"""
from datetime import date, timedelta


def domingo_de_pascua(anio: int) -> date:
    """Algoritmo gregoriano anónimo (Meeus/Jones/Butcher)."""
    a, b, c = anio % 19, anio // 100, anio % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    mes, dia = divmod(h + ell - 7 * m + 114, 31)
    return date(anio, mes, dia + 1)


def temporada_para(fecha: date) -> str:
    pascua = domingo_de_pascua(fecha.year)
    if pascua - timedelta(days=7) <= fecha <= pascua:  # Domingo de Ramos a Domingo de Resurrección
        return "alta"
    mes_dia = (fecha.month, fecha.day)
    if mes_dia >= (12, 15) or mes_dia <= (1, 15) or (6, 15) <= mes_dia <= (7, 15):
        return "alta"
    if (7, 16) <= mes_dia <= (8, 31) or (10, 1) <= mes_dia <= (10, 15):
        return "media"
    return "baja"
