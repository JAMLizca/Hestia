/**
 * Etiquetas y colores de estados. Los valores de estado son exactamente los
 * definidos por el backend (schemas/reserva.py y schemas/habitacion.py);
 * los colores son los del mockup.
 */
export const COLORS = {
  green: "#4CAF82",
  gold: "#C9A052",
  orange: "#E88C30",
  navy: "#2B3650",
  red: "#EF4444",
  gray: "#9CA3AF",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
};

export const RESERVA_ESTADOS = {
  pendiente: { label: "Pendiente", color: COLORS.orange },
  confirmada: { label: "Confirmada", color: COLORS.green },
  checkin: { label: "Check-in", color: COLORS.gold },
  checkout: { label: "Check-out", color: COLORS.navy },
  cancelada: { label: "Cancelada", color: COLORS.red },
};

// El mockup muestra "Reservadas" (dorado); el backend no tiene ese estado y en su
// lugar usa "limpieza" (la habitación pasa a limpieza tras el check-out).
export const HABITACION_ESTADOS = {
  disponible: { label: "Disponible", plural: "Disponibles", color: COLORS.green },
  ocupada: { label: "Ocupada", plural: "Ocupadas", color: COLORS.navy },
  limpieza: { label: "Limpieza", plural: "Limpieza", color: COLORS.gold },
  mantenimiento: { label: "Mantenimiento", plural: "Mantenimiento", color: COLORS.orange },
};

export const HUESPED_ESTADOS = {
  activo: { label: "Activo", color: COLORS.green },
  "checkin-hoy": { label: "Check-in hoy", color: COLORS.gold },
  confirmada: { label: "Confirmada", color: COLORS.green },
  pendiente: { label: "Pendiente", color: COLORS.orange },
  checkout: { label: "Check-out", color: COLORS.navy },
  cancelada: { label: "Cancelada", color: COLORS.red },
  checkin: { label: "Activo", color: COLORS.green },
  "sin-reservas": { label: "Sin reservas", color: COLORS.gray },
};

// Colores de categoría tal como aparecen en el mockup de Servicios.
const CATEGORIA_COLORES = {
  alimentos: COLORS.green,
  lavanderia: COLORS.purple,
  habitacion: COLORS.navy,
  transporte: COLORS.orange,
  bienestar: COLORS.gold,
  actividades: COLORS.cyan,
};

export function categoriaColor(categoria = "") {
  const key = categoria
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return CATEGORIA_COLORES[key] ?? COLORS.navy;
}
