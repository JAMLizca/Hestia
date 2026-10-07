import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onUnauthorized, tokenStorage } from "../api/client";
import { authApi } from "../api/services";

const AuthContext = createContext(null);

/**
 * El backend incluye el nombre del rol como claim "rol" dentro del JWT
 * (ver create_access_token en routes/auth.py). GET /auth/me solo devuelve rol_id,
 * así que el nombre se lee del token únicamente para mostrarlo en la interfaz.
 * La autorización real la sigue haciendo el backend.
 */
function readRoleFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.rol ?? null;
  } catch {
    return null;
  }
}

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
    authApi
      .me()
      .then((me) => {
        if (!active) return;
        setUser({ ...me, rol: readRoleFromToken(token) });
        setStatus("authenticated");
      })
      .catch(() => {
        if (active) expire();
      });
    return () => {
      active = false;
    };
  }, [token, expire]);

  const login = useCallback(async (email, password) => {
    const { access_token } = await authApi.login(email, password);
    tokenStorage.set(access_token);
    setManualLogout(false);
    setStatus("loading");
    setToken(access_token);
  }, []);

  const value = useMemo(() => ({ user, status, manualLogout, login, logout }), [user, status, manualLogout, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
