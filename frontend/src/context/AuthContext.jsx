import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onUnauthorized, tokenStorage } from "../api/client";
import { authApi, cuentaApi } from "../api/services";

const AuthContext = createContext(null);

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
  // true cuando el usuario cerró sesión a propósito 
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

  const login = useCallback(async (email, password) => guardarToken((await authApi.login(email, password)).access_token), [guardarToken]);

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
