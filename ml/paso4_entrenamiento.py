"""
PASO 4 — Entrenamiento, comparación contra líneas base y guardado de los modelos.

Para cada modelo se hace lo mismo:

  1. Líneas base: reglas SIMPLES (sin aprendizaje automático) que cualquier hotel podría aplicar.
     Si el modelo no las supera con claridad, no justifica su complejidad.
  2. Candidatos: varios algoritmos de scikit-learn. Se comparan con validación cruzada POR TIEMPO
     (siempre se entrena con el pasado y se valida con lo que viene después) usando solo el
     conjunto de entrenamiento.
  3. El modelo que se despliega es siempre el LINEAL (Ridge / regresión logística): se puede exportar a un
     archivo JSON pequeño y la API lo calcula sin scikit-learn ni pandas (menos memoria y sin riesgo de versiones).
     Los modelos complejos se prueban solo para comprobar si justificarían el cambio (mejora de más de 3 %).
  4. El desplegado se mide UNA sola vez en el conjunto de prueba (los últimos meses), que el entrenamiento
     nunca vio, y luego se reentrena con todos los datos y se guarda en ml/modelos/ (.joblib + .json).

  MODELO 1 · ocupación a 7, 14 y 30 días   → ml/modelos/ocupacion_h7.joblib (h14, h30)
  MODELO 2 · tipo de habitación recomendado → ml/modelos/recomendador.joblib

Salidas para la documentación: ml/informes/modelos.txt, tres gráficas .png y pronostico_prueba.csv.

USO:
    python ml/paso4_entrenamiento.py
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import sklearn  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.linear_model import LogisticRegression, Ridge  # noqa: E402
from sklearn.metrics import log_loss, mean_absolute_error, r2_score, root_mean_squared_error  # noqa: E402
from sklearn.model_selection import TimeSeriesSplit  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import OneHotEncoder, StandardScaler  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
HORIZONTES = [7, 14, 30]
SEMILLA = 42
TOLERANCIA = 0.03  # un modelo complejo solo justificaría reemplazar al lineal si lo mejora en más de 3 %

# Variables de cada modelo (el orden y los nombres se guardan junto al modelo para la API)
OCUP_NUM = ["en_libros_pct", "en_libros_sem_pct", "nuevas_7d", "nuevas_28d", "ocup_ult7", "ocup_ult28", "es_finde"]
OCUP_CAT = ["dia_semana", "mes"]
RECO_NUM = ["num_huespedes", "noches", "anticipacion_dias", "llegada_fin_de_semana", "huesped_recurrente",
            "reservas_previas_huesped", "extranjero", "pref_tranquila", "pref_accesible", "mes_llegada", "dia_semana_llegada"]
RECO_CAT = ["num_huespedes", "canal", "temporada", "pref_piso", "pref_vista", "pref_cama"]

# Colores de las gráficas (paleta validada: azul y naranja se distinguen incluso con daltonismo)
SUPERFICIE, TEXTO, TEXTO_SUAVE, AZUL, NARANJA = "#fcfcfb", "#0b0b0b", "#52514e", "#2a78d6", "#eb6834"

_informe: list[str] = []


def p(texto: str = "") -> None:
    print(texto)
    _informe.append(texto)


def titulo(texto: str) -> None:
    p()
    p("=" * 78)
    p(texto)
    p("=" * 78)


def preprocesador(num: list[str], cat: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        [("num", StandardScaler(), num), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)],
        sparse_threshold=0,  # matriz densa: algunos algoritmos no aceptan matrices dispersas
    )


def estilo_ejes(ax, grilla: str = "y") -> None:
    ax.set_facecolor(SUPERFICIE)
    for lado in ("top", "right", "left"):
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color("#cfcdc6")
    ax.tick_params(colors=TEXTO_SUAVE, length=0)
    ax.grid(False)
    (ax.yaxis if grilla == "y" else ax.xaxis).grid(True, color="#ecebe6", linewidth=0.8)
    ax.set_axisbelow(True)


def guardar(fig, ruta: Path) -> None:
    fig.tight_layout()
    fig.savefig(ruta, dpi=150, facecolor=SUPERFICIE)
    plt.close(fig)


# =============================================================================================
# MODELO 1 · OCUPACIÓN
# =============================================================================================
def candidatos_ocupacion() -> dict:
    return {
        "Regresión lineal (Ridge)": lambda: Ridge(alpha=10.0),
        "Bosque aleatorio": lambda: RandomForestRegressor(n_estimators=300, min_samples_leaf=5, random_state=SEMILLA, n_jobs=-1),
        "Gradient boosting": lambda: HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, random_state=SEMILLA),
    }


def pipeline_ocupacion(estimador) -> Pipeline:
    return Pipeline([("prep", preprocesador(OCUP_NUM, OCUP_CAT)), ("modelo", estimador)])


def entrenar_ocupacion(datos: pd.DataFrame, modelos_dir: Path, informes: Path) -> None:
    titulo("MODELO 1 · PRONÓSTICO DE OCUPACIÓN (a 7, 14 y 30 días)")
    p("Error = diferencia promedio, en puntos porcentuales de ocupación (MAE). Menor es mejor.")
    p("Modelo desplegado: el lineal. Los complejos se prueban solo para ver si justificarían el cambio.")
    resumen, preds, escogidos = [], [], {}
    columnas = OCUP_NUM + OCUP_CAT

    for h in HORIZONTES:
        t = datos[datos.horizonte == h].sort_values("fecha").reset_index(drop=True)
        tr, te = t[t.conjunto == "entrenamiento"], t[t.conjunto == "prueba"]
        X_tr, y_tr, X_te, y_te = tr[columnas], tr.ocupacion_real, te[columnas], te.ocupacion_real

        # --- líneas base (sin aprendizaje automático)
        media_dia = tr.groupby("dia_semana").ocupacion_real.mean()
        bases = {
            "Promedio histórico del mismo día de la semana": te.dia_semana.map(media_dia).to_numpy(),
            "Solo las reservas en libros (sin ajustar)": te.en_libros_pct.to_numpy(),
            "Ocupación de los últimos 28 días": te.ocup_ult28.to_numpy(),
        }
        # --- candidatos: validación cruzada por tiempo dentro del entrenamiento
        cv = TimeSeriesSplit(n_splits=5)
        cv_mae = {}
        for nombre, fabrica in candidatos_ocupacion().items():
            errores = []
            for i_tr, i_va in cv.split(X_tr):
                m = pipeline_ocupacion(fabrica()).fit(X_tr.iloc[i_tr], y_tr.iloc[i_tr])
                errores.append(mean_absolute_error(y_tr.iloc[i_va], np.clip(m.predict(X_tr.iloc[i_va]), 0, 100)))
            cv_mae[nombre] = float(np.mean(errores))
        mejor = next(iter(candidatos_ocupacion()))  # el primero es el lineal
        extra = cv_mae[mejor] / min(cv_mae.values()) - 1

        # --- el elegido se mide una sola vez en la prueba
        modelo = pipeline_ocupacion(candidatos_ocupacion()[mejor]()).fit(X_tr, y_tr)
        pred = np.clip(modelo.predict(X_te), 0, 100)
        mae, rmse, r2 = mean_absolute_error(y_te, pred), root_mean_squared_error(y_te, pred), r2_score(y_te, pred)
        mae_bases = {k: mean_absolute_error(y_te, v) for k, v in bases.items()}
        mejor_base = min(mae_bases, key=mae_bases.get)

        p()
        p(f"--- Horizonte: {h} días de anticipación   (entrenamiento {len(tr)} días · prueba {len(te)} días)")
        p("  Líneas base (error en la prueba):")
        for k, v in mae_bases.items():
            p(f"    {k:<50}{v:>6.1f} pp")
        p("  Candidatos (error en validación cruzada, solo entrenamiento):")
        for k, v in cv_mae.items():
            p(f"    {k:<50}{v:>6.1f} pp{'   ← elegido' if k == mejor else ''}")
        p("  Modelos más complejos: " + ("no mejoran más de 3 %: no justifican reemplazar al lineal." if extra <= TOLERANCIA else f"mejorarían {extra:.0%} en validación; se despliega el lineal por simplicidad, pero conviene revisarlo."))
        mejora = 1 - mae / mae_bases[mejor_base]
        sesgo = float(np.mean(pred - y_te))
        dentro10 = float(np.mean(np.abs(pred - y_te.to_numpy()) <= 10))
        p(f"    Días de la prueba con error menor a 10 puntos: {dentro10:.0%}")
        p(f"  RESULTADO en prueba con «{mejor}»:  MAE {mae:.1f} pp · RMSE {rmse:.1f} pp · R² {r2:.2f}")
        p(f"    Sesgo medio: {sesgo:+.1f} pp (negativo = el modelo se queda corto)  ·  ocupación real media en la prueba: {y_te.mean():.1f}%  ·  en el entrenamiento: {y_tr.mean():.1f}%")
        p(f"    Mejor línea base: {mae_bases[mejor_base]:.1f} pp  →  el modelo reduce el error un {mejora:.0%}")

        resumen.append({"h": h, "modelo": mae, "base": mae_bases[mejor_base], "base_dia": mae_bases["Promedio histórico del mismo día de la semana"]})
        preds.append(pd.DataFrame({"fecha": te.fecha.to_numpy(), "horizonte": h, "real": y_te.to_numpy(), "pronostico": pred.round(2)}))

        # --- reentrenar con todos los datos y guardar
        final = pipeline_ocupacion(candidatos_ocupacion()[mejor]()).fit(t[columnas], t.ocupacion_real)
        joblib.dump(final, modelos_dir / f"ocupacion_h{h}.joblib", compress=3)
        escogidos[h] = {
            "algoritmo": mejor, "mae_prueba_pp": round(mae, 2), "rmse_prueba_pp": round(rmse, 2), "r2_prueba": round(r2, 3),
            "mae_mejor_base_pp": round(mae_bases[mejor_base], 2), "acierto_10pp": round(dentro10, 3), "filas_entrenamiento_final": len(t),
        }

    pd.concat(preds).to_csv(informes / "pronostico_prueba.csv", index=False)
    meta = {
        "modelo": "ocupacion", "horizontes": HORIZONTES, "sklearn": sklearn.__version__, "entrenado": date.today().isoformat(),
        "variables_numericas": OCUP_NUM, "variables_categoricas": OCUP_CAT, "recortar_a": [0, 100],
        "por_horizonte": escogidos,
        "nota": "Entrenado con datos SIMULADOS por el sistema (ml/generar_datos.py); las métricas describen el simulador, no clientes reales.",
    }
    (modelos_dir / "ocupacion_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- gráfica 1: pronóstico a 7 días vs realidad en la prueba
    d7 = pd.concat(preds)
    d7 = d7[d7.horizonte == 7]
    fig, ax = plt.subplots(figsize=(9, 3.8), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    ax.plot(d7.fecha, d7.real, color=AZUL, linewidth=2, label="Ocupación real")
    ax.plot(d7.fecha, d7.pronostico, color=NARANJA, linewidth=2, label="Pronóstico a 7 días")
    ax.set_ylim(0, 105)
    ax.set_ylabel("Ocupación (%)")
    ax.set_title("Pronóstico a 7 días vs ocupación real (periodo de prueba)", loc="left", fontsize=12, fontweight="bold")
    ax.legend(frameon=False, fontsize=9, loc="lower left", ncol=2)
    fig.autofmt_xdate()
    guardar(fig, informes / "pronostico_7_dias.png")

    # --- gráfica 2: error del modelo frente a la línea base por horizonte
    r = pd.DataFrame(resumen)
    fig, ax = plt.subplots(figsize=(6.5, 3.6), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    x = np.arange(len(r))
    ax.bar(x - 0.2, r.base_dia, width=0.38, color=NARANJA, label="Promedio por día de la semana")
    ax.bar(x + 0.2, r.modelo, width=0.38, color=AZUL, label="Modelo")
    for i, (b, m) in enumerate(zip(r.base_dia, r.modelo)):
        ax.text(i - 0.2, b + 0.2, f"{b:.1f}", ha="center", fontsize=8, color=TEXTO)
        ax.text(i + 0.2, m + 0.2, f"{m:.1f}", ha="center", fontsize=8, color=TEXTO)
    ax.set_xticks(x)
    ax.set_xticklabels([f"{h} días" for h in r.h])
    ax.set_ylabel("Error medio (puntos de ocupación)")
    ax.set_title("Error del pronóstico: modelo vs línea base", loc="left", fontsize=12, fontweight="bold")
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    guardar(fig, informes / "error_ocupacion.png")


# =============================================================================================
# MODELO 2 · RECOMENDADOR
# =============================================================================================
def candidatos_recomendador() -> dict:
    return {
        "Regresión logística": lambda: LogisticRegression(max_iter=3000, C=1.0),
        "Bosque aleatorio": lambda: RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=SEMILLA, n_jobs=-1),
        "Gradient boosting": lambda: HistGradientBoostingClassifier(max_depth=4, learning_rate=0.05, max_iter=200, random_state=SEMILLA),
    }


def pipeline_reco(estimador) -> Pipeline:
    return Pipeline([("prep", preprocesador(RECO_NUM, RECO_CAT)), ("modelo", estimador)])


def proba_completa(modelo, X: pd.DataFrame, clases: np.ndarray) -> np.ndarray:
    """Probabilidades con una columna por cada tipo (aunque el modelo no haya visto alguno)."""
    out = np.zeros((len(X), len(clases)))
    idx = [list(clases).index(c) for c in modelo.classes_]
    out[:, idx] = modelo.predict_proba(X)
    return out


def top_k(y: np.ndarray, proba: np.ndarray, clases: np.ndarray, k: int) -> float:
    mejores = np.argsort(-proba, axis=1)[:, :k]
    return float(np.mean([y[i] in set(clases[mejores[i]]) for i in range(len(y))]))


def entrenar_recomendador(datos: pd.DataFrame, modelos_dir: Path, informes: Path) -> None:
    titulo("MODELO 2 · RECOMENDADOR DE TIPO DE HABITACIÓN")
    p("Top-1 = acertó el tipo con su primera sugerencia · Top-3 = el tipo real está entre sus 3 primeras sugerencias.")
    p("Modelo desplegado: el lineal (regresión logística). Los complejos se prueban solo para ver si justificarían el cambio.")
    datos = datos.sort_values("fecha_creacion", kind="stable").reset_index(drop=True)
    columnas = sorted(set(RECO_NUM + RECO_CAT))
    tr, te = datos[datos.conjunto == "entrenamiento"], datos[datos.conjunto == "prueba"]
    X_tr, y_tr, X_te, y_te = tr[columnas], tr.tipo_habitacion.to_numpy(), te[columnas], te.tipo_habitacion.to_numpy()
    clases = np.array(sorted(datos.tipo_habitacion.unique()))

    # --- líneas base
    frec = pd.Series(y_tr).value_counts(normalize=True).reindex(clases).fillna(0).to_numpy()
    p_base1 = np.tile(frec, (len(te), 1))
    tabla = pd.crosstab(tr.num_huespedes, tr.tipo_habitacion, normalize="index").reindex(columns=clases).fillna(0)
    p_base2 = np.vstack([tabla.loc[g].to_numpy() if g in tabla.index else frec for g in te.num_huespedes])
    bases = {
        "Siempre el tipo más frecuente": p_base1,
        "Regla simple: el tipo más común para ese tamaño de grupo": p_base2,
    }
    p()
    p(f"{'Línea base (sin aprendizaje automático)':<62}{'Top-1':>8}{'Top-3':>8}")
    metricas_base = {}
    for k, pr in bases.items():
        metricas_base[k] = (top_k(y_te, pr, clases, 1), top_k(y_te, pr, clases, 3))
        p(f"  {k:<60}{metricas_base[k][0]:>8.1%}{metricas_base[k][1]:>8.1%}")

    # --- candidatos con validación cruzada por tiempo
    cv = TimeSeriesSplit(n_splits=5)
    cv_ll = {}
    for nombre, fabrica in candidatos_recomendador().items():
        perdidas = []
        for i_tr, i_va in cv.split(X_tr):
            m = pipeline_reco(fabrica()).fit(X_tr.iloc[i_tr], y_tr[i_tr])
            perdidas.append(log_loss(y_tr[i_va], proba_completa(m, X_tr.iloc[i_va], clases), labels=clases))
        cv_ll[nombre] = float(np.mean(perdidas))
    mejor = next(iter(candidatos_recomendador()))  # el primero es el lineal
    extra = cv_ll[mejor] / min(cv_ll.values()) - 1
    p()
    p("Candidatos: pérdida logarítmica en validación cruzada (solo entrenamiento; menor es mejor)")
    for k, v in cv_ll.items():
        p(f"  {k:<30}{v:>8.3f}{'   ← elegido' if k == mejor else ''}")

    p("Modelos más complejos: " + ("no mejoran más de 3 %: no justifican reemplazar a la regresión logística." if extra <= TOLERANCIA else f"mejorarían {extra:.0%} en validación; se despliega el lineal por simplicidad, pero conviene revisarlo."))

    # --- medición única en la prueba (todos los candidatos, para la tabla del informe)
    p()
    p(f"{'Resultado en el conjunto de prueba':<62}{'Top-1':>8}{'Top-3':>8}")
    resultados = {}
    for nombre, fabrica in candidatos_recomendador().items():
        m = pipeline_reco(fabrica()).fit(X_tr, y_tr)
        pr = proba_completa(m, X_te, clases)
        resultados[nombre] = (top_k(y_te, pr, clases, 1), top_k(y_te, pr, clases, 3), m, pr)
        p(f"  {nombre + (' (elegido)' if nombre == mejor else ''):<60}{resultados[nombre][0]:>8.1%}{resultados[nombre][1]:>8.1%}")
    t1, t3, modelo, pr = resultados[mejor]
    b1, b3 = metricas_base["Regla simple: el tipo más común para ese tamaño de grupo"]
    p()
    p(f"«{mejor}» frente a la regla simple por tamaño de grupo:  Top-1 {t1:.1%} vs {b1:.1%}  ·  Top-3 {t3:.1%} vs {b3:.1%}")

    p("\nAcierto Top-1 y Top-3 según el tamaño del grupo (conjunto de prueba):")
    top1 = clases[np.argmax(pr, axis=1)]
    por_grupo = pd.DataFrame({"g": te.num_huespedes.to_numpy(), "top1": top1 == y_te, "top3": [y_te[i] in set(clases[np.argsort(-pr[i])[:3]]) for i in range(len(y_te))]})
    g = por_grupo.groupby("g").agg(reservas=("top1", "size"), top1=("top1", "mean"), top3=("top3", "mean"))
    p(g.assign(top1=g.top1.map("{:.0%}".format), top3=g.top3.map("{:.0%}".format)).to_string())

    # --- qué variables pesan más (para explicar cada recomendación)
    imp = permutation_importance(modelo, X_te, y_te, n_repeats=5, random_state=SEMILLA, scoring="neg_log_loss")
    orden = pd.Series(imp.importances_mean, index=columnas).sort_values(ascending=False)
    p("\nImportancia de cada variable (cuánto empeora el modelo si se desordena; mayor = más influyente):")
    for k, v in orden.head(8).items():
        p(f"  {k:<28}{v:>8.3f}")

    # --- reentrenar con todo y guardar
    final = pipeline_reco(candidatos_recomendador()[mejor]()).fit(datos[columnas], datos.tipo_habitacion.to_numpy())
    joblib.dump(final, modelos_dir / "recomendador.joblib", compress=3)
    meta = {
        "modelo": "recomendador", "sklearn": sklearn.__version__, "entrenado": date.today().isoformat(), "algoritmo": mejor,
        "clases": list(final.classes_), "variables": columnas, "variables_numericas": RECO_NUM, "variables_categoricas": RECO_CAT,
        "top1_prueba": round(t1, 4), "top3_prueba": round(t3, 4), "top1_regla_simple": round(b1, 4), "top3_regla_simple": round(b3, 4),
        "importancia": {k: round(float(v), 4) for k, v in orden.items()}, "filas_entrenamiento_final": len(datos),
        "nota": "Entrenado con datos SIMULADOS por el sistema (ml/generar_datos.py); las métricas describen el simulador, no clientes reales.",
    }
    (modelos_dir / "recomendador_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- gráfica 3: Top-1 y Top-3 de cada opción
    filas = [(k, *v) for k, v in metricas_base.items()] + [(k, v[0], v[1]) for k, v in resultados.items()]
    etiquetas = ["Tipo más frecuente", "Regla por tamaño\nde grupo"] + [f"{k}" for k in resultados]
    fig, ax = plt.subplots(figsize=(9, 3.8), facecolor=SUPERFICIE)
    estilo_ejes(ax)
    x = np.arange(len(filas))
    ax.bar(x - 0.2, [f[1] * 100 for f in filas], width=0.38, color=AZUL, label="Top-1")
    ax.bar(x + 0.2, [f[2] * 100 for f in filas], width=0.38, color=NARANJA, label="Top-3")
    for i, f in enumerate(filas):
        ax.text(i - 0.2, f[1] * 100 + 1, f"{f[1]:.0%}", ha="center", fontsize=8, color=TEXTO)
        ax.text(i + 0.2, f[2] * 100 + 1, f"{f[2]:.0%}", ha="center", fontsize=8, color=TEXTO)
    ax.set_xticks(x)
    ax.set_xticklabels(etiquetas, fontsize=8)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Acierto (%)")
    ax.set_title("Recomendador: acierto en el conjunto de prueba", loc="left", fontsize=12, fontweight="bold")
    ax.legend(frameon=False, fontsize=8, loc="upper left", ncol=2)
    guardar(fig, informes / "acierto_recomendador.png")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", type=Path, default=RAIZ / "ml" / "datos")
    ap.add_argument("--informes", type=Path, default=RAIZ / "ml" / "informes")
    ap.add_argument("--modelos", type=Path, default=RAIZ / "ml" / "modelos")
    args = ap.parse_args()
    for d in (args.informes, args.modelos):
        d.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": TEXTO, "axes.labelcolor": TEXTO_SUAVE})

    entrenar_ocupacion(pd.read_csv(args.datos / "modelo_ocupacion.csv", parse_dates=["fecha"]), args.modelos, args.informes)
    entrenar_recomendador(pd.read_csv(args.datos / "modelo_recomendador.csv", parse_dates=["fecha_creacion"]), args.modelos, args.informes)

    titulo("ARCHIVOS GENERADOS")
    for f in sorted(args.modelos.glob("*")):
        if f.name != ".gitkeep":
            p(f"  ml/modelos/{f.name:<28}{f.stat().st_size / 1024:>8.0f} KB")
    p(f"  (entrenado con scikit-learn {sklearn.__version__}. Estos .joblib son solo para el análisis: la API usa los JSON del Paso 5.)")
    (args.informes / "modelos.txt").write_text("\n".join(_informe) + "\n", encoding="utf-8")
    print("\nInforme guardado en ml/informes/modelos.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
