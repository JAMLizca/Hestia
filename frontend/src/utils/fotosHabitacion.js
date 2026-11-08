import fotoGeneral from "../assets/habitacion.webp";
import { idParaTipo, slug } from "./fotosMatch";

export { slug };

/**
 * Fotos de habitaciones
 * - Las fotos son archivos de `src/assets/habitaciones/` 
 */

const archivos = import.meta.glob("../assets/habitaciones/*.{webp,jpg,jpeg,png,avif}", {
  eager: true,
  import: "default",
});

export const FOTO_GENERAL = "general";

const POR_ID = {};
for (const [ruta, url] of Object.entries(archivos)) {
  const nombre = ruta.split("/").pop().replace(/\.[^.]+$/, "");
  POR_ID[slug(nombre)] = url;
}

export const FOTOS_DISPONIBLES = Object.entries(POR_ID)
  .map(([id, url]) => ({ id, url, etiqueta: id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }))
  .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));

const MARCADOR = /\[foto:([a-z0-9_-]+)\]/i;

export function fotoElegida(caracteristicas) {
  const m = MARCADOR.exec(caracteristicas ?? "");
  return m ? slug(m[1]) : "";
}

export function textoCaracteristicas(caracteristicas) {
  return (caracteristicas ?? "").replace(new RegExp(MARCADOR, "gi"), "").replace(/\s+/g, " ").trim();
}

export function conFoto(caracteristicas, fotoId) {
  const texto = textoCaracteristicas(caracteristicas);
  if (!fotoId) return texto;
  return texto ? `[foto:${fotoId}] ${texto}` : `[foto:${fotoId}]`;
}

export function largoMarcador(fotoId) {
  return fotoId ? `[foto:${fotoId}] `.length : 0;
}

/** Foto por defecto de un tipo de habitación  */
export const fotoGeneralUrl = fotoGeneral;

export function fotoEspecificaDeTipo(nombreTipo) {
  const id = idParaTipo(nombreTipo, Object.keys(POR_ID));
  return id ? POR_ID[id] : undefined;
}

export function fotoDeTipo(nombreTipo) {
  const id = idParaTipo(nombreTipo, Object.keys(POR_ID));
  return (id && POR_ID[id]) || fotoGeneral;
}

export function fotoDeHabitacion(habitacion, tipo) {
  return POR_ID[fotoElegida(habitacion?.caracteristicas)] ?? fotoDeTipo(tipo?.nombre);
}
