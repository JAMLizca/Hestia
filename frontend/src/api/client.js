/**
 * Cliente HTTP central para la API de Hestia (FastAPI).
 * - Agrega el token JWT (Bearer) guardado tras el login.
 * - Traduce los errores de FastAPI ({ detail }) a mensajes legibles.
 * - Notifica cuando el token deja de ser válido (401) para cerrar la sesión.
 */

export const API_URL = import.meta.env.VITE_API_URL || "/api/v1";
const TOKEN_KEY = "hestia_access_token";

const NO_CONNECTION = "No hay conexión con el servidor de Hestia. Verifica que la API esté en ejecución.";

let unauthorizedHandler = null;

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* almacenamiento no disponible: la sesión dura lo que dure la pestaña */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  },
};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function parseDetail(payload, status) {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  // Errores de validación de Pydantic: [{ loc, msg, type }]
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => {
        const campo = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
        return campo ? `${campo}: ${item.msg}` : item.msg;
      })
      .join(" · ");
  }
  if (status >= 500) return "El servidor no pudo procesar la solicitud. Intenta de nuevo.";
  return "No se pudo completar la solicitud.";
}

export async function apiRequest(path, { method = "GET", body, form, query, auth = true } = {}) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }

  const headers = { Accept: "application/json" };
  const token = tokenStorage.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let requestBody;
  if (form) {
    // OAuth2PasswordRequestForm espera application/x-www-form-urlencoded
    requestBody = new URLSearchParams(form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body !== undefined) {
    requestBody = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url.pathname + url.search, { method, headers, body: requestBody });
  } catch {
    throw new ApiError(NO_CONNECTION, 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  // Sin cuerpo JSON y con error 5xx: lo devuelve el proxy de Vite cuando la API
  // no está encendida (ECONNREFUSED). FastAPI siempre responde con JSON.
  if (!response.ok && payload === null && response.status >= 500) {
    throw new ApiError(NO_CONNECTION, response.status);
  }

  if (!response.ok) {
    if (response.status === 401 && auth && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(parseDetail(payload, response.status), response.status);
  }
  return payload;
}
