import { BedDouble, Car, ChevronDown, Flower2, Mountain, Package, Shirt, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../../utils/format";
import "./ServiciosHotel.css";

const clave = (t = "") => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Orden y icono de las categorías conocidas; las demás van al final por orden alfabético.
const CATEGORIAS = {
  alimentos: { icono: UtensilsCrossed, orden: 1 },
  habitacion: { icono: BedDouble, orden: 2 },
  bienestar: { icono: Flower2, orden: 3 },
  actividades: { icono: Mountain, orden: 4 },
  transporte: { icono: Car, orden: 5 },
  lavanderia: { icono: Shirt, orden: 6 },
};
const POR_DEFECTO = { icono: Package, orden: 99 };
const VISIBLES_MOVIL = 5;

/**
 * Servicios del hotel en la página pública: pestañas por categoría y tarjetas solo de la categoría elegida.
 * En pantallas pequeñas las pestañas se deslizan y se muestran los primeros 5 con "Ver los N servicios".
 */
export default function ServiciosHotel({ servicios }) {
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const s of servicios) {
      const cat = s.categoria || "Otros";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat).push(s);
    }
    return [...mapa.entries()]
      .map(([nombre, items]) => ({ nombre, items: items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")), ...(CATEGORIAS[clave(nombre)] ?? POR_DEFECTO) }))
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  }, [servicios]);

  const [elegida, setElegida] = useState("");
  const [abierto, setAbierto] = useState(false);
  const activa = grupos.find((g) => g.nombre === elegida) ?? grupos[0];
  if (!activa) return null;
  const sobran = activa.items.length - VISIBLES_MOVIL;

  return (
    <div className="hhs">
      <nav className="hhs__tabs" aria-label="Categorías de servicios">
        {grupos.map((g) => {
          const Icono = g.icono;
          const on = g === activa;
          return (
            <button
              key={g.nombre}
              type="button"
              className={`hhs__tab${on ? " hhs__tab--on" : ""}`}
              aria-pressed={on}
              onClick={() => {
                setElegida(g.nombre);
                setAbierto(false);
              }}
            >
              <Icono size={16} aria-hidden="true" />
              {g.nombre}
              <span className="hhs__n">{g.items.length}</span>
            </button>
          );
        })}
      </nav>

      <ul className="hhs__lista" data-abierto={abierto || undefined} aria-live="polite">
        {activa.items.map((s, i) => (
          <li key={s.nombre} className={`hhs__item${i >= VISIBLES_MOVIL ? " hhs__item--extra" : ""}`}>
            <div className="hhs__cab">
              <strong>{s.nombre}</strong>
              <span className="hhs__precio">{formatMoney(s.precio)}</span>
            </div>
            {s.descripcion && <p>{s.descripcion}</p>}
          </li>
        ))}
      </ul>

      {sobran > 0 && (
        <button type="button" className="hhs__mas" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} data-abierto={abierto || undefined}>
          {abierto ? "Ver menos" : `Ver los ${activa.items.length} servicios`}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
