import { apiRequest } from "./client";

//Autenticación
export const authApi = {
  login: (email, password) =>
    apiRequest("/auth/login", { method: "POST", form: { username: email, password }, auth: false }),
  me: () => apiRequest("/auth/me"),
  register: (data) => apiRequest("/auth/register", { method: "POST", body: data }),
  changePassword: (data) => apiRequest("/auth/me/password", { method: "PUT", body: data }),
};

//Roles
export const rolesApi = {
  list: () => apiRequest("/roles/"),
  create: (data) => apiRequest("/roles/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/roles/${id}`, { method: "PUT", body: data }),
  permisos: () => apiRequest("/roles/permisos"),
};

//Usuarios
export const usuariosApi = {
  list: () => apiRequest("/usuarios/"),
  get: (id) => apiRequest(`/usuarios/${id}`),
  update: (id, data) => apiRequest(`/usuarios/${id}`, { method: "PUT", body: data }),
  setPassword: (id, password) => apiRequest(`/usuarios/${id}/password`, { method: "PUT", body: { password } }),
};

//Tipos de habitación
export const tiposHabitacionApi = {
  list: () => apiRequest("/tipos-habitacion/"),
  get: (id) => apiRequest(`/tipos-habitacion/${id}`),
  create: (data) => apiRequest("/tipos-habitacion/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/tipos-habitacion/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/tipos-habitacion/${id}`, { method: "DELETE" }),
};

//Habitaciones
export const habitacionesApi = {
  /** estado: disponible | ocupada | mantenimiento | limpieza */
  list: (estado) => apiRequest("/habitaciones/", { query: { estado } }),
  get: (id) => apiRequest(`/habitaciones/${id}`),
  create: (data) => apiRequest("/habitaciones/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/habitaciones/${id}`, { method: "PUT", body: data }),

  // DELETE /habitaciones/{id} tiene un bug en el backend (
  // {habitacion_idz}). Se deja el servicio con el contrato esperado corregir!!!

  remove: (id) => apiRequest(`/habitaciones/${id}`, { method: "DELETE" }),
};

// Pre-check-in
export const precheckinApi = {
  get: (reservaId) => apiRequest(`/reservas/${reservaId}/precheckin/`),
  create: (reservaId) => apiRequest(`/reservas/${reservaId}/precheckin/`, { method: "POST" }),
  validar: (reservaId, body) => apiRequest(`/reservas/${reservaId}/precheckin/validar`, { method: "POST", body }),
  publicGet: (token) => apiRequest(`/publico/precheckin/${encodeURIComponent(token)}`, { auth: false }),
  publicSend: (token, body) => apiRequest(`/publico/precheckin/${encodeURIComponent(token)}`, { method: "PUT", body, auth: false }),
};

//}Disponibilidad
export const disponibilidadApi = {
  /** fechas en formato YYYY-MM-DD */
  check: ({ fecha_checkin, fecha_checkout, tipo_habitacion_id }) =>
    apiRequest("/disponibilidad/", { query: { fecha_checkin, fecha_checkout, tipo_habitacion_id } }),
};

//Huéspedes
export const huespedesApi = {
  list: () => apiRequest("/huespedes/"),
  get: (id) => apiRequest(`/huespedes/${id}`),
  create: (data) => apiRequest("/huespedes/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/huespedes/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/huespedes/${id}`, { method: "DELETE" }),
};

//Reservas
export const reservasApi = {
  list: (filtros = {}) => apiRequest("/reservas/", { query: filtros }),
  get: (id) => apiRequest(`/reservas/${id}`),
  create: (data) => apiRequest("/reservas/", { method: "POST", body: data }),
  /** PUT /reservas/{id} — parcial: habitacion_id, fechas, num_huespedes, canal, notas (según el estado) */
  update: (id, data) => apiRequest(`/reservas/${id}`, { method: "PUT", body: data }),
  confirmar: (id) => apiRequest(`/reservas/${id}/confirmar`, { method: "POST" }),
  checkin: (id) => apiRequest(`/reservas/${id}/checkin`, { method: "POST" }),
  checkout: (id) => apiRequest(`/reservas/${id}/checkout`, { method: "POST" }),
  cancelar: (id) => apiRequest(`/reservas/${id}/cancelar`, { method: "POST" }),
  /** POST /reservas/{id}/no-show — el huésped no llegó */
  noShow: (id) => apiRequest(`/reservas/${id}/no-show`, { method: "POST" }),
  remove: (id) => apiRequest(`/reservas/${id}`, { method: "DELETE" }),
  /** GET /reservas/{id}/resumen (routes/facturas.py) */
  resumen: (id) => apiRequest(`/reservas/${id}/resumen`),
};

//Servicios
export const serviciosApi = {
  list: () => apiRequest("/servicios/"),
  get: (id) => apiRequest(`/servicios/${id}`),
  create: (data) => apiRequest("/servicios/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/servicios/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/servicios/${id}`, { method: "DELETE" }),
};

//Servicios consumidos en una reserva
export const reservaServiciosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/servicios/`),
  add: (reservaId, data) => apiRequest(`/reservas/${reservaId}/servicios/`, { method: "POST", body: data }),
  remove: (reservaId, itemId) =>
    apiRequest(`/reservas/${reservaId}/servicios/${itemId}`, { method: "DELETE" }),
};

//Pagos
export const pagosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/pagos/`),
  create: (reservaId, data) => apiRequest(`/reservas/${reservaId}/pagos/`, { method: "POST", body: data }),
};
//Configuración del hotel 
export const configApi = {
  get: () => apiRequest("/configuracion/"),
  update: (data) => apiRequest("/configuracion/", { method: "PUT", body: data }),
};

// Reservas en línea, públicas, no se requiere inicar sesión.
export const reservasWebApi = {
  hotel: () => apiRequest("/publico/hotel", { auth: false }),
  disponibilidad: ({ checkin, checkout, huespedes }) =>
    apiRequest(`/publico/disponibilidad?fecha_checkin=${checkin}&fecha_checkout=${checkout}&huespedes=${huespedes}`, { auth: false }),
  crear: (body) => apiRequest("/publico/reservas", { method: "POST", body, auth: false }),
  consultar: (body) => apiRequest("/publico/reservas/consultar", { method: "POST", body, auth: false }),
  cancelar: (body) => apiRequest("/publico/reservas/cancelar", { method: "POST", body, auth: false }),
  pagar: (body) => apiRequest("/publico/reservas/pagar", { method: "POST", body, auth: false }),
  verificarPago: (body) => apiRequest("/publico/reservas/verificar-pago", { method: "POST", body, auth: false }),
};
