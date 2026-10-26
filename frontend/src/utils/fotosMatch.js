/** Convierte un texto en identificador: "Suite Familiar" → "suite-familiar". */
export function slug(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const GENERICAS = new Set(["habitacion", "cuarto", "tipo", "foto", "imagen"]);

const tokens = (texto) => slug(texto).split("-").filter((t) => t && !GENERICAS.has(t));

/**
 * Busca, entre los nombres de archivo disponibles (`ids`, ya en formato slug), el que
 * corresponde a un tipo de habitación. Orden de preferencia:
 *  1. Nombre idéntico:            "Suite Familiar"       → suite-familiar
 *  2. Igual sin palabras genéricas: "Habitación Estándar" → estandar  (o habitacion-estandar)
 *  3. Variantes numeradas/extra:  "Suite Familiar"       → suite-familiar-2 (el primero por orden)
 * Devuelve el id o undefined.
 */
export function idParaTipo(nombreTipo, ids) {
  const objetivo = slug(nombreTipo);
  if (!objetivo) return undefined;
  if (ids.includes(objetivo)) return objetivo;

  const tTipo = tokens(nombreTipo);
  if (!tTipo.length) return undefined;
  const clave = tTipo.join("-");

  const sinGenericas = ids.find((id) => tokens(id).join("-") === clave);
  if (sinGenericas) return sinGenericas;

  return [...ids].sort().find((id) => {
    const t = tokens(id);
    return t.length > tTipo.length && tTipo.every((x, i) => t[i] === x);
  });
}
