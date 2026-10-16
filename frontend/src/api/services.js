/**
 * Servicios por recurso. Cada función corresponde 1:1 a un endpoint
 * existente en app/api/routes del backend. No se agregan endpoints nuevos.
 */
import { apiRequest } from "./client";

// ── Autenticación (routes/auth.py) ──────────────────────────────
export const authApi = {
  /** POST /auth/login — form-data: username (email), password */
  login: (email, password) =>
    apiRequest("/auth/login", { method: "POST", form: { username: email, password }, auth: false }),
  /** GET /auth/me */
  me: () => apiRequest("/auth/me"),
  /** POST /auth/register — { nombre, email, password, rol_id } */
  register: (data) => apiRequest("/auth/register", { method: "POST", body: data }),
};

// ── Roles (routes/roles.py) ─────────────────────────────────────
export const rolesApi = {
  list: () => apiRequest("/roles/"),
  create: (data) => apiRequest("/roles/", { method: "POST", body: data }),
};

// ── Tipos de habitación (routes/tipos_habitacion.py) ────────────
export const tiposHabitacionApi = {
  list: () => apiRequest("/tipos-habitacion/"),
  get: (id) => apiRequest(`/tipos-habitacion/${id}`),
  create: (data) => apiRequest("/tipos-habitacion/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/tipos-habitacion/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/tipos-habitacion/${id}`, { method: "DELETE" }),
};

// ── Habitaciones (routes/habitaciones.py) ───────────────────────
export const habitacionesApi = {
  /** estado: disponible | ocupada | mantenimiento | limpieza */
  list: (estado) => apiRequest("/habitaciones/", { query: { estado } }),
  get: (id) => apiRequest(`/habitaciones/${id}`),
  create: (data) => apiRequest("/habitaciones/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/habitaciones/${id}`, { method: "PUT", body: data }),
  // Nota: DELETE /habitaciones/{id} tiene un bug en el backend (ruta declarada como
  // {habitacion_idz}). Se deja el servicio con el contrato esperado; reportado al equipo.
  remove: (id) => apiRequest(`/habitaciones/${id}`, { method: "DELETE" }),
};

// ── Disponibilidad (routes/disponibilidad.py) ───────────────────
export const disponibilidadApi = {
  /** fechas en formato YYYY-MM-DD */
  check: ({ fecha_checkin, fecha_checkout, tipo_habitacion_id }) =>
    apiRequest("/disponibilidad/", { query: { fecha_checkin, fecha_checkout, tipo_habitacion_id } }),
};

// ── Huéspedes (routes/huespedes.py) ─────────────────────────────
export const huespedesApi = {
  list: () => apiRequest("/huespedes/"),
  get: (id) => apiRequest(`/huespedes/${id}`),
  create: (data) => apiRequest("/huespedes/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/huespedes/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/huespedes/${id}`, { method: "DELETE" }),
};

// ── Reservas (routes/reservas.py) ───────────────────────────────
export const reservasApi = {
  /** filtros opcionales: huesped_id, habitacion_id, estado */
  list: (filtros = {}) => apiRequest("/reservas/", { query: filtros }),
  get: (id) => apiRequest(`/reservas/${id}`),
  /** { huesped_id, habitacion_id, fecha_checkin_prevista, fecha_checkout_prevista, num_huespedes } */
  create: (data) => apiRequest("/reservas/", { method: "POST", body: data }),
  confirmar: (id) => apiRequest(`/reservas/${id}/confirmar`, { method: "POST" }),
  checkin: (id) => apiRequest(`/reservas/${id}/checkin`, { method: "POST" }),
  checkout: (id) => apiRequest(`/reservas/${id}/checkout`, { method: "POST" }),
  cancelar: (id) => apiRequest(`/reservas/${id}/cancelar`, { method: "POST" }),
  remove: (id) => apiRequest(`/reservas/${id}`, { method: "DELETE" }),
  /** GET /reservas/{id}/resumen (routes/facturas.py) */
  resumen: (id) => apiRequest(`/reservas/${id}/resumen`),
};

// ── Servicios (routes/servicios.py) ─────────────────────────────
export const serviciosApi = {
  list: () => apiRequest("/servicios/"),
  get: (id) => apiRequest(`/servicios/${id}`),
  create: (data) => apiRequest("/servicios/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/servicios/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/servicios/${id}`, { method: "DELETE" }),
};

// ── Servicios consumidos en una reserva (routes/reserva_servicios.py)
export const reservaServiciosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/servicios/`),
  /** { servicio_id, cantidad } */
  add: (reservaId, data) => apiRequest(`/reservas/${reservaId}/servicios/`, { method: "POST", body: data }),
  remove: (reservaId, itemId) =>
    apiRequest(`/reservas/${reservaId}/servicios/${itemId}`, { method: "DELETE" }),
};

// ── Pagos (routes/pagos.py) ─────────────────────────────────────
export const pagosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/pagos/`),
  /** { monto, metodo_pago } */
  create: (reservaId, data) => apiRequest(`/reservas/${reservaId}/pagos/`, { method: "POST", body: data }),
};
