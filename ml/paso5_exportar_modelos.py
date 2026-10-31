"""
PASO 5 — Exportar los modelos entrenados para que la API los use.

La API NO instala scikit-learn ni pandas: usa modelos lineales guardados como JSON (coeficientes + medias +
categorías) y los calcula en Python puro (app/ml/prediccion.py). Este script:

  1. Lee los modelos entrenados en el Paso 4 (ml/modelos/*.joblib).
  2. Los convierte a JSON en app/ml/modelos/ (esa carpeta SÍ viaja dentro de la imagen de Render).
  3. COMPRUEBA que el cálculo en Python puro da lo mismo que scikit-learn sobre todas las filas de los datos.
     Si hay la más mínima diferencia, se detiene y no deja archivos a medias.

USO:
    python ml/paso5_exportar_modelos.py
"""
import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.ml.prediccion import ModeloLineal  # noqa: E402

TOLERANCIA = 1e-6


def a_json(pipe, tipo: str, meta: dict, recorte=None) -> dict:
    prep, modelo = pipe.named_steps["prep"], pipe.named_steps["modelo"]
    escalador = prep.named_transformers_["num"]
    codificador = prep.named_transformers_["cat"]
    cols_num = [c for nombre, _, cols in prep.transformers_ if nombre == "num" for c in cols]
    cols_cat = [c for nombre, _, cols in prep.transformers_ if nombre == "cat" for c in cols]

    categoricas = []
    for nombre, cats in zip(cols_cat, codificador.categories_):
        numerica = cats.dtype.kind in "iuf"
        categoricas.append({"nombre": nombre, "numerica": bool(numerica), "categorias": [int(c) if numerica else str(c) for c in cats]})

    datos = {
        "tipo": tipo,
        "numericas": [{"nombre": n, "media": float(m), "escala": float(e)} for n, m, e in zip(cols_num, escalador.mean_, escalador.scale_)],
        "categoricas": categoricas,
        "meta": meta,
    }
    if tipo == "regresion":
        if not isinstance(modelo, Ridge):
            raise SystemExit(f"El modelo es {type(modelo).__name__}: solo se exportan modelos Ridge. Vuelve a correr el Paso 4.")
        datos["coeficientes"] = [float(c) for c in modelo.coef_]
        datos["intercepto"] = float(modelo.intercept_)
        datos["recorte"] = recorte
    else:
        if not isinstance(modelo, LogisticRegression):
            raise SystemExit(f"El modelo es {type(modelo).__name__}: solo se exportan regresiones logísticas. Vuelve a correr el Paso 4.")
        datos["coeficientes"] = [[float(c) for c in fila] for fila in modelo.coef_]
        datos["intercepto"] = [float(b) for b in modelo.intercept_]
        datos["clases"] = [str(c) for c in modelo.classes_]
    return datos


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", type=Path, default=RAIZ / "ml" / "datos")
    ap.add_argument("--modelos", type=Path, default=RAIZ / "ml" / "modelos")
    ap.add_argument("--destino", type=Path, default=RAIZ / "app" / "ml" / "modelos")
    args = ap.parse_args()

    pendientes: dict[str, dict] = {}
    peor = 0.0

    # ---------------------------------------------------------------- ocupación
    meta_o = json.loads((args.modelos / "ocupacion_meta.json").read_text(encoding="utf-8"))
    cols_o = meta_o["variables_numericas"] + meta_o["variables_categoricas"]
    datos_o = pd.read_csv(args.datos / "modelo_ocupacion.csv", parse_dates=["fecha"])
    for h in meta_o["horizontes"]:
        pipe = joblib.load(args.modelos / f"ocupacion_h{h}.joblib")
        por_h = meta_o["por_horizonte"][str(h)]
        meta = {"modelo": "ocupacion", "horizonte_dias": h, "algoritmo": por_h["algoritmo"], "entrenado": meta_o["entrenado"], "sklearn": meta_o["sklearn"],
                "mae_prueba_pp": por_h["mae_prueba_pp"], "acierto_10pp": por_h["acierto_10pp"], "nota": meta_o["nota"]}
        json_modelo = a_json(pipe, "regresion", meta, recorte=meta_o["recortar_a"])
        pendientes[f"ocupacion_h{h}"] = json_modelo

        t = datos_o[datos_o.horizonte == h]
        esperado = np.clip(pipe.predict(t[cols_o]), *meta_o["recortar_a"])
        propio = ModeloLineal(json_modelo)
        obtenido = np.array([propio.predecir(f) for f in t[cols_o].to_dict("records")])
        dif = float(np.max(np.abs(esperado - obtenido)))
        peor = max(peor, dif)
        print(f"  ocupacion_h{h:<3} {len(t):>5} filas comprobadas · diferencia máxima con scikit-learn: {dif:.2e}")

    # ---------------------------------------------------------------- recomendador
    meta_r = json.loads((args.modelos / "recomendador_meta.json").read_text(encoding="utf-8"))
    pipe = joblib.load(args.modelos / "recomendador.joblib")
    datos_r = pd.read_csv(args.datos / "modelo_recomendador.csv")
    meta = {"modelo": "recomendador", "algoritmo": meta_r["algoritmo"], "entrenado": meta_r["entrenado"], "sklearn": meta_r["sklearn"],
            "top1_prueba": meta_r["top1_prueba"], "top3_prueba": meta_r["top3_prueba"], "importancia": meta_r["importancia"], "nota": meta_r["nota"]}
    json_modelo = a_json(pipe, "clasificacion", meta)
    pendientes["recomendador"] = json_modelo
    t = datos_r[meta_r["variables"]]
    esperado = pipe.predict_proba(t)
    propio = ModeloLineal(json_modelo)
    obtenido = np.array([[p[c] for c in json_modelo["clases"]] for p in (propio.probabilidades(f) for f in t.to_dict("records"))])
    dif = float(np.max(np.abs(esperado - obtenido)))
    peor = max(peor, dif)
    coinciden = float(np.mean(np.argmax(esperado, axis=1) == np.argmax(obtenido, axis=1)))
    print(f"  recomendador {len(t):>5} filas comprobadas · diferencia máxima con scikit-learn: {dif:.2e} · misma primera sugerencia: {coinciden:.1%}")

    if peor > TOLERANCIA:
        print(f"\nLa diferencia ({peor:.2e}) supera {TOLERANCIA:.0e}: NO se guardó nada. Avísame con esta salida.")
        return 1

    args.destino.mkdir(parents=True, exist_ok=True)
    print()
    for nombre, contenido in pendientes.items():
        ruta = args.destino / f"{nombre}.json"
        ruta.write_text(json.dumps(contenido, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  app/ml/modelos/{nombre}.json  {ruta.stat().st_size / 1024:.0f} KB")
    print("\nListo: la API ya puede predecir sin scikit-learn. Estos archivos SÍ se suben a git.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
