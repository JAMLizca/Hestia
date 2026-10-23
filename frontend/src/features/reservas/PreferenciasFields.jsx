import { Field, Select } from "../../components/ui/Form";
import { PREFERENCIAS_BANDERAS, PREFERENCIAS_OPCIONES } from "../../utils/status";

/**
 * Preferencias de la estadía (piso, vista, cama, tranquila, accesible). Son opcionales y alimentan los datos
 * que se exportan para Machine Learning (RF-20).
 */
export default function PreferenciasFields({ value, onChange, disabled = false }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="preferencias">
      <div className="preferencias__selects">
        <Field label="Piso">
          <Select placeholder="Sin preferencia" options={PREFERENCIAS_OPCIONES.piso} value={value.piso} onChange={(e) => set("piso", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Vista">
          <Select placeholder="Sin preferencia" options={PREFERENCIAS_OPCIONES.vista} value={value.vista} onChange={(e) => set("vista", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Cama">
          <Select placeholder="Sin preferencia" options={PREFERENCIAS_OPCIONES.cama} value={value.cama} onChange={(e) => set("cama", e.target.value)} disabled={disabled} />
        </Field>
      </div>
      <div className="preferencias__flags">
        {PREFERENCIAS_BANDERAS.map(({ key, label }) => (
          <label key={key}>
            <input type="checkbox" checked={Boolean(value[key])} onChange={(e) => set(key, e.target.checked)} disabled={disabled} style={{ accentColor: "var(--navy-700)" }} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
