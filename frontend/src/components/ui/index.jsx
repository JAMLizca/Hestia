/**
 * Componentes compartidos del panel de Hestia. Reproducen los patrones del
 * mockup: tarjetas, indicadores, pestañas, buscador, badges, tablas,
 * paginación y estados vacío/carga/error.
 */
import { AlertCircle, Inbox, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import "./ui.css";

/* ── Tarjeta ───────────────────────────────────────── */
export function Card({ title, subtitle, action, padded = true, className = "", children, ...rest }) {
  return (
    <section className={`card${padded ? " card--pad" : ""} ${className}`} {...rest}>
      {(title || action) && (
        <div className="card__header">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── Indicadores ───────────────────────────────────── */
export function StatGrid({ cols = 4, children }) {
  return (
    <div className="stat-grid" style={{ "--cols": cols }}>
      {children}
    </div>
  );
}

/** Indicador grande del Dashboard (ícono + número + etiqueta + detalle). */
export function StatCard({ icon: Icon, color, value, label, detail, progress }) {
  return (
    <div className="card stat-card">
      <div className="stat-card__top">
        <div className="stat-card__icon" style={{ background: hexAlpha(color, 0.094) }}>
          <Icon size={15} strokeWidth={1.75} color={color} />
        </div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {progress !== undefined && (
        <div className="stat-card__bar">
          <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: color }} />
        </div>
      )}
      {detail && <div className="stat-card__detail">{detail}</div>}
    </div>
  );
}

/** Indicador compacto de los módulos (número de color + etiqueta). */
export function MiniStat({ value, label, color = "var(--navy-700)" }) {
  return (
    <div className="card mini-stat">
      <div className="mini-stat__value" style={{ color }}>
        {value}
      </div>
      <div className="mini-stat__label">{label}</div>
    </div>
  );
}

/* ── Pestañas segmentadas ──────────────────────────── */
export function Tabs({ options, value, onChange, label = "Filtro" }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`tabs__btn${value === opt.value ? " tabs__btn--active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="tabs__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="search">
      <Search size={14} color="var(--gray-400)" strokeWidth={1.75} />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ── Botones ───────────────────────────────────────── */
export function Button({ variant = "primary", size, icon: Icon, loading, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn--${variant}${size ? ` btn--${size}` : ""} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="spin" /> : Icon && <Icon size={14} strokeWidth={1.9} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, title, color = "var(--navy-700)", ...rest }) {
  return (
    <button type="button" className="icon-btn" title={title} aria-label={title} style={{ color }} {...rest}>
      <Icon size={13} strokeWidth={1.9} />
    </button>
  );
}

/* ── Badges, etiquetas y avatar ────────────────────── */
export function Badge({ color, children }) {
  return (
    <span className="badge" style={{ color, background: hexAlpha(color, 0.094) }}>
      {children}
    </span>
  );
}

export function Chip({ color = "#2B3650", children }) {
  return (
    <span className="chip" style={{ color, background: hexAlpha(color, color === "#2B3650" ? 0.07 : 0.082) }}>
      {children}
    </span>
  );
}

// Colores de avatar del mockup: se eligen según la letra inicial del nombre.
const AVATAR_COLORS = ["#2B3650", "#4CAF82", "#8B5CF6", "#E88C30", "#C9A052"];

export function Avatar({ name = "", size = 28 }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const color = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {letter}
    </span>
  );
}

export function Person({ name, size = 28, muted }) {
  return (
    <div className="person">
      <Avatar name={name} size={size} />
      <span className="person__name" style={muted ? { fontWeight: 400, color: "var(--gray-500)", fontSize: 12.5 } : undefined}>
        {name}
      </span>
    </div>
  );
}

/* ── Tablas y paginación ───────────────────────────── */
export function usePagination(items, pageSize = 10) {
  const [requested, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Si los filtros reducen la lista, se muestra la última página válida.
  const page = Math.min(requested, totalPages);
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { page, setPage, totalPages, pageItems };
}

export function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
        Anterior
      </button>
      <button type="button" className="pagination__current" aria-current="page">
        {page}
      </button>
      {totalPages > 1 && <span>de {totalPages}</span>}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
        Siguiente
      </button>
    </div>
  );
}

/**
 * Tabla responsive. En escritorio es una tabla normal; en móvil cada fila se
 * convierte en una tarjeta: la columna `primary` (por defecto la primera) es el
 * título, las demás se muestran como "etiqueta: valor" y la columna "acciones"
 * queda al pie. Opciones por columna: primary, hideOnMobile, className.
 */
export function TableView({ columns, rows, rowKey = "id", compact, onRowClick, rowTitle }) {
  const primaryKey = (columns.find((c) => c.primary) ?? columns[0])?.key;
  return (
    <div className="table-scroll">
      <table className={`table table--stack${compact ? " table--compact" : ""}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "table__row--link" : undefined}
              title={rowTitle}
            >
              {columns.map((col) => {
                const role = col.key === "acciones" ? "td-actions" : col.key === primaryKey ? "td-primary" : "";
                return (
                  <td
                    key={col.key}
                    data-label={col.label}
                    className={[col.className, role, col.hideOnMobile ? "td-hide-mobile" : ""].filter(Boolean).join(" ")}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabla del mockup dentro de una tarjeta, con estados vacío/carga y pie con paginación. */
export function DataTable({ columns, rows, rowKey = "id", loading, empty, footer, onRowClick }) {
  return (
    <div className="card table-card">
      <TableView columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} />
      {loading && <LoadingState />}
      {!loading && rows.length === 0 && empty}
      {footer && <div className="table-footer">{footer}</div>}
    </div>
  );
}

/* ── Estados ───────────────────────────────────────── */
export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ text = "Cargando información…" }) {
  return (
    <div className="loading">
      <Loader2 size={18} className="spin" color="var(--gold)" />
      {text}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert--error" role="alert">
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="alert__action" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function InfoBanner({ children }) {
  return (
    <div className="alert alert--info">
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

/* ── Utilidad de color ─────────────────────────────── */
export function hexAlpha(color, alpha) {
  if (!color || !color.startsWith("#")) return color;
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

