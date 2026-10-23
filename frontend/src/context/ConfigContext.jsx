import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { configApi } from "../api/services";
import { configureFormat } from "../utils/format";
import { useAuth } from "./AuthContext";

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
  horas_vencimiento_pendiente: 24,
  reservas_web_activas: false,
  anticipo_porcentaje: 0,
  pasarela_configurada: false,
  moneda: "COP",
  zona_horaria: "America/Bogota",
  fecha_actualizacion: null,
};

const ConfigContext = createContext(null);

/*Configuracón general del hotel */
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
        
      });
    return () => {
      active = false;
    };
  }, [status]);

  
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
