import { Database, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { reportesApi } from "../api/services";
import { saveBlob } from "../api/client";
import { Button, Card, ErrorBanner, InfoBanner } from "../components/ui";
import { Field, Input } from "../components/ui/Form";
import { useToast } from "../context/ToastContext";

// Qué trae cada fila del archivo, agrupado como se explica en pantalla.
const COLUMNAS = [
  ["Reserva", "código, canal, estado y temporada (alta, media o baja)"],
  ["Fechas", "creación, llegada y salida; noches, anticipación en días, día de la semana y mes de llegada"],
  ["Estancia", "huéspedes, tipo de habitación, piso, precio por noche y total"],
  ["Dinero", "consumo de servicios, total pagado y si quedó saldada"],
  ["Huésped", "nacionalidad y si ya había reservado antes (sin datos personales)"],
  ["Preferencias", "piso, vista, cama, habitación tranquila y accesible"],
  ["Resultado", "cancelada y no_show (1 o 0): lo que un modelo de predicción aprende a anticipar"],
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

      <Card title="Qué incluye cada fila">
        <dl className="detail-grid">
          {COLUMNAS.map(([titulo, texto]) => (
            <div key={titulo} className="detail-grid__full">
              <dt>{titulo}</dt>
              <dd>{texto}</dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop: 16 }}>
          <InfoBanner>
            <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            El archivo no incluye nombres, documentos, correos ni teléfonos de los huéspedes.
          </InfoBanner>
        </div>
      </Card>
    </>
  );
}
