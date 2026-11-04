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
    if pascua - timedelta(days=7) <= fecha <= pascua:  
        return "alta"
    mes_dia = (fecha.month, fecha.day)
    if mes_dia >= (12, 15) or mes_dia <= (1, 15) or (6, 15) <= mes_dia <= (7, 15):
        return "alta"
    if (7, 16) <= mes_dia <= (8, 31) or (10, 1) <= mes_dia <= (10, 15):
        return "media"
    return "baja"
