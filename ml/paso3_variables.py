import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
HORIZONTES = [7, 14, 30]
OCUPAN = ("checkout", "checkin")  
CALENTAMIENTO = 10               
VENTANA_LARGA = 28
DIAS_PRUEBA = 120                 
FRACCION_PRUEBA_RECO = 0.20        

_informe: list[str] = []


def p(texto: str = "") -> None:
    print(texto)
    _informe.append(texto)


def titulo(texto: str) -> None:
    p()
    p("=" * 78)
    p(texto)
    p("=" * 78)


def construir_ocupacion(df: pd.DataFrame, n_hab: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Devuelve (serie diaria, tabla del modelo 1)."""
    hoy = df.fecha_creacion.max()
    ultimo_dia = hoy - pd.Timedelta(days=1)  # el día de hoy todavía no termina
    dias = pd.date_range(df.fecha_checkin.min(), ultimo_dia, freq="D")

    creada = df.fecha_creacion.to_numpy().astype("datetime64[D]")
    llega = df.fecha_checkin.to_numpy().astype("datetime64[D]")
    sale = df.fecha_checkout.to_numpy().astype("datetime64[D]")
    durmio = df.estado.isin(OCUPAN).to_numpy()

    filas = []
    for d in dias.to_numpy().astype("datetime64[D]"):
        cubre = (llega <= d) & (d < sale)                       # la estancia incluye la noche d
        fila = {"fecha": pd.Timestamp(d), "ocupadas": int((cubre & durmio).sum())}
        for h in HORIZONTES:
            fila[f"libros_{h}"] = int((cubre & (creada <= d - np.timedelta64(h, "D"))).sum())
        filas.append(fila)
    serie = pd.DataFrame(filas).set_index("fecha")
    serie["ocupacion_pct"] = serie.ocupadas / n_hab * 100

    r7 = serie.ocupacion_pct.rolling(7).mean()
    r28 = serie.ocupacion_pct.rolling(VENTANA_LARGA).mean()
    inicio_valido = serie.index[0] + pd.Timedelta(days=CALENTAMIENTO)
    primer_dia = inicio_valido + pd.Timedelta(days=VENTANA_LARGA + max(HORIZONTES))  
    corte = serie.index[-1] - pd.Timedelta(days=DIAS_PRUEBA - 1)

    partes = []
    for h in HORIZONTES:
        t = serie.loc[serie.index >= primer_dia].copy()
        origen = t.index - pd.Timedelta(days=h)
        t["horizonte"] = h
        t["ocupacion_real"] = t.ocupacion_pct
        t["en_libros_pct"] = t[f"libros_{h}"] / n_hab * 100
        t["ocup_ult7"] = r7.reindex(origen - pd.Timedelta(days=1)).to_numpy()
        t["ocup_ult28"] = r28.reindex(origen - pd.Timedelta(days=1)).to_numpy()
        vecinos, nuevas7, nuevas28 = [], [], []
        for d, o in zip(t.index.to_numpy().astype("datetime64[D]"), origen.to_numpy().astype("datetime64[D]")):
            vistas = creada <= o
            dias_vecinos = [d + np.timedelta64(k, "D") for k in range(-3, 4)]
            vecinos.append(np.mean([((llega <= x) & (x < sale) & vistas).sum() for x in dias_vecinos]))
            nuevas7.append(((creada <= o) & (creada > o - np.timedelta64(7, "D"))).sum() / 7 / n_hab * 100)
            nuevas28.append(((creada <= o) & (creada > o - np.timedelta64(28, "D"))).sum() / 28 / n_hab * 100)
        t["en_libros_sem_pct"] = np.array(vecinos) / n_hab * 100
        t["nuevas_7d"] = nuevas7
        t["nuevas_28d"] = nuevas28
        t["dia_semana"] = t.index.day_of_week
        t["mes"] = t.index.month
        t["es_finde"] = t.index.day_of_week.isin([4, 5]).astype(int)  # noches de viernes y sábado
        t["conjunto"] = np.where(t.index >= corte, "prueba", "entrenamiento")
        partes.append(t)
    modelo = pd.concat(partes).reset_index().rename(columns={"index": "fecha"})
    cols = ["fecha", "horizonte", "ocupacion_real", "en_libros_pct", "en_libros_sem_pct", "nuevas_7d", "nuevas_28d",
            "ocup_ult7", "ocup_ult28", "dia_semana", "mes", "es_finde", "conjunto"]
    modelo = modelo[cols]
    for c in ("ocupacion_real", "en_libros_pct", "en_libros_sem_pct", "nuevas_7d", "nuevas_28d", "ocup_ult7", "ocup_ult28"):
        modelo[c] = modelo[c].round(3)
    assert not modelo.isna().any().any(), "quedaron valores vacíos en el modelo 1"
    return serie, modelo


def construir_recomendador(df: pd.DataFrame) -> pd.DataFrame:
    """Una fila por reserva, solo con lo que se conoce al momento de reservar."""
    r = pd.DataFrame(
        {
            "fecha_creacion": df.fecha_creacion,
            "tipo_habitacion": df.tipo_habitacion,  # lo que se quiere predecir
            "num_huespedes": df.num_huespedes,
            "noches": df.noches,
            "anticipacion_dias": df.anticipacion_dias,
            "canal": df.canal,
            "temporada": df.temporada,
            "dia_semana_llegada": df.dia_semana_llegada,
            "mes_llegada": df.mes_llegada,
            "llegada_fin_de_semana": df.llegada_fin_de_semana,
            "huesped_recurrente": df.huesped_recurrente,
            "reservas_previas_huesped": df.reservas_previas_huesped,
            "extranjero": (df.huesped_nacionalidad != "Colombia").astype(int),
            "pref_piso": df.pref_piso,
            "pref_vista": df.pref_vista,
            "pref_cama": df.pref_cama,
            "pref_tranquila": df.pref_tranquila,
            "pref_accesible": df.pref_accesible,
        }
    ).sort_values("fecha_creacion", kind="stable").reset_index(drop=True)
    n_prueba = int(len(r) * FRACCION_PRUEBA_RECO)
    r["conjunto"] = "entrenamiento"
    r.loc[len(r) - n_prueba :, "conjunto"] = "prueba"
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", type=Path, default=RAIZ / "ml" / "datos")
    ap.add_argument("--informes", type=Path, default=RAIZ / "ml" / "informes")
    args = ap.parse_args()
    args.informes.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.datos / "reservas_limpio.csv", parse_dates=["fecha_creacion", "fecha_checkin", "fecha_checkout"])
    hab = pd.read_csv(args.datos / "habitaciones.csv")
    n_hab = len(hab)

    # MODELO 1
    titulo("MODELO 1 · PRONÓSTICO DE OCUPACIÓN")
    serie, modelo = construir_ocupacion(df, n_hab)
    serie[["ocupadas", "ocupacion_pct"]].round(2).reset_index().to_csv(args.datos / "ocupacion_diaria.csv", index=False)
    modelo.to_csv(args.datos / "modelo_ocupacion.csv", index=False)

    p(f"Habitaciones en el inventario: {n_hab}")
    p(f"Serie diaria: {serie.index[0].date()} → {serie.index[-1].date()}  ({len(serie)} días)")
    p(f"Ocupación media: {serie.ocupacion_pct.mean():.1f}%   mínima: {serie.ocupacion_pct.min():.0f}%   máxima: {serie.ocupacion_pct.max():.0f}%")
    p(f"  (los primeros {CALENTAMIENTO} días se descartan: las estancias previas al inicio de los datos no existen y la ocupación sale artificialmente baja)")

    h0 = modelo[modelo.horizonte == HORIZONTES[0]]
    tr, te = h0[h0.conjunto == "entrenamiento"], h0[h0.conjunto == "prueba"]
    p()
    p(f"{'':<16}{'desde':<14}{'hasta':<14}{'días':>6}")
    p(f"{'entrenamiento':<16}{str(tr.fecha.min().date()):<14}{str(tr.fecha.max().date()):<14}{len(tr):>6}")
    p(f"{'prueba':<16}{str(te.fecha.min().date()):<14}{str(te.fecha.max().date()):<14}{len(te):>6}")
    p(f"Filas del modelo 1: {len(modelo)}  ({len(HORIZONTES)} horizontes x {len(h0)} días)")
    p()
    p("Qué tan relacionada está la ocupación «en libros» con la ocupación real (correlación, solo entrenamiento):")
    for h in HORIZONTES:
        t = modelo[(modelo.horizonte == h) & (modelo.conjunto == "entrenamiento")]
        p(f"  a {h:>2} días de anticipación:  en_libros vs real = {t.en_libros_pct.corr(t.ocupacion_real):.2f}"
          f"    |   viernes/sábado vs real = {t.es_finde.corr(t.ocupacion_real):+.2f}")
    p("  → Cuanto más cerca de la fecha, más reservas ya existen y mejor se puede predecir.")
    p()
    p("Variables del modelo 1 (todas conocidas el día en que se hace el pronóstico):")
    p("  en_libros_pct       % de habitaciones ya reservadas para esa noche")
    p("  en_libros_sem_pct   % reservado en promedio alrededor de esa noche (±3 días)")
    p("  nuevas_7d / _28d    reservas nuevas por día (como % de las habitaciones) en la última semana / mes: el ritmo de la demanda")
    p("  ocup_ult7 / _28     ocupación real de los últimos 7 / 28 días")
    p("  dia_semana, mes, es_finde")

    # MODELO 2
    titulo("MODELO 2 · RECOMENDADOR DE HABITACIÓN")
    reco = construir_recomendador(df)
    reco.to_csv(args.datos / "modelo_recomendador.csv", index=False, date_format="%Y-%m-%d")
    tr, te = reco[reco.conjunto == "entrenamiento"], reco[reco.conjunto == "prueba"]
    p(f"Filas: {len(reco)}   |   variables de entrada: {reco.shape[1] - 3}   |   objetivo: tipo_habitacion ({reco.tipo_habitacion.nunique()} tipos)")
    p(f"entrenamiento: {len(tr)} reservas, creadas {tr.fecha_creacion.min().date()} → {tr.fecha_creacion.max().date()}")
    p(f"prueba:        {len(te)} reservas, creadas {te.fecha_creacion.min().date()} → {te.fecha_creacion.max().date()}")
    p()
    p("Línea base: acertar siempre el tipo más frecuente del entrenamiento")
    mas_frecuente = tr.tipo_habitacion.mode()[0]
    p(f"  tipo más frecuente: {mas_frecuente}  →  acierta {(te.tipo_habitacion == mas_frecuente).mean():.1%} de la prueba")
    p("  El modelo solo vale la pena si supera claramente este número.")
    p()
    p("Variables EXCLUIDAS a propósito (fuga de información):")
    p("  precio_noche, precio_total   → el precio se deduce del tipo: sería como dar la respuesta")
    p("  piso                         → es la habitación ya asignada (las suites ejecutiva y presidencial están siempre en el piso 4)")
    p("  estado, cancelada, no_show, total_pagado, costo_servicios → ocurren después de reservar")

    (args.informes / "variables.txt").write_text("\n".join(_informe) + "\n", encoding="utf-8")
    print("\nResumen guardado en ml/informes/variables.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
