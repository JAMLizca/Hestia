import { Clock, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { todayISO } from "../../utils/format";
import { predecirOcupacion } from "./inteligencia";
import "./inteligencia.css";

const HORIZONTES = [
  { value: "7", label: "Próximos 7 días" },
  { value: "14", label: "Próximos 14 días" },
  { value: "30", label: "Próximos 30 días" },
];
const BARRAS_FANTASMA = [46, 58, 52, 70, 84, 92, 66, 54, 62, 78, 88, 74, 60, 50];
const DIAS_MAX_ADELANTE = 30; // el modelo no pronostica más allá (ver app/services/inteligencia.py)

const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};
const fecha = (iso) => new Date(`${iso}T12:00:00`);
/** "sáb 7 nov" */
const etiquetaDia = (iso) => fecha(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "").replace(/ de /g, " ");
/** "S" + "7" para el pie de cada barra */
const inicialSemana = (iso) => fecha(iso).toLocaleDateString("es-CO", { weekday: "narrow" }).toUpperCase();

/**
 * Predicción de ocupación (Hestia Intelligence) en el Dashboard, para quienes gestionan el hotel
 * (administrador, gerente, auditor). Consulta GET /prediccion/ocupacion y dibuja un pronóstico por día.
 * La recomendación de habitaciones vive en RecomendacionHabitaciones.jsx.
 */
export default function HestiaIntelligence() {
  const hoy = todayISO();
  const [oc, setOc] = useState({ desde: hoy, dias: "7" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const ultima = useRef(0); // si el usuario consulta dos veces seguidas, solo cuenta la última respuesta

  const consultar = useCallback(async (params) => {
    const turno = ++ultima.current;
    setBusy(true);
    setError("");
    try {
      const r = await predecirOcupacion({ desde: params.desde, dias: Number(params.dias) });
      if (turno === ultima.current) setResultado(r);
    } catch (err) {
      if (turno !== ultima.current) return;
      setResultado(null);
      setError(err.message);
    } finally {
      if (turno === ultima.current) setBusy(false);
    }
  }, []);

  // Al abrir el Dashboard ya se ve el pronóstico de la semana.
  useEffect(() => {
    consultar({ desde: hoy, dias: "7" });
    return () => {
      ultima.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultar]);

  const enviar = (event) => {
    event.preventDefault();
    consultar(oc);
  };
  const setO = (k) => (e) => setOc((v) => ({ ...v, [k]: e.target.value }));

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
          <form className="hi__form" onSubmit={enviar} noValidate>
            <div className="form-grid">
              <Field label="Desde" required>
                <Input type="date" value={oc.desde} min={hoy} max={sumarDias(hoy, DIAS_MAX_ADELANTE)} onChange={setO("desde")} />
              </Field>
              <Field label="Horizonte" required>
                <Select options={HORIZONTES} value={oc.dias} onChange={setO("dias")} />
              </Field>
            </div>
            <p className="hi__hint">El pronóstico mira hasta {DIAS_MAX_ADELANTE} días hacia adelante y se calcula con las reservas que el hotel ya tiene registradas.</p>
            <div className="hi__actions">
              <Button type="submit" icon={Sparkles} loading={busy}>
                Predecir ocupación
              </Button>
            </div>
            {error && (
              <div className="hi__aviso" role="alert">
                <Clock size={16} />
                <span>{error}</span>
              </div>
            )}
          </form>

          <div className="hi__result" aria-label="Resultado" aria-busy={busy}>
            <ResultadoOcupacion datos={resultado} cargando={busy} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Barras por día y tres indicadores. Sin datos (cargando o con error) se muestra la silueta tenue. */
function ResultadoOcupacion({ datos, cargando }) {
  if (!datos) {
    return (
      <>
        <div className="hi__result-title">Ocupación esperada por día</div>
        <div className="hi__bars hi__bars--ghost" aria-hidden="true">
          {BARRAS_FANTASMA.map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="hi__kpis">
          {["Ocupación promedio", "Día de mayor demanda", "Confianza del modelo"].map((t) => (
            <div key={t}>
              <strong>{cargando ? "…" : "—"}</strong>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  const muchos = datos.dias.length > 14; // con 30 barras no caben las cifras: quedan en el texto emergente
  return (
    <>
      <div className="hi__result-title">Ocupación esperada por día</div>
      <ol className="hi__bars" aria-label="Ocupación esperada por día">
        {datos.dias.map((d, i) => {
          const pico = d.fecha === datos.dia_pico;
          const texto = `${etiquetaDia(d.fecha)}: ${Math.round(d.ocupacion_pct)}%`;
          return (
            <li key={d.fecha} className={`hi__bar${pico ? " hi__bar--pico" : ""}`} title={texto} aria-label={texto}>
              <em>{muchos ? "" : Math.round(d.ocupacion_pct)}</em>
              <span className="hi__bar-track">
                <span className="hi__bar-fill" style={{ height: `${Math.max(d.ocupacion_pct, 2)}%` }} />
              </span>
              <small>{!muchos || i % 5 === 0 ? (muchos ? fecha(d.fecha).getDate() : `${inicialSemana(d.fecha)}${fecha(d.fecha).getDate()}`) : ""}</small>
            </li>
          );
        })}
      </ol>
      <div className="hi__kpis">
        <div>
          <strong>{Math.round(datos.promedio_pct)}%</strong>
          <span>Ocupación promedio</span>
        </div>
        <div>
          <strong>{etiquetaDia(datos.dia_pico)}</strong>
          <span>Día de mayor demanda · {Math.round(datos.dia_pico_pct)}%</span>
        </div>
        <div title="Porcentaje de días de prueba en que el pronóstico se desvió menos de 10 puntos de ocupación">
          <strong>{datos.confianza_pct}%</strong>
          <span>Confianza del modelo</span>
        </div>
      </div>
      <p className="hi__nota">
        Error medio esperado: ±{datos.error_medio_pp} puntos de ocupación. Los días más lejanos son menos precisos. Modelo entrenado con datos simulados del sistema.
      </p>
    </>
  );
}
