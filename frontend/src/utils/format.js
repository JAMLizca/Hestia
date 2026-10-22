const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Convierte "YYYY-MM-DD" (o ISO) en Date local sin desfase de zona horaria. */
export function parseDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "27 Ago" — formato usado en las tablas del mockup. */
export function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return `${String(date.getDate()).padStart(2, "0")} ${MESES_CORTOS[date.getMonth()]}`;
}

/** "Miércoles, 27 de agosto 2026" — subtítulo del header del mockup. */
export function formatLongToday(date = new Date()) {
  const dia = date.toLocaleDateString("es-CO", { weekday: "long" });
  const mes = date.toLocaleDateString("es-CO", { month: "long" });
  return `${capitalize(dia)}, ${date.getDate()} de ${mes} ${date.getFullYear()}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function capitalize(text = "") {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function initials(name = "") {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** YYYY-MM-DD de hoy en hora local (para filtros de fecha). */
export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Noches entre check-in y check-out previstos. */
export function nights(checkin, checkout) {
  const a = parseDate(checkin);
  const b = parseDate(checkout);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

// Moneda con la que se muestran los montos. La fija ConfigProvider según la
// configuración del hotel (GET /configuracion/); mientras no cargue se usa COP.
let moneda = "COP";
const formateadores = {};

export function configureFormat(config) {
  moneda = config?.moneda || "COP";
}

function formateador(code) {
  formateadores[code] ??= new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });
  return formateadores[code];
}

/** Montos: el backend devuelve Decimal serializado como string. Ej.: "$150.000". */
export function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  // Se quitan los espacios entre el símbolo y la cifra para mantener "$150.000".
  return formateador(moneda)
    .formatToParts(n)
    .filter((part) => !(part.type === "literal" && !part.value.trim()))
    .map((part) => part.value)
    .join("");
}
