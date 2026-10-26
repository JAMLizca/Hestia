/**
 * Hestia Intelligence: acceso a los modelos de Machine Learning (predicción de ocupación y recomendación de
 * habitaciones). Mientras los modelos no estén conectados al backend, MODELOS_DISPONIBLES es false y toda
 * consulta responde «Opción no disponible temporalmente».
 *
 * Para conectarlos: exponer los endpoints en la API, cambiar la bandera a true y completar las dos funciones
 * (la pantalla ya envía los parámetros y espera el resultado en los formatos indicados abajo).
 */
export const MODELOS_DISPONIBLES = false;
export const MENSAJE_NO_DISPONIBLE = "Opción no disponible temporalmente";

export class NoDisponibleError extends Error {
  constructor() {
    super(MENSAJE_NO_DISPONIBLE);
    this.name = "NoDisponibleError";
  }
}

/**
 * params: { desde: "YYYY-MM-DD", dias: 7|14|30, tipo_habitacion_id?: number }
 * resultado esperado: { dias: [{ fecha, ocupacion_pct }], promedio_pct, dia_pico, confianza_pct }
 */
export async function predecirOcupacion(params) {
  if (!MODELOS_DISPONIBLES) throw new NoDisponibleError();
  throw new Error(`Pendiente: conectar el endpoint del modelo de ocupación (${JSON.stringify(params)})`);
}

/**
 * params: { llegada, salida, huespedes, motivo?, preferencias: { piso?, vista?, cama?, tranquila?, accesible? } }
 * resultado esperado: [{ habitacion_id, numero, tipo, precio_noche, afinidad_pct, motivos: string[] }]
 */
export async function recomendarHabitaciones(params) {
  if (!MODELOS_DISPONIBLES) throw new NoDisponibleError();
  throw new Error(`Pendiente: conectar el endpoint del modelo de recomendación (${JSON.stringify(params)})`);
}
