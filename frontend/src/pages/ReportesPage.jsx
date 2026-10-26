import { Database, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { reportesApi } from "../api/services";
import { saveBlob } from "../api/client";
import { Button, Card, ErrorBanner } from "../components/ui";
import { Field, Input } from "../components/ui/Form";
import { useToast } from "../context/ToastContext";
import "./ReportesPage.css";

// Diccionario del archivo: los nombres son las columnas reales (los mismos que verás en pandas, Excel o R).
const GRUPOS = [
  { titulo: "Reserva", texto: "Identifica la reserva y de dónde vino.", columnas: ["reserva_codigo", "canal", "estado", "temporada"], nota: "temporada: alta, media o baja" },
  {
    titulo: "Fechas",
    texto: "Cuándo se reservó, cuándo llega y sale, y qué tan anticipada fue.",
    columnas: ["fecha_creacion", "fecha_checkin", "fecha_checkout", "noches", "anticipacion_dias", "dia_semana_llegada", "mes_llegada", "llegada_fin_de_semana"],
    nota: "dia_semana_llegada: 0 = lunes … 6 = domingo",
  },
  { titulo: "Estancia", texto: "Qué se reservó y a qué precio.", columnas: ["num_huespedes", "tipo_habitacion", "piso", "precio_noche", "precio_total"] },
  { titulo: "Dinero", texto: "Cuánto se consumió y cuánto se pagó.", columnas: ["costo_servicios", "total_pagado", "pagado_completo"], nota: "pagado_completo: 1 si quedó saldada" },
  { titulo: "Huésped", texto: "Nacionalidad e historial, sin datos personales.", columnas: ["huesped_nacionalidad", "huesped_recurrente", "reservas_previas_huesped"] },
  { titulo: "Preferencias", texto: "Lo que el huésped pidió para su estadía.", columnas: ["pref_piso", "pref_vista", "pref_cama", "pref_tranquila", "pref_accesible"] },
  { titulo: "Resultado", texto: "Lo que un modelo de predicción aprende a anticipar.", columnas: ["cancelada", "no_show"], nota: "1 = sí, 0 = no", destacado: true },
];

/**
 * Exportación del dataset de reservas (GET /reportes/dataset-reservas). Solo administrador y gerente.
 * Es la base para analítica y para entrenar los modelos de Machine Learning (RF-20).
 */
export default function ReportesPage() {
  const toast = useToast();
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", solo_cerradas: false });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const rangoInvalido = filtros.desde && filtros.hasta && filtros.hasta < filtros.desde;

  async function descargar(formato) {
    setError("");
    setBusy(formato);
    try {
      const { blob, filename } = await reportesApi.datasetReservas({ ...filtros, formato });
      saveBlob(blob, filename);
      toast.success(`Archivo ${filename} descargado`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Card title="Dataset de reservas" subtitle="Una fila por reserva, lista para analizar en Excel, Python o R">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <Field label="Llegada desde" hint="Fecha de llegada prevista">
            <Input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} />
          </Field>
          <Field label="Llegada hasta">
            <Input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} />
          </Field>
          <div className="field field--full">
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filtros.solo_cerradas}
                onChange={(e) => setFiltros((f) => ({ ...f, solo_cerradas: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "var(--navy-700)" }}
              />
              Solo reservas con desenlace conocido (check-out, canceladas y “no se presentó”)
            </label>
            <span className="field__hint">Recomendado para entrenar modelos: las reservas vigentes aún no tienen resultado.</span>
          </div>
        </div>

        {rangoInvalido && <ErrorBanner message="La fecha final no puede ser anterior a la inicial." />}
        <ErrorBanner message={error} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Button icon={Download} loading={busy === "csv"} disabled={rangoInvalido || Boolean(busy)} onClick={() => descargar("csv")}>
            Descargar CSV
          </Button>
          <Button variant="outline" icon={Database} loading={busy === "json"} disabled={rangoInvalido || Boolean(busy)} onClick={() => descargar("json")}>
            Descargar JSON
          </Button>
        </div>
      </Card>

      <details className="rep-dic">
        <summary>
          <span className="rep-dic__title">Qué incluye cada fila</span>
          <span className="rep-dic__hint">{GRUPOS.reduce((n, g) => n + g.columnas.length, 0)} columnas · toca para ver el diccionario</span>
        </summary>
        <div className="rep-dic__body">
          <div className="rep-dic__grid">
            {GRUPOS.map((g) => (
              <section key={g.titulo} className={`rep-dic__group${g.destacado ? " rep-dic__group--key" : ""}`}>
                <h3>{g.titulo}</h3>
                <p>{g.texto}</p>
                <div className="rep-dic__chips">
                  {g.columnas.map((c) => (
                    <code key={c}>{c}</code>
                  ))}
                </div>
                {g.nota && <small>{g.nota}</small>}
              </section>
            ))}
          </div>
          <div className="rep-dic__privacy">
            <ShieldCheck size={14} />
            El archivo no incluye nombres, documentos, correos ni teléfonos de los huéspedes.
          </div>
        </div>
      </details>
    </>
  );
}
