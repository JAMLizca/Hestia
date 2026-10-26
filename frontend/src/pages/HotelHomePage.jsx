import { ArrowRight, BedDouble, CalendarDays, ConciergeBell, Loader2, MapPin, Menu, Ruler, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { reservasWebApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import HeroCarrusel from "../features/hotel/HeroCarrusel";
import InfoHotel from "../features/hotel/InfoHotel";
import PieHotel from "../features/hotel/PieHotel";
import ServiciosHotel from "../features/hotel/ServiciosHotel";
import { FOTOS_DISPONIBLES, fotoDeTipo, fotoEspecificaDeTipo, fotoGeneralUrl } from "../utils/fotosHabitacion";
import { configureFormat, formatMoney, formatShortDate, nights as contarNoches, todayISO } from "../utils/format";
import "./HotelHomePage.css";

const MAX_NOCHES = 30; // mismo tope que la reserva en línea

const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Página principal para el público: qué ofrece el hotel, disponibilidad por fechas y acceso a reservar. */
export default function HotelHomePage() {
  const navigate = useNavigate();
  const { status, user, esCliente, esPersonal, logout } = useAuth();
  const [hotel, setHotel] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);

  const hoy = todayISO();
  const [fechas, setFechas] = useState({ checkin: sumarDias(hoy, 1), checkout: sumarDias(hoy, 2), huespedes: 2 });
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [resultado, setResultado] = useState(null); // { fechas, tipos } de la última búsqueda
  const resultadosRef = useRef(null);

  useEffect(() => {
    let activo = true;
    Promise.all([reservasWebApi.hotel(), reservasWebApi.catalogo()])
      .then(([h, c]) => {
        if (!activo) return;
        configureFormat({ moneda: h.moneda });
        setHotel(h);
        setCatalogo(c);
        document.title = `${h.nombre} · Reservas`;
      })
      .catch((err) => activo && setLoadError(err.message));
    return () => {
      activo = false;
    };
  }, []);

  // Fotos del carrusel del hero: una por tipo de habitación que tenga foto propia + las fotos extra de la galería.
  const slidesHero = useMemo(() => {
    const vistas = new Set();
    const lista = [];
    for (const t of catalogo?.tipos ?? []) {
      const url = fotoEspecificaDeTipo(t.nombre);
      if (url && !vistas.has(url)) {
        vistas.add(url);
        lista.push({ url, titulo: t.nombre, detalle: `Desde ${formatMoney(t.precio_noche)} por noche` });
      }
    }
    for (const f of FOTOS_DISPONIBLES) {
      if (!vistas.has(f.url)) {
        vistas.add(f.url);
        lista.push({ url: f.url });
      }
    }
    return lista.length ? lista.slice(0, 7) : [{ url: fotoGeneralUrl }];
  }, [catalogo]);

  const noches = contarNoches(fechas.checkin, fechas.checkout);
  const errorFechas = useMemo(() => {
    if (!fechas.checkin || !fechas.checkout) return "Elige la fecha de llegada y la de salida.";
    if (fechas.checkin < hoy) return "La llegada no puede ser una fecha pasada.";
    if (noches < 1) return "La salida debe ser posterior a la llegada.";
    if (noches > MAX_NOCHES) return `Reservamos hasta ${MAX_NOCHES} noches en línea. Para estadías más largas, comunícate con el hotel.`;
    return "";
  }, [fechas, noches, hoy]);

  const cambiarFecha = (campo) => (e) => {
    const valor = e.target.value;
    setResultado(null);
    setFechas((f) => {
      const siguiente = { ...f, [campo]: valor };
      // Si la llegada pasa a ser igual o posterior a la salida, se corre la salida un día.
      if (campo === "checkin" && valor && siguiente.checkout <= valor) siguiente.checkout = sumarDias(valor, 1);
      return siguiente;
    });
  };

  async function buscar(e) {
    e.preventDefault();
    if (errorFechas) {
      setErrorBusqueda(errorFechas);
      return;
    }
    setErrorBusqueda("");
    setBuscando(true);
    try {
      const tipos = await reservasWebApi.disponibilidad(fechas);
      setResultado({ fechas: { ...fechas }, tipos });
      requestAnimationFrame(() => resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setResultado(null);
      setErrorBusqueda(err.message);
    } finally {
      setBuscando(false);
    }
  }

  const irAReservar = (tipo) => {
    const f = resultado?.fechas ?? fechas;
    const params = new URLSearchParams({ llegada: f.checkin, salida: f.checkout, huespedes: String(f.huespedes) });
    if (tipo) params.set("tipo", String(tipo.tipo_habitacion_id));
    navigate(`/reservar?${params.toString()}`);
  };

  if (loadError) {
    return (
      <div className="hh hh--estado">
        <div className="hh-estado" role="alert">
          <h1>No pudimos cargar la página</h1>
          <p>{loadError}</p>
          <button type="button" className="hh-btn hh-btn--oro" onClick={() => window.location.reload()}>
            Intentar de nuevo
          </button>
          <p>
            <Link to="/login" className="hh-enlace">
              Acceso del personal
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (!hotel || !catalogo) {
    return (
      <div className="hh hh--estado" aria-busy="true">
        <div className="hh-estado">
          <Loader2 className="hh-giro" size={26} />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  const ubicacion = [hotel.ciudad, hotel.pais].filter(Boolean).join(", ");
  const contacto = [hotel.telefono, hotel.email].filter(Boolean);
  const reservasActivas = hotel.reservas_activas;
  const enlaces = [
    { href: "#habitaciones", label: "Habitaciones" },
    ...(catalogo.servicios.length ? [{ href: "#servicios", label: "Servicios" }] : []),
    { href: "#informacion", label: "Información" },
  ];

  return (
    <div className="hh">
      <header className="hh-nav">
        <div className="hh-wrap hh-nav__inner">
          <a href="#inicio" className="hh-marca">
            {hotel.nombre}
            <span aria-hidden="true">.</span>
          </a>
          <nav className={`hh-nav__links${menuAbierto ? " hh-nav__links--abierto" : ""}`} aria-label="Principal">
            {enlaces.map((e) => (
              <a key={e.href} href={e.href} onClick={() => setMenuAbierto(false)}>
                {e.label}
              </a>
            ))}
            <Link to="/reservar?vista=consultar" onClick={() => setMenuAbierto(false)}>
              Consultar reserva
            </Link>
            {esCliente && (
              <>
                <Link to="/mis-reservas" onClick={() => setMenuAbierto(false)}>
                  Mis reservas
                </Link>
                <button type="button" className="hh-nav__salir" onClick={logout}>
                  Salir ({user.nombres})
                </button>
              </>
            )}
            {esPersonal && (
              <Link to="/dashboard" onClick={() => setMenuAbierto(false)}>
                Ir al panel
              </Link>
            )}
            {status === "anonymous" && (
              <>
                <Link to="/login" onClick={() => setMenuAbierto(false)}>
                  Iniciar sesión
                </Link>
                <Link to="/login?modo=registro" className="hh-btn hh-btn--claro hh-btn--sm" onClick={() => setMenuAbierto(false)}>
                  Crear cuenta
                </Link>
              </>
            )}
            {reservasActivas && (
              <Link to="/reservar" className="hh-btn hh-btn--oro hh-btn--sm">
                Reservar
              </Link>
            )}
          </nav>
          <button type="button" className="hh-nav__toggle" onClick={() => setMenuAbierto((v) => !v)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
            {menuAbierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main>
        <section id="inicio" className="hh-hero">
          <HeroCarrusel slides={slidesHero} />
          <div className="hh-wrap hh-hero__contenido">
            {ubicacion && (
              <p className="hh-eyebrow">
                <MapPin size={14} aria-hidden="true" /> {ubicacion}
              </p>
            )}
            <h1 className="hh-hero__titulo">
              Tu estadía en <em>{hotel.nombre}</em>
            </h1>
            <p className="hh-hero__texto">
              Elige tus fechas, mira qué habitaciones tenemos libres y reserva en línea. Check-in desde las {hotel.hora_checkin} y check-out hasta las {hotel.hora_checkout}.
            </p>

            {reservasActivas ? (
              <form className="hh-buscador" onSubmit={buscar} aria-label="Buscar disponibilidad" noValidate>
                <label>
                  <span>
                    <CalendarDays size={14} aria-hidden="true" /> Llegada
                  </span>
                  <input type="date" value={fechas.checkin} min={hoy} onChange={cambiarFecha("checkin")} required />
                </label>
                <label>
                  <span>
                    <CalendarDays size={14} aria-hidden="true" /> Salida
                  </span>
                  <input type="date" value={fechas.checkout} min={sumarDias(fechas.checkin || hoy, 1)} onChange={cambiarFecha("checkout")} required />
                </label>
                <label>
                  <span>
                    <Users size={14} aria-hidden="true" /> Huéspedes
                  </span>
                  <select
                    value={fechas.huespedes}
                    onChange={(e) => {
                      setResultado(null);
                      setFechas((f) => ({ ...f, huespedes: Number(e.target.value) }));
                    }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {plural(n, "persona", "personas")}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="hh-btn hh-btn--oro" disabled={buscando}>
                  {buscando ? <Loader2 className="hh-giro" size={16} /> : <Search size={16} />} {buscando ? "Buscando…" : "Ver disponibilidad"}
                </button>
                {(errorBusqueda || (errorFechas && resultado === null && fechas.checkin !== sumarDias(hoy, 1))) && (
                  <p className="hh-buscador__error" role="alert">
                    {errorBusqueda || errorFechas}
                  </p>
                )}
              </form>
            ) : (
              <div className="hh-aviso">
                <p>
                  <strong>Por ahora recibimos las reservas por teléfono o correo.</strong>
                  {contacto.length > 0 ? ` Escríbenos: ${contacto.join(" · ")}.` : " Comunícate directamente con el hotel."}
                </p>
              </div>
            )}
          </div>
        </section>

        {resultado && (
          <section className="hh-seccion hh-resultados" ref={resultadosRef} aria-live="polite" aria-labelledby="hh-res-titulo">
            <div className="hh-wrap">
              <h2 id="hh-res-titulo" className="hh-h2">
                Disponible del {formatShortDate(resultado.fechas.checkin)} al {formatShortDate(resultado.fechas.checkout)}
              </h2>
              <p className="hh-sub">
                {plural(contarNoches(resultado.fechas.checkin, resultado.fechas.checkout), "noche", "noches")} · {plural(resultado.fechas.huespedes, "persona", "personas")}. El precio total no incluye los servicios que consumas durante tu estadía.
              </p>
              {resultado.tipos.length === 0 ? (
                <div className="hh-vacio">
                  <p>No tenemos habitaciones libres para esas fechas y ese número de personas.</p>
                  <p>Prueba con otras fechas, o escríbenos{contacto.length ? `: ${contacto.join(" · ")}` : ""}.</p>
                </div>
              ) : (
                <ul className="hh-lista">
                  {resultado.tipos.map((t) => (
                    <li key={t.tipo_habitacion_id} className="hh-fila">
                      <div>
                        <h3>{t.nombre}</h3>
                        {t.descripcion && <p>{t.descripcion}</p>}
                        <p className="hh-datos">
                          <span>
                            <Users size={14} aria-hidden="true" /> Hasta {plural(t.capacidad_maxima, "persona", "personas")}
                          </span>
                          <span>
                            <BedDouble size={14} aria-hidden="true" /> {plural(t.camas, "cama", "camas")}
                          </span>
                          {t.disponibles <= 3 && <span className="hh-pocas">Quedan {t.disponibles}</span>}
                        </p>
                      </div>
                      <div className="hh-precio">
                        <strong>{formatMoney(t.precio_total)}</strong>
                        <small>{formatMoney(t.precio_noche)} por noche</small>
                        <button type="button" className="hh-btn hh-btn--oro hh-btn--sm" onClick={() => irAReservar(t)}>
                          Reservar <ArrowRight size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <section id="habitaciones" className="hh-seccion hh-seccion--crema">
          <div className="hh-wrap">
            <p className="hh-etiqueta">Dónde te vas a quedar</p>
            <h2 className="hh-h2">Nuestras habitaciones</h2>
            {catalogo.tipos.length === 0 ? (
              <p className="hh-sub">Pronto publicaremos nuestras habitaciones.</p>
            ) : (
              <ul className="hh-tarjetas">
                {catalogo.tipos.map((t) => (
                  <li key={t.tipo_habitacion_id} className="hh-tarjeta">
                    <img src={fotoDeTipo(t.nombre)} alt={`Habitación ${t.nombre}`} loading="lazy" />
                    <div className="hh-tarjeta__cuerpo">
                      <h3>{t.nombre}</h3>
                      {t.descripcion && <p>{t.descripcion}</p>}
                      <p className="hh-datos">
                        <span>
                          <Users size={14} aria-hidden="true" /> {plural(t.capacidad_maxima, "persona", "personas")}
                        </span>
                        <span>
                          <BedDouble size={14} aria-hidden="true" /> {plural(t.camas, "cama", "camas")}
                        </span>
                        {t.metros_cuadrados && (
                          <span>
                            <Ruler size={14} aria-hidden="true" /> {Number(t.metros_cuadrados)} m²
                          </span>
                        )}
                      </p>
                      <p className="hh-desde">
                        Desde <strong>{formatMoney(t.precio_noche)}</strong> <small>por noche</small>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {reservasActivas && catalogo.tipos.length > 0 && (
              <p className="hh-centro">
                <a href="#inicio" className="hh-btn hh-btn--borde">
                  Elegir mis fechas
                </a>
              </p>
            )}
          </div>
        </section>

        {catalogo.servicios.length > 0 && (
          <section id="servicios" className="hh-seccion">
            <div className="hh-wrap">
              <p className="hh-etiqueta">
                <ConciergeBell size={14} aria-hidden="true" /> A tu disposición
              </p>
              <h2 className="hh-h2">Servicios del hotel</h2>
              <p className="hh-sub">Se cargan a tu cuenta durante la estadía y los pagas al hacer el check-out.</p>
              <ServiciosHotel servicios={catalogo.servicios} />
            </div>
          </section>
        )}

        <section id="informacion" className="hh-seccion hh-seccion--crema">
          <div className="hh-wrap">
            <p className="hh-etiqueta">Antes de venir</p>
            <h2 className="hh-h2">Información útil</h2>
            <InfoHotel hotel={hotel} ubicacion={ubicacion} />
          </div>
        </section>
      </main>

      <PieHotel hotel={hotel} ubicacion={ubicacion} enlaces={enlaces} reservasActivas={reservasActivas} />
    </div>
  );
}
