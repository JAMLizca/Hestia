import { Clock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { tiposHabitacionApi } from "../../api/services";
import { Button } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { useToast } from "../../context/ToastContext";
import { MENSAJE_NO_DISPONIBLE, NoDisponibleError, predecirOcupacion } from "./inteligencia";
import "./inteligencia.css";

const HORIZONTES = [
  { value: "7", label: "Próximos 7 días" },
  { value: "14", label: "Próximos 14 días" },
  { value: "30", label: "Próximos 30 días" },
];
const BARRAS_FANTASMA = [46, 58, 52, 70, 84, 92, 66, 54, 62, 78, 88, 74, 60, 50];

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Predicción de ocupación (Hestia Intelligence) en el Dashboard, para quienes gestionan el hotel. Funciona como si el
 * modelo estuviera conectado, pero mientras `MODELOS_DISPONIBLES` sea false cualquier uso muestra
 * «Opción no disponible temporalmente». La recomendación de habitaciones vive en RecomendacionHabitaciones.jsx.
 */
export default function HestiaIntelligence() {
  const toast = useToast();
  const [aviso, setAviso] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tipos, setTipos] = useState([]);
  const [oc, setOc] = useState({ desde: hoy(), dias: "7", tipo: "" });

  useEffect(() => {
    let vivo = true;
    tiposHabitacionApi
      .list()
      .then((lista) => vivo && setTipos(lista))
      .catch(() => {}); // sin tipos el filtro simplemente queda en «Todos»
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await predecirOcupacion({ desde: oc.desde, dias: Number(oc.dias), tipo_habitacion_id: oc.tipo ? Number(oc.tipo) : undefined });
    } catch (err) {
      setAviso(true);
      toast.error(err instanceof NoDisponibleError ? MENSAJE_NO_DISPONIBLE : err.message);
    } finally {
      setBusy(false);
    }
  }

  const setO = (k) => (e) => setOc((v) => ({ ...v, [k]: e.target.value }));
  const opcionesTipo = tipos.map((t) => ({ value: String(t.id), label: t.nombre }));

  return (
    <section className="hi">
      <header className="hi__head">
        <div className="hi__eyebrow">
          <Sparkles size={12} /> Hestia Intelligence
        </div>
        <h2 className="hi__title">Información inteligente para apoyar la toma de decisiones.</h2>
        <p className="hi__text">Anticipa cuánta ocupación tendrá el hotel en los próximos días para planear con tiempo.</p>
      </header>

      <div className="hi__body">
        <div className="hi__tool">Predicción de ocupación</div>

        <div className="hi__grid">
          {/* onInput recoge cualquier escritura o cambio en los campos */}
          <form className="hi__form" onSubmit={enviar} onInput={() => setAviso(true)} noValidate>
            <div className="form-grid">
              <Field label="Desde" required>
                <Input type="date" value={oc.desde} onChange={setO("desde")} />
              </Field>
              <Field label="Horizonte" required>
                <Select options={HORIZONTES} value={oc.dias} onChange={setO("dias")} />
              </Field>
              <Field label="Tipo de habitación" full>
                <Select placeholder="Todos los tipos" options={opcionesTipo} value={oc.tipo} onChange={setO("tipo")} />
              </Field>
            </div>
            <div className="hi__actions">
              <Button type="submit" icon={Sparkles} loading={busy}>
                Predecir ocupación
              </Button>
            </div>
            {aviso && (
              <div className="hi__aviso" role="alert">
                <Clock size={16} />
                <span>{MENSAJE_NO_DISPONIBLE}</span>
              </div>
            )}
          </form>

          <div className="hi__result" aria-label="Resultado">
            <ResultadoOcupacion />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Vista previa del resultado (sin datos): barras tenues y tres indicadores vacíos. */
function ResultadoOcupacion() {
  return (
    <>
      <div className="hi__result-title">Ocupación esperada por día</div>
      <div className="hi__bars" aria-hidden="true">
        {BARRAS_FANTASMA.map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="hi__kpis">
        {["Ocupación promedio", "Día de mayor demanda", "Confianza del modelo"].map((t) => (
          <div key={t}>
            <strong>—</strong>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </>
  );
}
