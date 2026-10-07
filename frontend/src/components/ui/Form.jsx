/** Campos de formulario con el estilo del panel. */
export function Field({ label, hint, required, full, children }) {
  return (
    <label className={`field${full ? " field--full" : ""}`}>
      <span className="field__label">
        {label}
        {required ? " *" : <small> (opcional)</small>}
      </span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Textarea(props) {
  return <textarea className="input" {...props} />;
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select className="input" {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Convierte los valores del formulario al payload del backend:
 * cadenas vacías → null (para que Pydantic acepte los campos opcionales).
 */
export function cleanPayload(values, { numbers = [], omitEmpty = false } = {}) {
  const out = {};
  Object.entries(values).forEach(([key, raw]) => {
    let value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "") value = null;
    if (value !== null && numbers.includes(key)) value = Number(value);
    if (omitEmpty && value === null) return;
    out[key] = value;
  });
  return out;
}
