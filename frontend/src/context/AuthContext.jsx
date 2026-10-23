import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onUnauthorized, tokenStorage } from "../api/client";
import { authApi, cuentaApi } from "../api/services";

const AuthContext = createContext(null);

/**
 * El JWT lleva claims que solo se leen para decidir qué mostrar en la interfaz (la autorización real la hace
 * siempre el backend): "tipo" ("personal" o "cliente"; los tokens anteriores no lo traían y son de personal) y,
 * para el personal, "rol". GET /auth/me solo devuelve rol_id, por eso el nombre del rol sale del token.
 */
function readClaims(token) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export const tipoDeToken = (token) => (readClaims(token).tipo === "cliente" ? "cliente" : "personal");

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStorage.get());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(token ? "loading" : "anonymous");
  // true cuando el usuario cerró sesión a propósito (no se recuerda la pantalla anterior)
  const [manualLogout, setManualLogout] = useState(false);

  const endSession = useCallback((manual) => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    setStatus("anonymous");
    setManualLogout(manual);
  }, []);
  const logout = useCallback(() => endSession(true), [endSession]);
  const expire = useCallback(() => endSession(false), [endSession]);

  useEffect(() => {
    onUnauthorized(expire);
  }, [expire]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const claims = readClaims(token);
    const tipo = claims.tipo === "cliente" ? "cliente" : "personal";
    (tipo === "cliente" ? cuentaApi.me() : authApi.me())
      .then((me) => {
        if (!active) return;
        setUser(
          tipo === "cliente"
            ? { ...me, tipo, rol: null, nombre: `${me.nombres} ${me.apellidos}`.trim() }
            : { ...me, tipo, rol: claims.rol ?? null },
        );
        setStatus("authenticated");
      })
      .catch((err) => {
        if (!active) return;
        // Solo un 401 invalida el token. Si la petición falla por otra causa (red caída, o la página
        // se está recargando y el navegador aborta la llamada) el token se conserva: borrarlo aquí
        // cerraría la sesión al pulsar F5 justo después de iniciar sesión.
        if (err?.status === 401) expire();
        else setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, [token, expire]);

  const guardarToken = useCallback((access_token) => {
    tokenStorage.set(access_token);
    setManualLogout(false);
    setStatus("loading");
    setToken(access_token);
    return tipoDeToken(access_token);
  }, []);

  /** Un solo acceso para personal y huéspedes. Devuelve el tipo de sesión ("personal" | "cliente"). */
  const login = useCallback(async (email, password) => guardarToken((await authApi.login(email, password)).access_token), [guardarToken]);

  /** Crea una cuenta de huésped y deja la sesión iniciada. Devuelve "cliente". */
  const register = useCallback(async (datos) => guardarToken((await cuentaApi.registro(datos)).access_token), [guardarToken]);

  const value = useMemo(
    () => ({
      user,
      status,
      manualLogout,
      login,
      register,
      logout,
      esPersonal: status === "authenticated" && user?.tipo === "personal",
      esCliente: status === "authenticated" && user?.tipo === "cliente",
    }),
    [user, status, manualLogout, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
