import { apiRequest } from "../../api/client";

/**
acceso a los modelos de ML.
 */
export const MENSAJE_NO_DISPONIBLE = "Opción no disponible temporalmente";

function conAviso(err) {
  if (err?.status === 503) err.message = MENSAJE_NO_DISPONIBLE;
  throw err;
}

export function predecirOcupacion({ desde, dias }) {
  return apiRequest("/prediccion/ocupacion", { query: { desde, dias } }).catch(conAviso);
}

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
