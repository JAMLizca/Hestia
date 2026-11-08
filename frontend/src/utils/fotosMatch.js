/** Convierte un texto en identificador: "Suite Familiar" -> "suite-familiar". */
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
