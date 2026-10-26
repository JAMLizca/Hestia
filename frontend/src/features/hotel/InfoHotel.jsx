import { ArrowRight, CalendarCheck, CreditCard, KeyRound, Luggage, Mail, MapPin, Navigation, Phone, ShieldCheck, Ticket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./InfoHotel.css";

/** Aparece (fundido + subida suave) cuando entra en pantalla. Sin animación si el usuario la reduce. */
function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`hhi__rev${visible ? " hhi__rev--on" : ""} ${className}`} style={{ "--d": `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Información útil de la página pública: horarios, cómo se confirma la reserva y cómo contactar / llegar. */
export default function InfoHotel({ hotel, ubicacion }) {
  const pagos = hotel.pagos_activos;
  const direccion = [hotel.direccion, ubicacion].filter(Boolean).join(" · ");
  const consulta = [hotel.nombre, hotel.direccion, ubicacion].filter(Boolean).join(", ");
  const mapa = direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}` : "";

  const pasos = [
    { icono: CalendarCheck, titulo: "Elige tus fechas", texto: "Mira qué habitaciones hay libres y envía tu reserva en línea en pocos minutos." },
    pagos
      ? { icono: CreditCard, titulo: "Asegura tu habitación", texto: `Pagas un anticipo del ${hotel.anticipo_porcentaje}% de forma segura con Wompi y tu reserva queda confirmada.` }
      : {
          icono: ShieldCheck,
          titulo: "El hotel la confirma",
          texto: `Revisamos tu solicitud y la confirmamos.${hotel.horas_vencimiento > 0 ? ` Si no se confirma en ${hotel.horas_vencimiento} horas, la solicitud se libera sola.` : ""}`,
        },
    { icono: Ticket, titulo: "Guarda tu código", texto: "Con tu código de reserva y tu documento puedes consultarla o cancelarla cuando quieras." },
  ];

  return (
    <div className="hhi">
      <div className="hhi__fila hhi__fila--arriba">
        {/* Horarios */}
        <Reveal className="hhi__horarios">
          <span className="hhi__brillo" aria-hidden="true" />
          <h3>Horarios</h3>
          <div className="hhi__recorrido">
            <div className="hhi__hora">
              <span className="hhi__ico">
                <KeyRound size={20} aria-hidden="true" />
              </span>
              <small>Check-in desde</small>
              <strong>{hotel.hora_checkin}</strong>
            </div>
            <div className="hhi__camino" aria-hidden="true">
              <i />
            </div>
            <div className="hhi__hora">
              <span className="hhi__ico">
                <Luggage size={20} aria-hidden="true" />
              </span>
              <small>Check-out hasta</small>
              <strong>{hotel.hora_checkout}</strong>
            </div>
          </div>
          <p>Si llegas antes o necesitas salir más tarde, escríbenos y lo revisamos según disponibilidad.</p>
        </Reveal>

        {/* Cómo se confirma */}
        <Reveal className="hhi__pasos" delay={120}>
          <h3>Así de fácil reservas</h3>
          <ol>
            {pasos.map((p, i) => {
              const Icono = p.icono;
              return (
                <li key={p.titulo} style={{ "--i": i }}>
                  <span className="hhi__num">
                    <Icono size={20} aria-hidden="true" />
                    <b>{i + 1}</b>
                  </span>
                  <div>
                    <h4>{p.titulo}</h4>
                    <p>{p.texto}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link to="/reservar?vista=consultar" className="hhi__cta">
            Consultar o cancelar mi reserva <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Reveal>
      </div>

      {/* Dónde estamos */}
      <Reveal className="hhi__donde" delay={80}>
        <MapPin className="hhi__marca" size={150} aria-hidden="true" />
        <div className="hhi__donde-texto">
          <span className="hhi__ico hhi__ico--oro">
            <MapPin size={20} aria-hidden="true" />
          </span>
          <h3>Dónde estamos</h3>
          <p>{direccion || "Consulta la dirección con el hotel."}</p>
        </div>
        <div className="hhi__acciones">
          {mapa && (
            <a className="hhi__btn hhi__btn--oro" href={mapa} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} aria-hidden="true" /> Cómo llegar
            </a>
          )}
          {hotel.telefono && (
            <a className="hhi__btn" href={`tel:${hotel.telefono.replace(/\s+/g, "")}`}>
              <Phone size={16} aria-hidden="true" /> {hotel.telefono}
            </a>
          )}
          {hotel.email && (
            <a className="hhi__btn" href={`mailto:${hotel.email}`}>
              <Mail size={16} aria-hidden="true" /> {hotel.email}
            </a>
          )}
        </div>
      </Reveal>
    </div>
  );
}
