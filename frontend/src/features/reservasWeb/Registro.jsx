import { Campo } from "./Comunes";

export const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "PEP", label: "Permiso especial de permanencia" },
  { value: "OTRO", label: "Otro documento" },
];

export const MOTIVOS = [
  { value: "turismo", label: "Turismo" },
  { value: "negocios", label: "Negocios" },
  { value: "familia", label: "Visita a familiares" },
  { value: "salud", label: "Salud" },
  { value: "estudio", label: "Estudio" },
  { value: "otro", label: "Otro" },
];

export const PERSONA_VACIA = { tipo_documento: "CC", documento_identidad: "", nombres: "", apellidos: "", nacionalidad: "", fecha_nacimiento: "" };

export const hoy = () => new Date().toISOString().slice(0, 10);

/** Campos de una persona (titular o acompañante). */
export function Persona({ valores, onChange, prefijo }) {
  const set = (campo) => (e) => onChange({ ...valores, [campo]: e.target.value });
  return (
    <div className="pc-grid">
      <Campo label="Tipo de documento" required>
        <select className="input" value={valores.tipo_documento} onChange={set("tipo_documento")} required name={`${prefijo}-tipo`}>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Número de documento" required>
        <input className="input" value={valores.documento_identidad} onChange={set("documento_identidad")} required minLength={3} maxLength={30} autoComplete="off" name={`${prefijo}-documento`} />
      </Campo>
      <Campo label="Nombres" required>
        <input className="input" value={valores.nombres} onChange={set("nombres")} required maxLength={100} autoComplete="given-name" name={`${prefijo}-nombres`} />
      </Campo>
      <Campo label="Apellidos" required>
        <input className="input" value={valores.apellidos} onChange={set("apellidos")} required maxLength={100} autoComplete="family-name" name={`${prefijo}-apellidos`} />
      </Campo>
      <Campo label="Nacionalidad" required>
        <input className="input" value={valores.nacionalidad} onChange={set("nacionalidad")} required minLength={2} maxLength={60} placeholder="Ej. Colombiana" name={`${prefijo}-nacionalidad`} />
      </Campo>
      <Campo label="Fecha de nacimiento" required>
        <input className="input" type="date" value={valores.fecha_nacimiento} onChange={set("fecha_nacimiento")} required max={hoy()} name={`${prefijo}-nacimiento`} />
      </Campo>
    </div>
  );
}

