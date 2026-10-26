import { ArrowRight, ArrowUp, Clock, Lock, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import "./PieHotel.css";

/** Pie de la página pública: marca, navegación, contacto/horarios y accesos internos. */
export default function PieHotel({ hotel, ubicacion, enlaces, reservasActivas }) {
  const anio = new Date().getFullYear();
  const direccion = [hotel.direccion, ubicacion].filter(Boolean).join(" · ");
  const mapa = direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hotel.nombre, hotel.direccion, ubicacion].filter(Boolean).join(", "))}` : "";

  return (
    <footer className="hhp">
      <span className="hhp__linea" aria-hidden="true" />
      <div className="hh-wrap">
        <div className="hhp__grid">
          <section className="hhp__marca" aria-label={hotel.nombre}>
            <a href="#inicio" className="hhp__logo">
              {hotel.nombre}
              <span aria-hidden="true">.</span>
            </a>
            {ubicacion && (
              <p className="hhp__lugar">
                <MapPin size={14} aria-hidden="true" /> {ubicacion}
              </p>
            )}
            <p className="hhp__frase">Reserva en línea, elige tu habitación y llega con todo listo para descansar.</p>
            {reservasActivas && (
              <Link to="/reservar" className="hhp__cta">
                <Sparkles size={16} aria-hidden="true" /> Reservar ahora <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </section>

          <nav className="hhp__col" aria-label="Enlaces del hotel">
            <h2>Explora</h2>
            <ul>
              {enlaces.map((e) => (
                <li key={e.href}>
                  <a href={e.href}>{e.label}</a>
                </li>
              ))}
              <li>
                <Link to="/reservar?vista=consultar">Consultar mi reserva</Link>
              </li>
              <li>
                <Link to="/login?modo=registro">Crear una cuenta</Link>
              </li>
            </ul>
          </nav>

          <section className="hhp__col" aria-label="Contacto">
            <h2>Contacto</h2>
            <ul className="hhp__contacto">
              {direccion && (
                <li>
                  <MapPin size={16} aria-hidden="true" />
                  {mapa ? (
                    <a href={mapa} target="_blank" rel="noopener noreferrer">
                      {direccion}
                    </a>
                  ) : (
                    <span>{direccion}</span>
                  )}
                </li>
              )}
              {hotel.telefono && (
                <li>
                  <Phone size={16} aria-hidden="true" />
                  <a href={`tel:${hotel.telefono.replace(/\s+/g, "")}`}>{hotel.telefono}</a>
                </li>
              )}
              {hotel.email && (
                <li>
                  <Mail size={16} aria-hidden="true" />
                  <a href={`mailto:${hotel.email}`}>{hotel.email}</a>
                </li>
              )}
              <li>
                <Clock size={16} aria-hidden="true" />
                <span>
                  Check-in desde {hotel.hora_checkin}
                  <br />
                  Check-out hasta {hotel.hora_checkout}
                </span>
              </li>
            </ul>
          </section>
        </div>

        <div className="hhp__base">
          <p className="hhp__legal">
            <span>
              © {anio} {hotel.nombre}. Todos los derechos reservados.
            </span>
            <span className="hhp__privacidad">
              <ShieldCheck size={14} aria-hidden="true" /> Tus datos se usan solo para gestionar tu reserva.
            </span>
          </p>
          <div className="hhp__internos">
            <Link to="/login">
              <Lock size={13} aria-hidden="true" /> Acceso del personal
            </Link>
            <Link to="/hestia">Sistema Hestia</Link>
            <a href="#inicio" className="hhp__subir" aria-label="Volver arriba">
              <ArrowUp size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
