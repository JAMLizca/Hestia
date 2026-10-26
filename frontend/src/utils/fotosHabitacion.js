import fotoGeneral from "../assets/habitacion.webp";

/**
 * Fotos de habitaciones SIN tocar la base de datos.
 *
 * - Las fotos son archivos de `src/assets/habitaciones/` (webp, jpg, png, avif).
 *   Vite las descubre solo: basta con copiar el archivo y volver a desplegar.
 * - Foto por defecto de un tipo: el archivo cuyo nombre es el del tipo en
 *   minúsculas y con guiones (tipo "Suite Familiar" → `suite-familiar.webp`).
 * - Foto elegida para una habitación concreta: se guarda como marcador
 *   `[foto:nombre-del-archivo]` dentro del campo "características" que ya
 *   existe, y la interfaz lo oculta al mostrar el texto.
 * - Si no hay nada de lo anterior se usa la foto general del hotel.
 */

const archivos = import.meta.glob("../assets/habitaciones/*.{webp,jpg,jpeg,png,avif}", {
  eager: true,
  import: "default",
});

export const FOTO_GENERAL = "general";

/** Convierte un texto en identificador: "Suite Familiar" → "suite-familiar". */
export function slug(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const POR_ID = {};
for (const [ruta, url] of Object.entries(archivos)) {
  const nombre = ruta.split("/").pop().replace(/\.[^.]+$/, "");
  POR_ID[slug(nombre)] = url;
}

/** Fotos que el recepcionista puede elegir: [{ id, url, etiqueta }] (sin la general). */
export const FOTOS_DISPONIBLES = Object.entries(POR_ID)
  .map(([id, url]) => ({ id, url, etiqueta: id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }))
  .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));

const MARCADOR = /\[foto:([a-z0-9_-]+)\]/i;

/** Id de foto elegido dentro de las características ("" si no hay). */
export function fotoElegida(caracteristicas) {
  const m = MARCADOR.exec(caracteristicas ?? "");
  return m ? slug(m[1]) : "";
}

/** Características sin el marcador, listas para mostrar. */
export function textoCaracteristicas(caracteristicas) {
  return (caracteristicas ?? "").replace(new RegExp(MARCADOR, "gi"), "").replace(/\s+/g, " ").trim();
}

/** Devuelve el texto con el marcador de foto actualizado ("" quita la foto elegida). */
export function conFoto(caracteristicas, fotoId) {
  const texto = textoCaracteristicas(caracteristicas);
  if (!fotoId) return texto;
  return texto ? `[foto:${fotoId}] ${texto}` : `[foto:${fotoId}]`;
}

/** Longitud que ocupa el marcador (para respetar el límite de 255 de la columna). */
export function largoMarcador(fotoId) {
  return fotoId ? `[foto:${fotoId}] `.length : 0;
}

/** Foto por defecto de un tipo de habitación (o la general). */
export function fotoDeTipo(nombreTipo) {
  return POR_ID[slug(nombreTipo)] ?? fotoGeneral;
}

/** Foto de una habitación: la elegida → la de su tipo → la general. */
export function fotoDeHabitacion(habitacion, tipo) {
  return POR_ID[fotoElegida(habitacion?.caracteristicas)] ?? fotoDeTipo(tipo?.nombre);
}
