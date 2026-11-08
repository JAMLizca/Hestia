import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { rolesApi } from "../api/services";
import { useAuth } from "./AuthContext";

const PermisosContext = createContext(null);

/**
  Qué puede hacer el usuario en cada módulo
 **/
export function PermisosProvider({ children }) {
  const { esPersonal, user } = useAuth();
  const [matriz, setMatriz] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!esPersonal) return; // un huésped no tiene panel
    let active = true;
    rolesApi
      .permisos()
      .then((data) => {
        if (!active) return;
        setMatriz(Object.fromEntries(data.modulos.map((m) => [m.clave, Object.fromEntries(m.acciones.map((a) => [a.accion, a]))])));
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [esPersonal, user?.rol]);

  const rol = user?.rol ?? null;
  const can = useCallback(
    (modulo, accion = "ver") => {
      if (failed) return true;
      if (!matriz || !rol) return false;
      return Boolean(matriz[modulo]?.[accion]?.roles.includes(rol));
    },
    [matriz, rol, failed],
  );
 
  const nota = useCallback((modulo, accion) => (rol && matriz?.[modulo]?.[accion]?.notas?.[rol]) || null, [matriz, rol]);

  const value = useMemo(() => ({ can, nota, ready: failed || matriz !== null }), [can, nota, failed, matriz]);
  return <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>;
}

export function usePermisos() {
  const ctx = useContext(PermisosContext);
  if (!ctx) throw new Error("usePermisos debe usarse dentro de <PermisosProvider>");
  return ctx;
}
