import { ArrowRight, CalendarCheck, CalendarDays, LogIn, LogOut, User, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { habitacionesApi, huespedesApi, reservasApi, serviciosApi } from "../api/services";
import { Badge, Button, Card, Chip, ErrorBanner, LoadingState, Person, StatCard, StatGrid, TableView, hexAlpha } from "../components/ui";
import { BedIcon, PercentIcon, ServiceBellIcon, SparklesIcon } from "../components/ui/icons";
import { indexById, useApiData } from "../hooks/useApiData";
import { formatShortDate } from "../utils/format";
import { fullName, isToday, recentActivity, timeAgo, weeklyOccupancy } from "../utils/hotel";
import { COLORS, HABITACION_ESTADOS, RESERVA_ESTADOS } from "../utils/status";
import "./DashboardPage.css";

const ACTIVITY_STYLE = {
  reserva: { icon: CalendarCheck, color: COLORS.green },
  checkin: { icon: LogIn, color: COLORS.gold },
  checkout: { icon: LogOut, color: COLORS.orange },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData({
    reservas: () => reservasApi.list(),
    habitaciones: () => habitacionesApi.list(),
    huespedes: () => huespedesApi.list(),
    servicios: () => serviciosApi.list(),
  });
  const [loadedAt] = useState(() => new Date());

  const reservas = useMemo(() => data.reservas ?? [], [data.reservas]);
  const habitacionesList = useMemo(() => data.habitaciones ?? [], [data.habitaciones]);
  const huespedes = useMemo(() => indexById(data.huespedes), [data.huespedes]);
  const habitaciones = useMemo(() => indexById(habitacionesList), [habitacionesList]);

  const kpis = useMemo(() => {
    const total = habitacionesList.length;
    const ocupadas = habitacionesList.filter((h) => h.estado === "ocupada").length;
    const enCheckin = reservas.filter((r) => r.estado === "checkin");
    const llegadasHoy = reservas.filter((r) => isToday(r.fecha_checkin_prevista) && r.estado !== "cancelada");
    return {
      llegadasHoy: llegadasHoy.length,
      llegadasPendientes: llegadasHoy.filter((r) => r.estado === "pendiente" || r.estado === "confirmada").length,
      ocupacion: total ? Math.round((ocupadas / total) * 100) : 0,
      ocupadas,
      total,
      libres: habitacionesList.filter((h) => h.estado === "disponible").length,
      huespedesActivos: enCheckin.reduce((acc, r) => acc + (r.num_huespedes || 0), 0),
      habitacionesConHuespedes: enCheckin.length,
      servicios: (data.servicios ?? []).length,
    };
  }, [habitacionesList, reservas, data.servicios]);

  const estadoHabitaciones = Object.entries(HABITACION_ESTADOS).map(([key, s]) => {
    const count = habitacionesList.filter((h) => h.estado === key).length;
    return { key, ...s, count, pct: kpis.total ? (count / kpis.total) * 100 : 0 };
  });

  const recientes = useMemo(
    () => [...reservas].sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)) || b.id - a.id).slice(0, 5),
    [reservas],
  );
  const semana = useMemo(() => weeklyOccupancy(reservas, kpis.total), [reservas, kpis.total]);
  const hoySemana = semana.find((d) => d.isToday);
  const actividad = useMemo(() => recentActivity(reservas, { huespedes, habitaciones }), [reservas, huespedes, habitaciones]);

  if (loading) return <LoadingState text="Cargando el resumen del hotel…" />;

  return (
    <>
      <ErrorBanner message={error} onRetry={reload} />

      <section>
        <div className="dash-section-head">
          <h2 className="section-title">Resumen de hoy</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Actualizado a las {loadedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <StatGrid cols={5}>
          <StatCard
            icon={CalendarDays}
            color={COLORS.gold}
            value={kpis.llegadasHoy}
            label="Reservas hoy"
            detail={`${kpis.llegadasPendientes} ${kpis.llegadasPendientes === 1 ? "llegada pendiente" : "llegadas pendientes"} de check-in`}
          />
          <StatCard
            icon={PercentIcon}
            color={COLORS.green}
            value={`${kpis.ocupacion}%`}
            label="Ocupación"
            progress={kpis.ocupacion}
            detail={`${kpis.ocupadas} de ${kpis.total} habitaciones ocupadas`}
          />
          <StatCard icon={BedIcon} color={COLORS.navy} value={kpis.libres} label="Habitaciones libres" detail={`de ${kpis.total} habitaciones totales`} />
          <StatCard
            icon={User}
            color={COLORS.purple}
            value={kpis.huespedesActivos}
            label="Huéspedes activos"
            detail={`en ${kpis.habitacionesConHuespedes} ${kpis.habitacionesConHuespedes === 1 ? "habitación" : "habitaciones"}`}
          />
          <StatCard icon={ServiceBellIcon} color={COLORS.orange} value={kpis.servicios} label="Servicios activos" detail="en el catálogo del hotel" />
        </StatGrid>
      </section>

      <div className="dash-grid dash-grid--rooms">
        <Card title="Estado de habitaciones" action={<span className="muted" style={{ fontSize: 11 }}>{kpis.total} total</span>} className="dash-rooms">
          <div className="dash-rooms__bar">
            {estadoHabitaciones
              .filter((e) => e.count > 0)
              .map((e) => (
                <div key={e.key} style={{ width: `${e.pct}%`, background: e.color }} title={`${e.plural}: ${e.count}`} />
              ))}
          </div>
          <div className="dash-rooms__list">
            {estadoHabitaciones.map((e) => (
              <div key={e.key} className="dash-rooms__row">
                <div className="dash-rooms__label">
                  <span className="dash-rooms__dot" style={{ background: e.color }} />
                  {e.plural}
                </div>
                <div className="dash-rooms__value">
                  <div className="dash-rooms__mini">
                    <div style={{ width: `${e.pct}%`, background: e.color }} />
                  </div>
                  <strong>{e.count}</strong>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--link dash-link" onClick={() => navigate("/habitaciones")}>
            Ver todas las habitaciones <ArrowRight size={12} />
          </button>
        </Card>

        <Card
          title="Reservas recientes"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/reservas")}>
              Ver todas
            </Button>
          }
        >
          {recientes.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Aún no hay reservas registradas.
            </p>
          ) : (
            <TableView
              compact
              rows={recientes}
              onRowClick={(r) => navigate(`/reservas?reserva=${r.id}`)}
              rowTitle="Ver detalle de la reserva"
              columns={[
                { key: "huesped", label: "Huésped", render: (r) => <Person name={fullName(huespedes[r.huesped_id])} /> },
                { key: "hab", label: "Hab.", render: (r) => habitaciones[r.habitacion_id]?.numero ?? "—" },
                { key: "checkin", label: "Check-in", render: (r) => formatShortDate(r.fecha_checkin_prevista) },
                { key: "checkout", label: "Check-out", render: (r) => formatShortDate(r.fecha_checkout_prevista) },
                { key: "estado", label: "Estado", render: (r) => <Badge color={RESERVA_ESTADOS[r.estado]?.color}>{RESERVA_ESTADOS[r.estado]?.label}</Badge> },
              ]}
            />
          )}
        </Card>
      </div>

      <div className="dash-grid dash-grid--week">
        <Card>
          <div className="card__header" style={{ marginBottom: 20 }}>
            <div>
              <h3 className="card__title">Ocupación semanal</h3>
              <p className="card__subtitle">Porcentaje de ocupación por día</p>
            </div>
            <div className="dash-week__figures">
              <div>
                <div className="dash-week__big">{hoySemana?.pct ?? 0}%</div>
                <div className="dash-week__small">Ocupación actual</div>
              </div>
              <div className="dash-week__ai">
                <div className="dash-week__big" style={{ color: COLORS.gold, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <SparklesIcon size={11} color={COLORS.gold} />—
                </div>
                <div className="dash-week__small">Proyección IA</div>
              </div>
            </div>
          </div>
          <WeekChart days={semana} />
          <div className="dash-week__note">
            <SparklesIcon size={11} color={COLORS.gold} />
            La proyección de HestiaCast se mostrará cuando el modelo de predicción esté integrado al backend.
          </div>
        </Card>

        <div className="dash-side">
          <Card title="Acciones rápidas">
            <div className="quick-actions">
              <QuickAction icon={CalendarDays} label="Nueva reserva" onClick={() => navigate("/reservas?accion=nueva")} />
              <QuickAction icon={UserPlus} label="Registrar huésped" onClick={() => navigate("/huespedes?accion=nuevo")} />
              <QuickAction icon={BedIcon} label="Nueva habitación" onClick={() => navigate("/habitaciones?accion=nueva")} />
              <QuickAction icon={ServiceBellIcon} label="Agregar servicio" onClick={() => navigate("/servicios?accion=consumo")} />
            </div>
          </Card>

          <Card title="Actividad reciente" className="dash-activity">
            {actividad.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Sin actividad registrada.
              </p>
            ) : (
              <div className="activity">
                {actividad.map((a, i) => {
                  const style = ACTIVITY_STYLE[a.type];
                  const Icon = style.icon;
                  return (
                    <div key={i} className="activity__item">
                      <div className="activity__icon" style={{ background: hexAlpha(style.color, 0.082) }}>
                        <Icon size={13} color={style.color} strokeWidth={1.9} />
                      </div>
                      <div>
                        <div className="activity__title">{a.title}</div>
                        <div className="activity__text">{a.text}</div>
                        <div className="activity__time">{timeAgo(a.at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <section className="intelligence">
        <div>
          <div className="intelligence__eyebrow">
            <SparklesIcon size={12} color={COLORS.gold} /> Hestia Intelligence
          </div>
          <h2 className="intelligence__title">Información inteligente para apoyar la toma de decisiones.</h2>
          <p className="intelligence__text">
            Los modelos de predicción de ocupación y recomendación de habitaciones se mostrarán aquí cuando se integren al
            backend (semanas 11 a 14 del cronograma).
          </p>
        </div>
        <Chip color={COLORS.gold}>Próximamente</Chip>
      </section>
    </>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className="quick-action" onClick={onClick}>
      <span className="quick-action__icon">
        <Icon size={13} color="#2B3650" strokeWidth={1.75} />
      </span>
      {label}
    </button>
  );
}

/** Barras de ocupación (estilo del mockup): el día de hoy en dorado. */
function WeekChart({ days }) {
  const W = 640;
  const left = 40;
  const top = 18;
  const H = 120;
  const base = top + H;
  const slot = (W - left) / days.length;
  const barW = Math.min(44, slot * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${base + 26}`} className="week-chart" role="img" aria-label="Ocupación por día de la semana actual">
      {[25, 50, 75, 100].map((v) => {
        const y = base - (v / 100) * H;
        return (
          <g key={v}>
            <line x1={left} y1={y} x2={W} y2={y} stroke="#EDE8DA" strokeWidth="1" strokeDasharray="3,3" />
            <text x={left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#9CA3AF">
              {v}%
            </text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const cx = left + slot * i + slot / 2;
        const h = Math.max(3, (d.pct / 100) * H);
        return (
          <g key={d.iso}>
            <rect x={cx - barW / 2} y={base - h} width={barW} height={h} rx="6" fill={d.isToday ? "#C9A052" : "#2B3650"} opacity={d.isToday ? 1 : 0.45}>
              <title>{`${d.pct}% · ${d.iso}`}</title>
            </rect>
            {d.isToday && (
              <text x={cx} y={base - h - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#C9A052">
                {d.pct}%
              </text>
            )}
            <text x={cx} y={base + 18} textAnchor="middle" fontSize="11" fill="#9CA3AF">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
