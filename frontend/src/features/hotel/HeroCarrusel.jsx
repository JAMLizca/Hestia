import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useState } from "react";
import "./HeroCarrusel.css";

export const SEGUNDOS_POR_FOTO = 6;

/**
 * Fondo del hero con carrusel de fotos: fundido cruzado + zoom lento, avance automático
 * cada SEGUNDOS_POR_FOTO s, pausa al pasar el cursor / enfocar el hero o con el botón,
 * y sin movimiento si el usuario prefiere "reducir animaciones".
 *
 * `slides`: [{ url, titulo?, detalle?, href? }]. Con una sola foto no muestra controles.
 * Va como primer hijo de un contenedor `position: relative` (el `.hh-hero`).
 */
export default function HeroCarrusel({ slides }) {
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = slides.length;
  const hay = total > 1;
  const ir = useCallback((i) => setActual(((i % total) + total) % total), [total]);
  const siguiente = () => ir(actual + 1);
  const anterior = () => ir(actual - 1);
  const s = slides[Math.min(actual, total - 1)];

  return (
    <div className="hhc" data-pausa={pausa || undefined} data-multi={hay || undefined}>
      <div className="hhc__fondo" aria-hidden="true">
        {slides.map((sl, i) => (
          <div key={sl.url} className={`hhc__slide${i === actual ? " hhc__slide--on" : ""}`}>
            <img src={sl.url} alt="" decoding="async" fetchPriority={i === 0 ? "high" : "low"} />
          </div>
        ))}
        <div className="hhc__velo" />
      </div>

      {hay && (
        <div className="hhc__ctrl">
          <div className="hh-wrap hhc__fila">
            <div className="hhc__izq" role="group" aria-label="Control del carrusel de fotos">
              <button type="button" className="hhc__btn" onClick={anterior} aria-label="Foto anterior">
                <ChevronLeft size={18} />
              </button>
              <ol className="hhc__puntos">
                {slides.map((sl, i) => (
                  <li key={sl.url}>
                    <button type="button" className={`hhc__punto${i === actual ? " hhc__punto--on" : ""}`} onClick={() => ir(i)} aria-label={`Ver foto ${i + 1} de ${total}${sl.titulo ? `: ${sl.titulo}` : ""}`} aria-current={i === actual}>
                      {i === actual && <i key={actual} className="hhc__barra" onAnimationEnd={siguiente} />}
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="hhc__btn" onClick={siguiente} aria-label="Foto siguiente">
                <ChevronRight size={18} />
              </button>
              <button type="button" className="hhc__btn" onClick={() => setPausa((p) => !p)} aria-label={pausa ? "Reanudar carrusel" : "Pausar carrusel"}>
                {pausa ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </div>

            {s?.titulo && (
              <a className="hhc__leyenda" href={s.href || "#habitaciones"}>
                <strong>{s.titulo}</strong>
                {s.detalle && <span>{s.detalle}</span>}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
