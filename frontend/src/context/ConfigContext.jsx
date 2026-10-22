import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { configApi } from "../api/services";
import { configureFormat } from "../utils/format";
import { useAuth } from "./AuthContext";

/** Valores con los que se muestra el panel mientras llega la configuración (o si no se puede leer). */
export const DEFAULT_CONFIG = {
  nombre: "Hotel Hestia",
  razon_social: null,
  nit: null,
  direccion: null,
  ciudad: null,
  pais: "Colombia",
  telefono: null,
  email: null,
  sitio_web: null,
  hora_checkin: "15:00:00",
  hora_checkout: "12:00:00",
  moneda: "COP",
  zona_horaria: "America/Bogota",
  fecha_actualizacion: null,
};

const ConfigContext = createContext(null);

/**
 * Configuración general del hotel (GET /configuracion/). Se carga al iniciar sesión y la usan
 * el menú lateral (nombre del hotel) y el formato de montos (moneda). Si la lectura falla
 * —por ejemplo, si la tabla aún no existe en la base de datos— el panel sigue funcionando con
 * los valores por defecto.
 */
export function ConfigProvider({ children }) {
  const { status } = useAuth();
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    configApi
      .get()
      .then((data) => active && setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch(() => {
        /* se mantienen los valores por defecto */
      });
    return () => {
      active = false;
    };
  }, [status]);

  // Se aplica antes de dibujar a los hijos para que formatMoney ya use la moneda vigente.
  configureFormat(config);

  const update = useCallback((data) => setConfig({ ...DEFAULT_CONFIG, ...data }), []);
  const value = useMemo(() => ({ config, update }), [config, update]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig debe usarse dentro de <ConfigProvider>");
  return ctx;
}
