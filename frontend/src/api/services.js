/**
 * Servicios por recurso. Cada función corresponde 1:1 a un endpoint
 */
import { apiRequest } from "./client";

//Autenticación (routes/auth.py)
export const authApi = {
  /** POST /auth/login — form-data: username (email), password */
  login: (email, password) =>
    apiRequest("/auth/login", { method: "POST", form: { username: email, password }, auth: false }),
  /** GET /auth/me */
  me: () => apiRequest("/auth/me"),
  /** POST /auth/register — { nombre, email, password, rol_id } */
  register: (data) => apiRequest("/auth/register", { method: "POST", body: data }),
  /** PUT /auth/me/password — { password_actual, password_nueva } (204). Cambia la contraseña de quien tiene la sesión. */
  changePassword: (data) => apiRequest("/auth/me/password", { method: "PUT", body: data }),
};

//Roles (routes/roles.py) 
export const rolesApi = {
  list: () => apiRequest("/roles/"),
  create: (data) => apiRequest("/roles/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/roles/${id}`, { method: "PUT", body: data }),
  permisos: () => apiRequest("/roles/permisos"),
};

//Usuarios (routes/usuarios.py)
export const usuariosApi = {
  list: () => apiRequest("/usuarios/"),
  get: (id) => apiRequest(`/usuarios/${id}`),
  update: (id, data) => apiRequest(`/usuarios/${id}`, { method: "PUT", body: data }),
  setPassword: (id, password) => apiRequest(`/usuarios/${id}/password`, { method: "PUT", body: { password } }),
};

//Tipos de habitación (routes/tipos_habitacion.py)
export const tiposHabitacionApi = {
  list: () => apiRequest("/tipos-habitacion/"),
  get: (id) => apiRequest(`/tipos-habitacion/${id}`),
  create: (data) => apiRequest("/tipos-habitacion/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/tipos-habitacion/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/tipos-habitacion/${id}`, { method: "DELETE" }),
};

//Habitaciones (routes/habitaciones.py)
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

// Pre-check-in (routes/precheckin.py)
export const precheckinApi = {
  /** GET /reservas/{id}/precheckin/ — null si todavía no se creó el enlace */
  get: (reservaId) => apiRequest(`/reservas/${reservaId}/precheckin/`),
  /** POST /reservas/{id}/precheckin/ — crea el enlace o genera uno nuevo (el anterior deja de funcionar) */
  create: (reservaId) => apiRequest(`/reservas/${reservaId}/precheckin/`, { method: "POST" }),
  /** POST /reservas/{id}/precheckin/validar — aplica lo declarado al huésped. { actualizar_documento } si el documento difiere */
  validar: (reservaId, body) => apiRequest(`/reservas/${reservaId}/precheckin/validar`, { method: "POST", body }),
  /** Rutas públicas (sin sesión): las usa el huésped desde el enlace */
  publicGet: (token) => apiRequest(`/publico/precheckin/${encodeURIComponent(token)}`, { auth: false }),
  publicSend: (token, body) => apiRequest(`/publico/precheckin/${encodeURIComponent(token)}`, { method: "PUT", body, auth: false }),
};

//}Disponibilidad (routes/disponibilidad.py)
export const disponibilidadApi = {
  /** fechas en formato YYYY-MM-DD */
  check: ({ fecha_checkin, fecha_checkout, tipo_habitacion_id }) =>
    apiRequest("/disponibilidad/", { query: { fecha_checkin, fecha_checkout, tipo_habitacion_id } }),
};

//Huéspedes (routes/huespedes.py)
export const huespedesApi = {
  list: () => apiRequest("/huespedes/"),
  get: (id) => apiRequest(`/huespedes/${id}`),
  create: (data) => apiRequest("/huespedes/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/huespedes/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/huespedes/${id}`, { method: "DELETE" }),
};

//Reservas (routes/reservas.py)
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

//Servicios (routes/servicios.py) 
export const serviciosApi = {
  list: () => apiRequest("/servicios/"),
  get: (id) => apiRequest(`/servicios/${id}`),
  create: (data) => apiRequest("/servicios/", { method: "POST", body: data }),
  update: (id, data) => apiRequest(`/servicios/${id}`, { method: "PUT", body: data }),
  remove: (id) => apiRequest(`/servicios/${id}`, { method: "DELETE" }),
};

//Servicios consumidos en una reserva (routes/reserva_servicios.py)
export const reservaServiciosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/servicios/`),
  /** { servicio_id, cantidad } */
  add: (reservaId, data) => apiRequest(`/reservas/${reservaId}/servicios/`, { method: "POST", body: data }),
  remove: (reservaId, itemId) =>
    apiRequest(`/reservas/${reservaId}/servicios/${itemId}`, { method: "DELETE" }),
};

//Pagos (routes/pagos.py)
export const pagosApi = {
  list: (reservaId) => apiRequest(`/reservas/${reservaId}/pagos/`),
  /** { monto, metodo_pago } */
  create: (reservaId, data) => apiRequest(`/reservas/${reservaId}/pagos/`, { method: "POST", body: data }),
};
// ── Configuración del hotel (routes/configuracion.py) ───────────
export const configApi = {
  /** Cualquier usuario autenticado. Devuelve valores por defecto si aún no se guardó nada. */
  get: () => apiRequest("/configuracion/"),
  /** Solo administrador. Actualización parcial: { nombre?, nit?, ..., hora_checkin?: "HH:MM", moneda?, zona_horaria? } */
  update: (data) => apiRequest("/configuracion/", { method: "PUT", body: data }),
};

// Reservas en línea, públicas (routes/reservas_web.py). Ninguna requiere sesión.
export const reservasWebApi = {
  hotel: () => apiRequest("/publico/hotel", { auth: false }),
  disponibilidad: ({ checkin, checkout, huespedes }) =>
    apiRequest(`/publico/disponibilidad?fecha_checkin=${checkin}&fecha_checkout=${checkout}&huespedes=${huespedes}`, { auth: false }),
  crear: (body) => apiRequest("/publico/reservas", { method: "POST", body, auth: false }),
  consultar: (body) => apiRequest("/publico/reservas/consultar", { method: "POST", body, auth: false }),
  cancelar: (body) => apiRequest("/publico/reservas/cancelar", { method: "POST", body, auth: false }),
  /** Inicia el pago del anticipo: devuelve { url } del checkout de Wompi al que hay que enviar al huésped. */
  pagar: (body) => apiRequest("/publico/reservas/pagar", { method: "POST", body, auth: false }),
  /** Al volver de Wompi: confirma el pago consultando la transacción (no depende del webhook). */
  verificarPago: (body) => apiRequest("/publico/reservas/verificar-pago", { method: "POST", body, auth: false }),
};
