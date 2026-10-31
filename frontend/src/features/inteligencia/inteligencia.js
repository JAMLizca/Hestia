import { apiRequest } from "../../api/client";

/**
 * Hestia Intelligence: acceso a los modelos de Machine Learning del backend.
 *
 *  - Predicción de ocupación  → GET /prediccion/ocupacion            (administrador, gerente, auditor)
 *  - Recomendación de personal → GET /recomendacion/habitaciones      (recepción: devuelve habitaciones concretas)
 *  - Recomendación al huésped  → GET /publico/recomendacion           (sin sesión: devuelve tipos de habitación)
 *
 * Los modelos se entrenan con ml/ y se publican como JSON en app/ml/modelos/. Si esos archivos no están en el
 * servidor, la API responde 503 y la pantalla muestra «Opción no disponible temporalmente».
 */
export const MENSAJE_NO_DISPONIBLE = "Opción no disponible temporalmente";

/** Convierte el 503 del backend (modelos ausentes) en el aviso estándar; el resto de errores conserva su mensaje. */
function conAviso(err) {
  if (err?.status === 503) err.message = MENSAJE_NO_DISPONIBLE;
  throw err;
}

/**
 * params: { desde: "YYYY-MM-DD", dias: 1..30 }
 * resultado: { desde, dias: [{ fecha, ocupacion_pct, horizonte_dias }], promedio_pct, dia_pico, dia_pico_pct,
 *              confianza_pct, error_medio_pp, habitaciones, entrenado }
 */
export function predecirOcupacion({ desde, dias }) {
  return apiRequest("/prediccion/ocupacion", { query: { desde, dias } }).catch(conAviso);
}

/**
 * params: { llegada, salida, huespedes, preferencias: { piso?, vista?, cama?, tranquila?, accesible? }, publico?: boolean }
 * resultado: [{ tipo_habitacion_id, tipo, habitacion_id|null, numero|null, piso|null, precio_noche, afinidad_pct, motivos, disponibles }]
 *   - publico = false (recepción): una habitación concreta por cada tipo sugerido.
 *   - publico = true (huésped): solo el tipo; recepción asigna la habitación.
 */
export function recomendarHabitaciones({ llegada, salida, huespedes, preferencias = {}, publico = false }) {
  const prefs = {
    piso: preferencias.piso || undefined,
    vista: preferencias.vista || undefined,
    cama: preferencias.cama || undefined,
    tranquila: preferencias.tranquila ? "true" : undefined,
    accesible: preferencias.accesible ? "true" : undefined,
  };
  const peticion = publico
    ? apiRequest("/publico/recomendacion", { auth: false, query: { fecha_checkin: llegada, fecha_checkout: salida, huespedes, ...prefs } })
    : apiRequest("/recomendacion/habitaciones", { query: { llegada, salida, huespedes, ...prefs } });
  return peticion.catch(conAviso);
}
