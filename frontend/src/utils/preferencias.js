import { PREFERENCIAS_BANDERAS } from "./status";

export const PREFERENCIAS_VACIAS = { piso: "", vista: "", cama: "", tranquila: false, accesible: false };

/** Estado del formulario a partir de lo que guarda la API */
export const preferenciasDesde = (pref) => ({ ...PREFERENCIAS_VACIAS, ...(pref ?? {}) });

export function preferenciasPayload(values) {
  const out = {};
  ["piso", "vista", "cama"].forEach((k) => values[k] && (out[k] = values[k]));
  PREFERENCIAS_BANDERAS.forEach(({ key }) => values[key] && (out[key] = true));
  return Object.keys(out).length ? out : null;
}

export const mismasPreferencias = (a, b) => JSON.stringify(preferenciasPayload(a)) === JSON.stringify(preferenciasPayload(b));
