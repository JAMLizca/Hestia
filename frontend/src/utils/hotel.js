/**
 * Cálculos de presentación a partir de los datos reales de la API.
 * No reemplazan reglas del backend: solo agregan/filtran lo que ya devuelve.
 */
import { parseDate, todayISO } from "./format";

// Mismos estados que el backend usa para bloquear una habitación (reservas.py).
export const ESTADOS_ACTIVOS = ["pendiente", "confirmada", "checkin"];
// Estados en los que el backend permite agregar/quitar servicios (reserva_servicios.py).
export const ESTADOS_MODIFICABLES = ["pendiente", "confirmada", "checkin"];
// Estados que el backend permite cancelar (reservas.py → cancelar_reserva).
export const ESTADOS_CANCELABLES = ["pendiente", "confirmada"];

export function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

/** Para fechas con hora (datetime del backend) se compara la fecha local. */
export function isToday(value) {
  if (!value) return false;
  const str = String(value);
  if (str.length <= 10) return str === todayISO();
  const date = parseDate(str);
  return date ? todayISO(date) === todayISO() : false;
}

export function fullName(huesped) {
  return huesped ? `${huesped.nombres} ${huesped.apellidos}`.trim() : "—";
}

/** Siguiente transición de estado disponible en el backend para una reserva. */
export function nextStep(estado) {
  switch (estado) {
    case "pendiente":
      return { action: "confirmar", label: "Confirmar" };
    case "confirmada":
      return { action: "checkin", label: "Registrar check-in" };
    case "checkin":
      return { action: "checkout", label: "Registrar check-out" };
    default:
      return null;
  }
}

/**
 * Estado que se muestra para un huésped (columna "Estado" del mockup de Huéspedes),
 * derivado de su reserva más relevante.
 */
export function guestStatus(reservasHuesped = []) {
  if (!reservasHuesped.length) return { key: "sin-reservas", reserva: null };
  const activas = reservasHuesped.filter((r) => r.estado === "checkin");
  if (activas.length) return { key: "activo", reserva: activas[0] };

  const proximas = reservasHuesped
    .filter((r) => r.estado === "pendiente" || r.estado === "confirmada")
    .sort((a, b) => dateOnly(a.fecha_checkin_prevista).localeCompare(dateOnly(b.fecha_checkin_prevista)));
  if (proximas.length) {
    const r = proximas[0];
    if (isToday(r.fecha_checkin_prevista)) return { key: "checkin-hoy", reserva: r };
    return { key: r.estado, reserva: r };
  }

  const ultima = [...reservasHuesped].sort((a, b) =>
    dateOnly(b.fecha_checkin_prevista).localeCompare(dateOnly(a.fecha_checkin_prevista)),
  )[0];
  return { key: ultima.estado, reserva: ultima };
}

/** Lunes de la semana de `date`. */
export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Ocupación de cada noche de la semana actual: habitaciones con una reserva
 * activa (o ya finalizada) que cubre esa noche / total de habitaciones.
 */
export function weeklyOccupancy(reservas = [], totalHabitaciones = 0, date = new Date()) {
  const monday = startOfWeek(date);
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return labels.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const iso = todayISO(day);
    const habitaciones = new Set(
      reservas
        .filter((r) => r.estado !== "cancelada")
        .filter((r) => dateOnly(r.fecha_checkin_prevista) <= iso && dateOnly(r.fecha_checkout_prevista) > iso)
        .map((r) => r.habitacion_id),
    );
    const pct = totalHabitaciones ? Math.round((habitaciones.size / totalHabitaciones) * 100) : 0;
    return { label, iso, pct, isToday: iso === todayISO(date) };
  });
}

/** Actividad reciente: eventos con fecha real registrada por el backend. */
export function recentActivity(reservas = [], { huespedes = {}, habitaciones = {} } = {}, limit = 4) {
  const events = [];
  reservas.forEach((r) => {
    const quien = `${fullName(huespedes[r.huesped_id])} — Habitación ${habitaciones[r.habitacion_id]?.numero ?? "—"}`;
    if (r.fecha_creacion) events.push({ type: "reserva", title: "Nueva reserva registrada", text: quien, at: r.fecha_creacion });
    if (r.fecha_checkin_real) events.push({ type: "checkin", title: "Check-in realizado", text: quien, at: r.fecha_checkin_real });
    if (r.fecha_checkout_real) events.push({ type: "checkout", title: "Check-out completado", text: quien, at: r.fecha_checkout_real });
  });
  return events
    .filter((e) => parseDate(e.at))
    .sort((a, b) => parseDate(b.at) - parseDate(a.at))
    .slice(0, limit);
}

/** "Hace 5 min", "Hace 2 h", "Hace 3 días". */
export function timeAgo(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return "";
  const mins = Math.max(0, Math.round((now - date) / 60000));
  if (mins < 1) return "Justo ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** Texto de búsqueda normalizado (sin tildes, minúsculas). */
export function normalize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matches(query, ...fields) {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some((f) => normalize(f ?? "").includes(q));
}
