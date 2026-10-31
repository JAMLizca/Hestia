"""
PASO 2 — Exploración y limpieza de los datos con pandas.

Lee lo que exportó el Paso 1 (ml/datos/reservas.csv y habitaciones.csv) y hace cuatro cosas:

  1. Carga y revisa la estructura (tipos de dato, nulos).
  2. Valida reglas de negocio (fechas coherentes, precios positivos, capacidad, duplicados).
  3. Explora: cómo se distribuyen canales, temporadas, tipos, noches, anticipación, y cómo se
     relacionan con cancelaciones y no-shows.
  4. Limpia y guarda un archivo listo para el Paso 3.

Salidas:
  ml/datos/reservas_limpio.csv       datos limpios (se regenera; no se sube a git)
  ml/informes/calidad_datos.txt      informe de calidad: va a la documentación
  ml/informes/*.png                  3 gráficas para el informe

USO:
    python ml/paso2_exploracion_limpieza.py
"""
import argparse
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # sin ventana: solo guarda archivos
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
FECHAS = ["fecha_creacion", "fecha_checkin", "fecha_checkout"]
PREF_TEXTO = ["pref_piso", "pref_vista", "pref_cama"]          # texto; vacío = sin preferencia
PREF_BANDERA = ["pref_tranquila", "pref_accesible"]            # 0/1
ESTADOS_FINALES = ["checkout", "cancelada", "no_show"]  # el desenlace de la reserva ya se conoce

# Colores de las gráficas (paleta validada: azul y naranja se distinguen incluso con daltonismo)
SUPERFICIE, TEXTO, TEXTO_SUAVE, AZUL, NARANJA = "#fcfcfb", "#0b0b0b", "#52514e", "#2a78d6", "#eb6834"

_informe: list[str] = []


def p(texto: str = "") -> None:
    """Imprime en pantalla y guarda la misma línea en el informe."""
    print(texto)
    _informe.append(texto)


def titulo(texto: str) -> None:
    p()
    p("=" * 78)
    p(texto)
    p("=" * 78)


def pct(serie: pd.Series) -> str:
    return serie.map(lambda v: f"{v:.1%}").to_string()


def estilo_ejes(ax) -> None:
    ax.set_facecolor(SUPERFICIE)
    for lado in ("top", "right", "left"):
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color("#cfcdc6")
    ax.tick_params(colors=TEXTO_SUAVE, length=0)
    ax.yaxis.grid(True, color="#ecebe6", linewidth=0.8)
    ax.set_axisbelow(True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", type=Path, default=RAIZ / "ml" / "datos")
    ap.add_argument("--informes", type=Path, default=RAIZ / "ml" / "informes")
    args = ap.parse_args()
    args.informes.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ 1. CARGA
    titulo("1. CARGA Y ESTRUCTURA")
    df = pd.read_csv(args.datos / "reservas.csv", parse_dates=FECHAS)
    hab = pd.read_csv(args.datos / "habitaciones.csv")
    p(f"reservas.csv:      {df.shape[0]} filas x {df.shape[1]} columnas")
    p(f"habitaciones.csv:  {hab.shape[0]} filas x {hab.shape[1]} columnas")
    p(f"Periodo (llegadas): {df.fecha_checkin.min().date()}  →  {df.fecha_checkin.max().date()}")
    p()
    p("Tipos de dato por columna:")
    p(df.dtypes.astype(str).to_string())

    nulos = df.isna().sum()
    nulos = nulos[nulos > 0]
    p()
    p("Columnas con valores vacíos (cantidad):")
    p(nulos.to_string() if len(nulos) else "  ninguna")
    p("  → Los vacíos en pref_* NO son errores: significan que el huésped no indicó esa preferencia.")

    # ------------------------------------------------------------------ 2. VALIDACIÓN
    titulo("2. VALIDACIÓN DE REGLAS DE NEGOCIO")
    dur = (df.fecha_checkout - df.fecha_checkin).dt.days
    antic = (df.fecha_checkin - df.fecha_creacion).dt.days
    capacidad = df.tipo_habitacion.map(hab.drop_duplicates("tipo_habitacion").set_index("tipo_habitacion").capacidad_maxima)

    # Reglas "duras": si se incumplen, la fila es un error y se elimina.
    duras = {
        "código de reserva repetido": df.reserva_codigo.duplicated(),
        "noches < 1": df.noches < 1,
        "checkout no es posterior al checkin": df.fecha_checkout <= df.fecha_checkin,
        "noches no coincide con checkout - checkin": dur != df.noches,
        "reserva creada después de la llegada": df.fecha_creacion > df.fecha_checkin,
        "anticipación no coincide con checkin - creación": antic != df.anticipacion_dias,
        "huéspedes < 1": df.num_huespedes < 1,
        "precio por noche <= 0": df.precio_noche <= 0,
        "total pagado negativo": df.total_pagado < 0,
        "tipo de habitación que no existe en el inventario": capacidad.isna(),
    }
    # Reglas "blandas": se reportan, pero no se borra nada.
    blandas = {
        "precio_total distinto de precio_noche x noches": (df.precio_total - df.precio_noche * df.noches).abs() > 1,
        "más huéspedes que la capacidad del tipo": df.num_huespedes > capacidad,
        "bandera cancelada no coincide con estado": df.cancelada != (df.estado == "cancelada").astype(int),
        "bandera no_show no coincide con estado": df.no_show != (df.estado == "no_show").astype(int),
        "dia_semana_llegada no coincide con la fecha": df.dia_semana_llegada != df.fecha_checkin.dt.day_of_week,
        "mes_llegada no coincide con la fecha": df.mes_llegada != df.fecha_checkin.dt.month,
    }
    p(f"{'Regla':<56}{'Incumplen':>10}")
    p("-" * 66)
    for nombre, mascara in duras.items():
        p(f"[dura]   {nombre:<47}{int(mascara.sum()):>10}")
    for nombre, mascara in blandas.items():
        p(f"[aviso]  {nombre:<47}{int(mascara.sum()):>10}")

    malas = pd.concat(duras.values(), axis=1).any(axis=1)
    antes = len(df)
    df = df.loc[~malas].copy()
    p()
    p(f"Filas eliminadas por reglas duras: {antes - len(df)} de {antes}")
    p("  → Con datos generados por el propio sistema se espera 0: la app ya valida al crear la reserva.")
    p("    Con datos reales o importados de otra fuente aquí sí aparecerían errores.")

    # ------------------------------------------------------------------ 3. EXPLORACIÓN
    titulo("3. EXPLORACIÓN")
    for col in ["canal", "estado", "temporada", "tipo_habitacion"]:
        p(f"\nDistribución de «{col}»:")
        p(pct(df[col].value_counts(normalize=True)))

    p("\nVariables numéricas (resumen):")
    p(df[["noches", "anticipacion_dias", "num_huespedes", "precio_noche", "reservas_previas_huesped"]].describe().round(1).to_string())
    p(f"\nHuéspedes recurrentes: {df.huesped_recurrente.mean():.1%} de las reservas")
    p(f"Llegadas en fin de semana: {df.llegada_fin_de_semana.mean():.1%} de las reservas")

    p("\nPreferencias declaradas (porcentaje de reservas; «sin dato» = no indicó):")
    for col in PREF_TEXTO + PREF_BANDERA:
        conteo = df[col].fillna("sin dato").astype(str).value_counts(normalize=True)
        p(f"  {col:<15} " + "  ".join(f"{k}: {v:.0%}" for k, v in conteo.items()))

    df["resuelta"] = df.estado.isin(ESTADOS_FINALES)
    cerradas = df[df.resuelta]
    p(f"\nReservas con desenlace conocido (checkout, cancelada o no_show): {len(cerradas)} de {len(df)}")
    p("  Las demás (pendiente, confirmada, checkin) todavía no terminan: no se sabe si se cancelarán.")
    p("  Para estudiar cancelaciones solo se usan las resueltas; si no, se contaría como «no canceló»")
    p("  una reserva que simplemente aún no ha ocurrido.")
    p(f"\nCancelación global: {cerradas.cancelada.mean():.1%}   |   no-show global: {cerradas.no_show.mean():.1%}")

    def tasas(por) -> pd.DataFrame:
        t = cerradas.groupby(por, observed=True)[["cancelada", "no_show"]].mean()
        t["reservas"] = cerradas.groupby(por, observed=True).size()
        return t

    for etiqueta, por in [("canal", "canal"), ("temporada", "temporada"), ("recurrente", "huesped_recurrente")]:
        t = tasas(por)
        p(f"\nCancelación y no-show por {etiqueta}:")
        p(t.assign(cancelada=t.cancelada.map("{:.1%}".format), no_show=t.no_show.map("{:.1%}".format)).to_string())

    tramos = pd.cut(cerradas.anticipacion_dias, [-1, 3, 14, 30, 90, 10_000], labels=["0-3 d", "4-14 d", "15-30 d", "31-90 d", "más de 90 d"])
    t = cerradas.groupby(tramos, observed=True)[["cancelada", "no_show"]].mean()
    p("\nCancelación y no-show según la anticipación con que se reservó:")
    p(t.map("{:.1%}".format).to_string())

    p("\n¿Qué tipo de habitación se asigna según el tamaño del grupo? (% por fila)")
    cruce = pd.crosstab(df.num_huespedes, df.tipo_habitacion, normalize="index")
    cruce = cruce.rename(columns=lambda c: c.replace("Habitación ", "").replace("Suite ", "S. "))
    p((cruce * 100).round(0).astype(int).to_string())
    p("  → Esta relación es la base del recomendador (modelo 2).")

    # ------------------------------------------------------------------ 4. LIMPIEZA
    titulo("4. LIMPIEZA Y GUARDADO")
    for col in PREF_TEXTO:
        df[col] = df[col].fillna("sin_preferencia").astype(str)
    df = df.sort_values(["fecha_creacion", "reserva_codigo"]).reset_index(drop=True)
    df["resuelta"] = df["resuelta"].astype(int)

    salida = args.datos / "reservas_limpio.csv"
    df.to_csv(salida, index=False, date_format="%Y-%m-%d")
    p(f"  Preferencias vacías  →  «sin_preferencia»")
    p(f"  Fechas convertidas a tipo fecha; filas ordenadas por fecha de creación")
    p(f"  Columna nueva «resuelta» (1 = el desenlace de la reserva ya se conoce)")
    p(f"  Guardado: {salida.relative_to(RAIZ) if salida.is_relative_to(RAIZ) else salida}   ({len(df)} filas, {df.shape[1]} columnas)")

    p("\nColumnas que NO se pueden usar para predecir cancelación o no-show («fuga de información»):")
    p("  estado, cancelada, no_show      → son el resultado mismo")
    p("  total_pagado, pagado_completo   → solo existen si la estancia ocurrió")
    p("  costo_servicios                 → solo hay consumos si el huésped llegó")
    p("  Un modelo que las use se vería perfecto en el entrenamiento y fallaría en la vida real,")
    p("  porque en el momento de decidir esos datos todavía no existen.")

    # ------------------------------------------------------------------ 5. GRÁFICAS
    plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": TEXTO, "axes.labelcolor": TEXTO_SUAVE})

    # a) reservas por mes de llegada
    por_mes = df.groupby(df.fecha_checkin.dt.to_period("M")).size()
    fig, ax = plt.subplots(figsize=(9, 3.6), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    ax.bar(range(len(por_mes)), por_mes.values, color=AZUL, width=0.78)
    ax.set_xticks(range(0, len(por_mes), 2))
    ax.set_xticklabels([str(m) for m in por_mes.index[::2]], rotation=45, ha="right", fontsize=8)
    ax.set_title("Reservas por mes de llegada (simulación)", loc="left", fontsize=12, fontweight="bold")
    ax.set_ylabel("Reservas")
    fig.tight_layout()
    fig.savefig(args.informes / "reservas_por_mes.png", dpi=150, facecolor=SUPERFICIE)
    plt.close(fig)

    # b) noches por reserva
    noches = df.noches.value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(6, 3.6), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    ax.bar(noches.index.astype(str), noches.values, color=AZUL, width=0.78)
    ax.set_title("Noches por reserva", loc="left", fontsize=12, fontweight="bold")
    ax.set_xlabel("Noches")
    ax.set_ylabel("Reservas")
    fig.tight_layout()
    fig.savefig(args.informes / "noches_por_reserva.png", dpi=150, facecolor=SUPERFICIE)
    plt.close(fig)

    # c) cancelación y no-show por canal
    t = tasas("canal").sort_values("cancelada")
    fig, ax = plt.subplots(figsize=(7, 3.2), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    ax.yaxis.grid(False)
    ax.xaxis.grid(True, color="#ecebe6", linewidth=0.8)
    y = range(len(t))
    ax.barh([i + 0.2 for i in y], t.cancelada * 100, height=0.38, color=AZUL, label="Cancelación")
    ax.barh([i - 0.2 for i in y], t.no_show * 100, height=0.38, color=NARANJA, label="No-show")
    for i, (c, n) in enumerate(zip(t.cancelada, t.no_show)):
        ax.text(c * 100 + 0.2, i + 0.2, f"{c:.1%}", va="center", fontsize=8, color=TEXTO)
        ax.text(n * 100 + 0.2, i - 0.2, f"{n:.1%}", va="center", fontsize=8, color=TEXTO)
    ax.set_yticks(list(y))
    ax.set_yticklabels(t.index, fontsize=9)
    ax.set_xlabel("% de reservas con desenlace conocido")
    ax.set_title("Cancelación y no-show por canal", loc="left", fontsize=12, fontweight="bold")
    ax.legend(frameon=False, fontsize=8, loc="lower right")
    fig.tight_layout()
    fig.savefig(args.informes / "cancelacion_por_canal.png", dpi=150, facecolor=SUPERFICIE)
    plt.close(fig)
    ultima = df.fecha_creacion.max().date()
    futuras = int((df.fecha_checkin.dt.date > ultima).sum())
    p(f"\nÚltima reserva creada: {ultima}. Hay {futuras} reservas con llegada posterior: son reservas ya hechas")
    p("hacia el futuro. El primer mes y los últimos del periodo están incompletos; en el Paso 3 no se")
    p("usan como si fueran meses completos (se mide la ocupación solo donde la historia está completa).")
    p("\nGráficas guardadas en ml/informes/: reservas_por_mes.png, noches_por_reserva.png, cancelacion_por_canal.png")

    (args.informes / "calidad_datos.txt").write_text("\n".join(_informe) + "\n", encoding="utf-8")
    print("\nInforme guardado en ml/informes/calidad_datos.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
