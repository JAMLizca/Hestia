import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  DoorOpen,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";
const TOKEN_KEY = "hestia_access_token";

const navigation = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "reservas", label: "Reservas", icon: CalendarDays },
  { id: "habitaciones", label: "Habitaciones", icon: BedDouble },
  { id: "huespedes", label: "Huéspedes", icon: Users },
];

const statusLabels = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  checkin: "En estancia",
  checkout: "Finalizada",
  cancelada: "Cancelada",
  disponible: "Disponible",
  ocupada: "Ocupada",
  limpieza: "En limpieza",
  mantenimiento: "Mantenimiento",
};

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value) {
  if (!value) return "—";
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : options.body
          ? { "Content-Type": "application/json" }
          : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Error ${response.status}: no se pudo completar la solicitud.`;
    try {
      const body = await response.json();
      const detail = body.detail;
      message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item.msg).join(". ")
            : message;
    } catch {
      // Conserva el error HTTP legible cuando el servidor no devuelve JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("resumen");
  const [data, setData] = useState({
    reservas: [],
    habitaciones: [],
    huespedes: [],
    tipos: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [reservationOwnerFilter, setReservationOwnerFilter] = useState("todas");
  const [showBooking, setShowBooking] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setData({ reservas: [], habitaciones: [], huespedes: [], tipos: [] });
    setReservationOwnerFilter("todas");
    setError("");
  }, []);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest("/auth/me", token),
      apiRequest("/reservas/", token),
      apiRequest("/habitaciones/", token),
      apiRequest("/huespedes/", token),
      apiRequest("/tipos-habitacion/", token),
    ])
      .then(([currentUser, reservas, habitaciones, huespedes, tipos]) => {
        if (cancelled) return;
        setUser(currentUser);
        setData({ reservas, habitaciones, huespedes, tipos });
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
        if (requestError.message.includes("401")) signOut();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, signOut]);

  const guestById = useMemo(
    () => new Map(data.huespedes.map((guest) => [guest.id, guest])),
    [data.huespedes],
  );
  const roomById = useMemo(
    () => new Map(data.habitaciones.map((room) => [room.id, room])),
    [data.habitaciones],
  );
  const typeById = useMemo(
    () => new Map(data.tipos.map((type) => [type.id, type])),
    [data.tipos],
  );

  const activeReservations = data.reservas.filter(
    (reservation) => !["cancelada", "checkout"].includes(reservation.estado),
  );
  const occupiedRooms = data.habitaciones.filter(
    (room) => room.estado === "ocupada",
  ).length;

  const filteredReservations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return [...data.reservas]
      .filter(
        (reservation) =>
          statusFilter === "todas" || reservation.estado === statusFilter,
      )
      .filter(
        (reservation) =>
          reservationOwnerFilter === "todas" ||
          reservation.usuario_id === user?.id,
      )
      .filter((reservation) => {
        if (!normalizedSearch) return true;
        const guest = guestById.get(reservation.huesped_id);
        const room = roomById.get(reservation.habitacion_id);
        return [
          guest?.nombres,
          guest?.apellidos,
          room?.numero,
          String(reservation.id),
        ]
          .filter(Boolean)
          .some((value) =>
            value.toLocaleLowerCase("es").includes(normalizedSearch),
          );
      })
      .sort(
        (first, second) =>
          new Date(first.fecha_checkin_prevista) -
          new Date(second.fecha_checkin_prevista),
      );
  }, [
    data.reservas,
    guestById,
    reservationOwnerFilter,
    roomById,
    search,
    statusFilter,
    user?.id,
  ]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const result = await apiRequest("/auth/login", null, {
        method: "POST",
        body: formData,
      });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      setToken(result.access_token);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  async function updateReservation(reservationId, action) {
    setError("");
    try {
      await apiRequest(`/reservas/${reservationId}/${action}`, token, {
        method: "POST",
      });
      refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function createReservation(payload) {
    setError("");
    try {
      await apiRequest("/reservas/", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowBooking(false);
      setActiveView("reservas");
      refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!token) return <LoginScreen onLogin={handleLogin} error={error} />;

  const viewTitle = navigation.find((item) => item.id === activeView)?.label;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}>
        <a className="brand" href="#" onClick={() => setActiveView("resumen")}>
          <span className="brand-mark">
            <Sparkles size={20} strokeWidth={1.8} />
          </span>
          <span className="brand-name">hestia<span>.</span></span>
        </a>

        <div className="hotel-switcher">
          <div className="hotel-avatar">H</div>
          <div className="hotel-copy">
            <strong>Casa Hestia</strong>
            <span>Hotel boutique</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <p className="nav-caption">MENÚ PRINCIPAL</p>
        <nav className="side-nav" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-link ${activeView === id ? "nav-link--active" : ""}`}
              key={id}
              onClick={() => {
                if (id === "reservas") setReservationOwnerFilter("todas");
                setActiveView(id);
                setMobileNavOpen(false);
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "reservas" && activeReservations.length > 0 && (
                <span className="nav-count">{activeReservations.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18} /></div>
            <strong>¿Necesitas ayuda?</strong>
            <span>Estamos aquí para ayudarte.</span>
            <a href="mailto:soporte@hestia.local">Contactar soporte <ArrowRight size={13} /></a>
          </div>
          <button className="profile-button" onClick={signOut}>
            <div className="profile-avatar">{initials(user?.nombre || "H")}</div>
            <div className="profile-copy">
              <strong>{user?.nombre || "Equipo Hestia"}</strong>
              <span>{user?.email || "Cuenta activa"}</span>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir navegación"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb"><span>Hestia</span><span className="breadcrumb-separator">/</span><strong>{viewTitle}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><CalendarDays size={15} /> {dateFormatter.format(new Date())}</span>
            <span className="topbar-avatar">{initials(user?.nombre || "H")}</span>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button className="alert-close" aria-label="Cerrar mensaje" onClick={() => setError("")}><X size={16} /></button>
            </div>
          )}
          {loading && <div className="loading-line"><span /> Sincronizando datos…</div>}
          {activeView === "resumen" && (
            <Dashboard
              data={data}
              occupiedRooms={occupiedRooms}
              user={user}
              guestById={guestById}
              roomById={roomById}
              typeById={typeById}
              onNavigate={setActiveView}
              onViewMyReservations={() => {
                setReservationOwnerFilter("mias");
                setActiveView("reservas");
              }}
              onNewBooking={() => setShowBooking(true)}
            />
          )}
          {activeView === "reservas" && (
            <ReservationsView
              reservations={filteredReservations}
              guestById={guestById}
              roomById={roomById}
              search={search}
              onSearch={setSearch}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              ownerFilter={reservationOwnerFilter}
              onOwnerFilter={setReservationOwnerFilter}
              onNewBooking={() => setShowBooking(true)}
              onAction={updateReservation}
            />
          )}
          {activeView === "habitaciones" && (
            <RoomsView rooms={data.habitaciones} typeById={typeById} />
          )}
          {activeView === "huespedes" && (
            <GuestsView guests={data.huespedes} reservations={data.reservas} />
          )}
        </div>
      </main>

      {showBooking && (
        <BookingModal
          rooms={data.habitaciones.filter((room) => room.estado !== "mantenimiento")}
          guests={data.huespedes}
          typeById={typeById}
          onClose={() => setShowBooking(false)}
          onSubmit={createReservation}
        />
      )}
    </div>
  );
}

function LoginScreen({ onLogin, error }) {
  return (
    <main className="login-screen">
      <div className="login-visual">
        <a className="brand brand--light" href="#">
          <span className="brand-mark"><Sparkles size={20} strokeWidth={1.8} /></span>
          <span className="brand-name">hestia<span>.</span></span>
        </a>
        <div className="login-quote">
          <span className="eyebrow">HOSPITALIDAD, CON INTENCIÓN</span>
          <h1>La calma de tenerlo todo <em>bajo control.</em></h1>
          <p>Un espacio para cuidar cada detalle de la experiencia de tus huéspedes.</p>
        </div>
        <div className="login-visual-footer"><span>01</span><span className="footer-rule" /><span>GESTIÓN HOTELERA</span></div>
      </div>
      <div className="login-panel">
        <div className="login-panel-content">
          <div className="login-mobile-brand brand">
            <span className="brand-mark"><Sparkles size={20} /></span><span className="brand-name">hestia<span>.</span></span>
          </div>
          <span className="eyebrow">BIENVENIDO DE NUEVO</span>
          <h2>Inicia sesión</h2>
          <p className="login-description">Ingresa tus datos para acceder al panel de gestión.</p>
          <form className="login-form" onSubmit={onLogin}>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="username" type="email" placeholder="nombre@hotel.com" autoComplete="username" required />
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button--primary login-submit" type="submit">Entrar al panel <ArrowRight size={16} /></button>
          </form>
          <p className="login-note"><span className="secure-dot" /> Conexión segura · Acceso exclusivo para el equipo</p>
        </div>
        <span className="login-copyright">© {new Date().getFullYear()} Hestia Hospitality</span>
      </div>
    </main>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Dashboard({
  data,
  occupiedRooms,
  user,
  guestById,
  roomById,
  typeById,
  onNavigate,
  onViewMyReservations,
  onNewBooking,
}) {
  const userReservations = data.reservas.filter(
    (reservation) => reservation.usuario_id === user?.id,
  );
  const userActiveReservations = userReservations.filter(
    (reservation) => !["cancelada", "checkout"].includes(reservation.estado),
  );
  const today = localDateValue();
  const arrivalsToday = userActiveReservations.filter(
    (reservation) =>
      reservation.fecha_checkin_prevista === today &&
      reservation.estado !== "checkin",
  ).length;
  const upcoming = [...userActiveReservations]
    .filter(
      (reservation) =>
        reservation.fecha_checkin_prevista >= today &&
        reservation.estado !== "checkin",
    )
    .sort(
      (first, second) =>
        new Date(first.fecha_checkin_prevista) -
        new Date(second.fecha_checkin_prevista),
    )
    .slice(0, 5);
  const occupancy =
    data.habitaciones.length > 0
      ? Math.round((occupiedRooms / data.habitaciones.length) * 100)
      : 0;
  const pending = userReservations.filter(
    (reservation) => reservation.estado === "pendiente",
  ).length;
  const roomStates = [
    ["disponible", "Disponibles", "room-state-green"],
    ["ocupada", "Ocupadas", "room-state-navy"],
    ["limpieza", "En limpieza", "room-state-orange"],
    ["mantenimiento", "Mantenimiento", "room-state-gray"],
  ];

  return (
    <>
      <PageHeading
        eyebrow="PANEL PRINCIPAL"
        title={`${greeting()}, ${user?.nombre?.trim().split(/\s+/)[0] || "bienvenido"}`}
        subtitle="Este es el estado del hotel y de tu actividad."
        action={<button className="button button--primary" onClick={onNewBooking}><Plus size={17} /> Nueva reserva</button>}
      />
      <div className="stats-grid">
        <StatCard
          icon={CalendarDays}
          label="Mis reservas activas"
          value={userActiveReservations.length}
          detail={`${pending} pendiente${pending === 1 ? "" : "s"} por confirmar`}
          accent="lavender"
        />
        <StatCard
          icon={DoorOpen}
          label="Mis llegadas de hoy"
          value={arrivalsToday}
          detail="Check-ins de tus reservas"
          accent="peach"
        />
        <StatCard
          icon={BedDouble}
          label="Ocupación"
          value={`${occupancy}%`}
          detail={`${occupiedRooms} de ${data.habitaciones.length} habitaciones`}
          accent="mint"
        />
        <StatCard
          icon={Check}
          label="Reservas gestionadas"
          value={userReservations.length}
          detail="Creadas desde tu cuenta"
          accent="blue"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel arrivals-panel">
          <div className="panel-heading">
            <div><h2>Tus próximas reservas</h2><p>Las estancias que has gestionado</p></div>
            <button className="text-link" onClick={onViewMyReservations}>Ver mis reservas <ArrowRight size={14} /></button>
          </div>
          {upcoming.length ? (
            <div className="upcoming-list">
              {upcoming.map((reservation) => {
                const guest = guestById.get(reservation.huesped_id);
                const room = roomById.get(reservation.habitacion_id);
                const name = guest ? `${guest.nombres} ${guest.apellidos}` : `Huésped #${reservation.huesped_id}`;
                return (
                  <div className="upcoming-row" key={reservation.id}>
                    <div className="guest-avatar">{initials(name)}</div>
                    <div className="upcoming-guest"><strong>{name}</strong><span>Hab. {room?.numero || reservation.habitacion_id} · {reservation.num_huespedes} huésped{reservation.num_huespedes === 1 ? "" : "es"}</span></div>
                    <div className="upcoming-dates"><strong>{formatDate(reservation.fecha_checkin_prevista)}</strong><span>hasta {formatDate(reservation.fecha_checkout_prevista)}</span></div>
                    <StatusBadge status={reservation.estado} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No tienes próximas reservas" description="Las próximas estancias que gestiones aparecerán aquí." />
          )}
          <div className="panel-footer"><button className="button button--secondary button--full" onClick={onViewMyReservations}>Ver mis reservas <ArrowRight size={15} /></button></div>
        </section>

        <section className="panel room-summary-panel">
          <div className="panel-heading">
            <div><h2>Estado de habitaciones</h2><p>Disponibilidad en tiempo real</p></div>
            <button className="icon-button subtle-button" aria-label="Ver habitaciones" onClick={() => onNavigate("habitaciones")}><ArrowRight size={17} /></button>
          </div>
          <div className="occupancy-display">
            <div className="occupancy-ring" style={{ "--occupancy": `${occupancy}%` }}>
              <div><strong>{occupancy}<small>%</small></strong><span>ocupación</span></div>
            </div>
            <div className="occupancy-caption"><strong>{occupiedRooms} <span>habitaciones ocupadas</span></strong><p>de {data.habitaciones.length} habitaciones en total</p></div>
          </div>
          <div className="room-state-list">
            {roomStates.map(([status, label, colorClass]) => {
              const count = data.habitaciones.filter((room) => room.estado === status).length;
              return <div className="room-state-row" key={status}><span className={`state-dot ${colorClass}`} /> <span>{label}</span><strong>{count}</strong></div>;
            })}
          </div>
          <div className="panel-footer"><button className="button button--secondary button--full" onClick={() => onNavigate("habitaciones")}>Ver todas las habitaciones <ArrowRight size={15} /></button></div>
        </section>
      </div>

      <section className="panel reservation-overview">
        <div className="panel-heading">
          <div><h2>Tu actividad reciente</h2><p>Reservas que has gestionado</p></div>
          <button className="text-link" onClick={onViewMyReservations}>Ver mis reservas <ArrowRight size={14} /></button>
        </div>
        {userReservations.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>HUÉSPED</th><th>HABITACIÓN</th><th>ESTANCIA</th><th>IMPORTE</th><th>ESTADO</th></tr></thead>
              <tbody>
                {[...userReservations].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)).slice(0, 4).map((reservation) => {
                  const guest = guestById.get(reservation.huesped_id);
                  const room = roomById.get(reservation.habitacion_id);
                  const guestName = guest ? `${guest.nombres} ${guest.apellidos}` : `Huésped #${reservation.huesped_id}`;
                  return <tr key={reservation.id}>
                    <td><div className="table-person"><span className="guest-avatar guest-avatar--small">{initials(guestName)}</span><strong>{guestName}</strong></div></td>
                    <td><span className="room-number">#{room?.numero || reservation.habitacion_id}</span>{typeById.get(room?.tipo_habitacion_id)?.nombre && <span className="muted-cell"> · {typeById.get(room.tipo_habitacion_id).nombre}</span>}</td>
                    <td>{formatDate(reservation.fecha_checkin_prevista)} <span className="muted-cell">→ {formatDate(reservation.fecha_checkout_prevista)}</span></td>
                    <td className="amount-cell">{currency.format(Number(reservation.precio_total))}</td>
                    <td><StatusBadge status={reservation.estado} /></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Aún no tienes actividad" description="Las reservas que gestiones desde tu cuenta aparecerán aquí." />
        )}
      </section>
    </>
  );
}

function StatCard({ icon: Icon, label, value, detail, accent, trendIcon: TrendIcon }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span className={`stat-icon stat-icon--${accent}`}><Icon size={18} strokeWidth={1.8} /></span>{TrendIcon && <span className="stat-trend"><TrendIcon size={14} /></span>}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

function ReservationsView({
  reservations,
  guestById,
  roomById,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  ownerFilter,
  onOwnerFilter,
  onNewBooking,
  onAction,
}) {
  return (
    <>
      <PageHeading
        eyebrow="OPERACIÓN"
        title="Reservas"
        subtitle="Gestiona las estancias y acompaña cada etapa del viaje."
        action={<button className="button button--primary" onClick={onNewBooking}><Plus size={17} /> Nueva reserva</button>}
      />
      <section className="panel reservations-panel">
        <div className="list-toolbar">
          <div className="search-field"><Search size={17} /><input aria-label="Buscar reserva" placeholder="Buscar huésped o habitación" value={search} onChange={(event) => onSearch(event.target.value)} /></div>
          <select aria-label="Filtrar reservas por usuario" value={ownerFilter} onChange={(event) => onOwnerFilter(event.target.value)}>
            <option value="todas">Todas las reservas</option>
            <option value="mias">Mis reservas</option>
          </select>
          <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
            <option value="todas">Todos los estados</option>
            {Object.entries(statusLabels).slice(0, 5).map(([status, label]) => <option value={status} key={status}>{label}</option>)}
          </select>
        </div>
        {reservations.length ? (
          <div className="table-wrap">
            <table className="reservations-table">
              <thead><tr><th>RESERVA</th><th>HUÉSPED</th><th>HABITACIÓN</th><th>CHECK-IN / CHECK-OUT</th><th>IMPORTE</th><th>ESTADO</th><th></th></tr></thead>
              <tbody>
                {reservations.map((reservation) => {
                  const guest = guestById.get(reservation.huesped_id);
                  const room = roomById.get(reservation.habitacion_id);
                  const guestName = guest ? `${guest.nombres} ${guest.apellidos}` : `Huésped #${reservation.huesped_id}`;
                  return <tr key={reservation.id}>
                    <td><span className="reservation-id">HS-{String(reservation.id).padStart(4, "0")}</span></td>
                    <td><div className="table-person"><span className="guest-avatar guest-avatar--small">{initials(guestName)}</span><div><strong>{guestName}</strong><span className="cell-subtitle">{guest?.email || "Huésped"}</span></div></div></td>
                    <td><span className="room-number">#{room?.numero || reservation.habitacion_id}</span><span className="cell-subtitle">{reservation.num_huespedes} huésped{reservation.num_huespedes === 1 ? "" : "es"}</span></td>
                    <td>{formatDate(reservation.fecha_checkin_prevista)}<span className="muted-cell"> → </span>{formatDate(reservation.fecha_checkout_prevista)}</td>
                    <td className="amount-cell">{currency.format(Number(reservation.precio_total))}</td>
                    <td><StatusBadge status={reservation.estado} /></td>
                    <td><ReservationActions reservation={reservation} onAction={onAction} /></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No encontramos reservas" description={search || statusFilter !== "todas" || ownerFilter !== "todas" ? "Prueba con otros términos o filtros." : "Crea la primera reserva para comenzar."} />}
        <div className="table-pagination"><span>Mostrando <strong>{reservations.length}</strong> reserva{reservations.length === 1 ? "" : "s"}</span><div><button className="pagination-button" disabled aria-label="Página anterior"><ArrowLeft size={15} /></button><span className="page-current">1</span><button className="pagination-button" disabled aria-label="Página siguiente"><ArrowRight size={15} /></button></div></div>
      </section>
    </>
  );
}

function ReservationActions({ reservation, onAction }) {
  const nextAction = {
    pendiente: ["confirmar", "Confirmar reserva"],
    confirmada: ["checkin", "Registrar check-in"],
    checkin: ["checkout", "Registrar check-out"],
  }[reservation.estado];

  return (
    <div className="row-actions">
      {nextAction && <button className="action-icon action-confirm" title={nextAction[1]} aria-label={nextAction[1]} onClick={() => onAction(reservation.id, nextAction[0])}><Check size={15} /></button>}
      {["pendiente", "confirmada"].includes(reservation.estado) && <button className="action-icon action-cancel" title="Cancelar reserva" aria-label="Cancelar reserva" onClick={() => onAction(reservation.id, "cancelar")}><X size={15} /></button>}
      <button className="action-icon" title="Ver detalle" aria-label={`Ver reserva ${reservation.id}`}><Eye size={15} /></button>
    </div>
  );
}

function RoomsView({ rooms, typeById }) {
  return (
    <>
      <PageHeading eyebrow="ALOJAMIENTO" title="Habitaciones" subtitle="Consulta la disponibilidad y el estado operativo de cada espacio." />
      {rooms.length ? (
        <div className="rooms-grid">
          {rooms.map((room) => {
            const type = typeById.get(room.tipo_habitacion_id);
            return <article className="room-card" key={room.id}>
              <div className={`room-illustration room-illustration--${room.estado}`}>
                <div className="room-art-window" /><div className="room-art-bed"><span /></div><div className="room-art-lamp" />
                <span className="room-card-number">#{room.numero}</span>
              </div>
              <div className="room-card-content">
                <div className="room-card-title"><div><h3>{type?.nombre || `Habitación ${room.numero}`}</h3><span>{room.piso ? `Piso ${room.piso}` : "Casa Hestia"}{type?.capacidad_maxima ? ` · Hasta ${type.capacidad_maxima} huéspedes` : ""}</span></div><StatusBadge status={room.estado} /></div>
                {room.caracteristicas && <p className="room-features">{room.caracteristicas}</p>}
              </div>
            </article>;
          })}
        </div>
      ) : <section className="panel"><EmptyState title="No hay habitaciones registradas" description="Cuando existan habitaciones, podrás consultar su disponibilidad aquí." /></section>}
    </>
  );
}

function GuestsView({ guests, reservations }) {
  return (
    <>
      <PageHeading eyebrow="RELACIONES" title="Huéspedes" subtitle="Un vistazo a las personas que han elegido Casa Hestia." />
      {guests.length ? (
        <section className="panel guests-panel">
          <div className="panel-heading"><div><h2>Directorio de huéspedes</h2><p>{guests.length} perfil{guests.length === 1 ? "" : "es"} registrados</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>HUÉSPED</th><th>DOCUMENTO</th><th>CONTACTO</th><th>NACIONALIDAD</th><th>ESTANCIAS</th></tr></thead>
              <tbody>{guests.map((guest) => {
                const name = `${guest.nombres} ${guest.apellidos}`;
                const stays = reservations.filter((reservation) => reservation.huesped_id === guest.id).length;
                return <tr key={guest.id}>
                  <td><div className="table-person"><span className="guest-avatar guest-avatar--small">{initials(name)}</span><div><strong>{name}</strong><span className="cell-subtitle">{guest.email || "Sin correo registrado"}</span></div></div></td>
                  <td>{guest.tipo_documento} · {guest.documento_identidad}</td>
                  <td>{guest.telefono || "—"}</td><td>{guest.nacionalidad || "—"}</td><td><span className="stays-pill">{stays} {stays === 1 ? "estancia" : "estancias"}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      ) : <section className="panel"><EmptyState title="Aún no hay huéspedes" description="Los perfiles aparecerán aquí al registrarse en el hotel." /></section>}
    </>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-badge--${status}`}><span />{statusLabels[status] || status}</span>;
}

function EmptyState({ title, description }) {
  return <div className="empty-state"><span className="empty-icon"><CalendarDays size={20} /></span><strong>{title}</strong><p>{description}</p></div>;
}

function BookingModal({ rooms, guests, typeById, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const today = localDateValue();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateValue(tomorrowDate);

  async function handleSubmit(event) {
    event.preventDefault();
    setValidationError("");
    const formData = new FormData(event.currentTarget);
    const checkin = formData.get("fecha_checkin_prevista");
    const checkout = formData.get("fecha_checkout_prevista");
    if (checkout <= checkin) {
      setValidationError("La fecha de salida debe ser posterior a la fecha de entrada.");
      return;
    }
    setSubmitting(true);
    await onSubmit({
      huesped_id: Number(formData.get("huesped_id")),
      habitacion_id: Number(formData.get("habitacion_id")),
      fecha_checkin_prevista: checkin,
      fecha_checkout_prevista: checkout,
      num_huespedes: Number(formData.get("num_huespedes")),
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-heading"><div><span className="eyebrow">NUEVA ESTANCIA</span><h2 id="booking-title">Crear reserva</h2><p>Completa los detalles para registrar una nueva estancia.</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></div>
        {guests.length && rooms.length ? (
          <form className="booking-form" onSubmit={handleSubmit}>
            <label htmlFor="guest">Huésped</label>
            <select id="guest" name="huesped_id" required defaultValue=""><option value="" disabled>Selecciona un huésped</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.nombres} {guest.apellidos}</option>)}</select>
            <label htmlFor="room">Habitación</label>
            <select id="room" name="habitacion_id" required defaultValue=""><option value="" disabled>Selecciona una habitación</option>{rooms.map((room) => <option key={room.id} value={room.id}>Hab. {room.numero} · {typeById.get(room.tipo_habitacion_id)?.nombre || "Habitación"}</option>)}</select>
            <div className="form-row">
              <div><label htmlFor="checkin">Fecha de entrada</label><input id="checkin" type="date" name="fecha_checkin_prevista" min={today} defaultValue={today} required /></div>
              <div><label htmlFor="checkout">Fecha de salida</label><input id="checkout" type="date" name="fecha_checkout_prevista" min={today} defaultValue={tomorrow} required /></div>
            </div>
            <label htmlFor="guest-count">Número de huéspedes</label>
            <input id="guest-count" type="number" name="num_huespedes" min="1" defaultValue="1" required />
            {validationError && <div className="form-error" role="alert">{validationError}</div>}
            <div className="modal-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button--primary" disabled={submitting}>{submitting ? "Guardando…" : "Crear reserva"} <ArrowRight size={15} /></button></div>
          </form>
        ) : (
          <div className="modal-empty"><p>Para crear una reserva, primero necesitas al menos un huésped y una habitación habilitada.</p><button className="button button--secondary" onClick={onClose}>Entendido</button></div>
        )}
      </section>
    </div>
  );
}

export default App;
