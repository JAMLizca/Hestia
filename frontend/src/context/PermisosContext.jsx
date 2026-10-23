import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { rolesApi } from "../api/services";
import { useAuth } from "./AuthContext";

const PermisosContext = createContext(null);

/**
 * Qué puede hacer el usuario en cada módulo (RNF-03).
 *
 * Se lee de GET /roles/permisos, la misma matriz que el backend calcula a partir de sus rutas reales, así el
 * menú y los botones nunca se desvían de lo que la API permite. Ocultar es una comodidad de la interfaz: la
 * autorización de verdad sigue haciéndola el backend (responde 403 aunque alguien fuerce una petición).
 *
 *   const { can } = usePermisos();
 *   can("reservas", "crear")   // true / false
 *
 * Mientras llega la matriz `ready` es false. Si no se puede leer (red caída) se deja ver todo y es el backend
 * quien rechaza lo que no corresponda.
 */
export function PermisosProvider({ children }) {
  const { status, user } = useAuth();
  const [matriz, setMatriz] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
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
  }, [status, user?.rol]);

  const rol = user?.rol ?? null;
  const can = useCallback(
    (modulo, accion = "ver") => {
      if (failed) return true;
      if (!matriz || !rol) return false;
      return Boolean(matriz[modulo]?.[accion]?.roles.includes(rol));
    },
    [matriz, rol, failed],
  );
  /** Aclaración del backend para el rol, p. ej. recepción en habitaciones.editar: "Solo el estado de la habitación". */
  const nota = useCallback((modulo, accion) => (rol && matriz?.[modulo]?.[accion]?.notas?.[rol]) || null, [matriz, rol]);

  const value = useMemo(() => ({ can, nota, ready: failed || matriz !== null }), [can, nota, failed, matriz]);
  return <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>;
}

export function usePermisos() {
  const ctx = useContext(PermisosContext);
  if (!ctx) throw new Error("usePermisos debe usarse dentro de <PermisosProvider>");
  return ctx;
}
