# Machine Learning de Hestia

Dos modelos para «Hestia Intelligence»: **predicción de ocupación** (7, 14 y 30 días) y **recomendación de tipo de
habitación**. Los datos salen del propio sistema (sin descargas externas): se generan como reservas simuladas dentro
de la base (`generar_datos.py`) y se exportan con el mismo código del reporte «Dataset de reservas».

```
ml/
  generar_datos.py              Paso 1  escribe un historial simulado en la base (base local nueva: hestia_ml)
  exportar_dataset.py           Paso 1  base de datos  ->  ml/datos/reservas.csv y habitaciones.csv
  paso2_exploracion_limpieza.py Paso 2  validación, exploración y limpieza con pandas  ->  reservas_limpio.csv
  paso3_variables.py            Paso 3  variables y partición por fechas  ->  modelo_ocupacion.csv, modelo_recomendador.csv
  paso4_entrenamiento.py        Paso 4  entrena, compara contra líneas base y guarda en ml/modelos/
  paso5_exportar_modelos.py     Paso 5  exporta a app/ml/modelos/*.json y comprueba que da lo mismo que scikit-learn
  datos/                        CSV (no se suben a git: se regeneran con la misma semilla)
  informes/                     informes de calidad y de modelos + gráficas (sí se suben: van a la documentación)
  modelos/                      modelos entrenados (.joblib) y métricas (.json)
  requirements-ml.txt           librerías para entrenar (versiones fijas)
app/ml/
  prediccion.py                 evalúa los modelos exportados en Python puro (sin scikit-learn ni pandas)
  modelos/*.json                los modelos que usa la API (viajan en la imagen de Render)
```

## Comandos

```bash
pip install -r ml/requirements-ml.txt

# Base local aparte para no mezclar datos simulados con los reales
mysql -u root -p -e "CREATE DATABASE hestia_ml CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
DB_NAME=hestia_ml ADMIN_NOMBRE='Admin ML' ADMIN_EMAIL=admin@ml.local ADMIN_PASSWORD='<tu_clave>' python deploy/inicializar.py

DB_NAME=hestia_ml python ml/generar_datos.py --ver      # resumen sin guardar
DB_NAME=hestia_ml python ml/generar_datos.py            # genera ~2 años de historia
DB_NAME=hestia_ml python ml/exportar_dataset.py         # crea ml/datos/reservas.csv y habitaciones.csv
python ml/paso2_exploracion_limpieza.py
python ml/paso3_variables.py
python ml/paso4_entrenamiento.py
python ml/paso5_exportar_modelos.py
DB_NAME=hestia_ml python ml/generar_datos.py --borrar   # quita lo simulado de la base
```

## Decisiones de diseño

- **Sin fuga de información.** Cada variable existe en el momento de la predicción. Para el recomendador se excluyen
  `precio_*` (se deduce del tipo), `piso` (es la habitación ya asignada) y todo lo posterior a reservar. Para la
  ocupación, la variable clave es lo «en libros» al día de origen (reservas ya hechas que cubren esa noche).
- **Partición por fechas, no al azar.** Se entrena con el pasado y se evalúa con los últimos 120 días (ocupación) o el
  20 % más reciente de reservas (recomendador). La validación cruzada también respeta el orden del tiempo.
- **Siempre contra una línea base.** Un modelo solo se justifica si supera reglas simples que cualquier hotel aplicaría.
- **Modelo lineal en producción.** Ridge (ocupación) y regresión logística (recomendador): los modelos complejos
  (bosque aleatorio, gradient boosting) no mejoraron más de 3 % en validación, así que no justifican su costo. Los
  lineales se exportan a JSON y la API los calcula en Python puro: no hace falta instalar scikit-learn ni pandas en
  Render (menos memoria, imagen más liviana y sin riesgo de que cambie una versión).

## Resultados (datos simulados, semilla 42; varían un poco según la fecha en que se generan)

| Pronóstico de ocupación | Error del modelo | Mejor regla simple | Mejora |
|---|---|---|---|
| a 7 días | 7,3 puntos | 9,6 | 25 % |
| a 14 días | 9,1 puntos | 14,6 | 37 % |
| a 30 días | 12,1 puntos | 14,6 | 17 % |

| Recomendador (tipo de habitación) | Top-1 | Top-3 |
|---|---|---|
| Siempre el tipo más frecuente | 28,0 % | 64,5 % |
| Regla simple por tamaño de grupo | 43,5 % | 84,9 % |
| Regresión logística (desplegado) | 46,1 % | 88,0 % |

El tamaño del grupo explica casi toda la señal del recomendador; la preferencia de cama es la segunda variable. A 30 días
el pronóstico mejora poco: todavía hay pocas reservas hechas.

## Honestidad sobre los datos

Los datos son **sintéticos**: reproducen patrones plausibles (temporadas, fines de semana, canales, perfiles de huésped,
cancelaciones), pero los modelos aprenden las reglas del simulador, no a clientes reales. Las métricas describen el
simulador. Con historial real se reentrena con el mismo procedimiento (Pasos 2 a 5). Esto debe constar en la documentación
del proyecto. No se usaron festivos ni eventos locales (`app/ml/calendario.py` los calcula, pero el simulador no los
incluye, así que el modelo no podría aprenderlos: es una mejora natural al contar con datos reales).
