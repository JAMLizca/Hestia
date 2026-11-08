/**
 * Etiquetas y colores de estados. 
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
  no_show: { label: "No se presentó", color: COLORS.gray },
};

// Pagos
export const PAGO_ESTADOS = {
  pagado: { label: "Pagado", color: COLORS.green },
  pendiente: { label: "En curso", color: COLORS.gold },
  rechazado: { label: "Rechazado", color: COLORS.red },
  anulado: { label: "Anulado", color: COLORS.gray },
};

// Pre-check-in
export const PRECHECKIN_ESTADOS = {
  enviado: { label: "Enlace enviado", color: COLORS.gray },
  completado: { label: "Por validar", color: COLORS.gold },
  validado: { label: "Validado", color: COLORS.green },
};

// Cómo llegó la reserva
export const CANALES = [
  { value: "presencial", label: "En recepción" },
  { value: "telefono", label: "Teléfono" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "correo", label: "Correo" },
  { value: "web", label: "Página web" },
  { value: "otro", label: "Otro" },
];
export const canalLabel = (value) => CANALES.find((c) => c.value === value)?.label ?? value ?? "—";

// Temporada de la estadía
export const TEMPORADAS = { alta: "Alta", media: "Media", baja: "Baja" };
export const temporadaLabel = (value) => TEMPORADAS[value] ?? value ?? "—";

// Preferencias del huésped por reserva 
export const PREFERENCIAS_OPCIONES = {
  piso: [
    { value: "bajo", label: "Piso bajo" },
    { value: "alto", label: "Piso alto" },
  ],
  vista: [
    { value: "exterior", label: "Vista exterior" },
    { value: "interior", label: "Vista interior" },
  ],
  cama: [
    { value: "doble", label: "Cama doble" },
    { value: "sencillas", label: "Camas sencillas" },
  ],
};
export const PREFERENCIAS_BANDERAS = [
  { key: "tranquila", label: "Habitación tranquila" },
  { key: "accesible", label: "Accesible (movilidad reducida)" },
];

export function preferenciasLabel(pref) {
  if (!pref) return "—";
  const partes = Object.entries(PREFERENCIAS_OPCIONES).map(([clave, opciones]) => opciones.find((o) => o.value === pref[clave])?.label);
  PREFERENCIAS_BANDERAS.forEach(({ key, label }) => pref[key] && partes.push(label));
  const texto = partes.filter(Boolean).join(" · ");
  return texto || "—";
}

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
  no_show: { label: "No se presentó", color: COLORS.gray },
  checkin: { label: "Activo", color: COLORS.green },
  "sin-reservas": { label: "Sin reservas", color: COLORS.gray },
};

// Colores de categoría.
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
