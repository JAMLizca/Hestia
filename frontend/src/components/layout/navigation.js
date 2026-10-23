import { CalendarDays, Database, LayoutGrid, Settings, Shield, User, Users } from "lucide-react";
import { BedIcon, ServiceBellIcon } from "../ui/icons";

/**
 * Estructura del menú lateral tal como aparece en el mockup del panel.
 * `subtitle` es el texto bajo el título en el header de cada pantalla.
 * `modulo` es el módulo de la matriz de permisos (GET /roles/permisos): el ítem y su ruta solo se muestran a los
 * roles que pueden "ver" ese módulo (RNF-03). Sin `modulo` el ítem es para todos.
 */
export const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    title: "Gestión",
    items: [
      { to: "/reservas", modulo: "reservas", label: "Reservas", icon: CalendarDays, subtitle: "Gestión de reservas y estadías del hotel" },
      { to: "/habitaciones", modulo: "habitaciones", label: "Habitaciones", icon: BedIcon, subtitle: "Estado y disponibilidad de habitaciones" },
      { to: "/huespedes", modulo: "huespedes", label: "Huéspedes", icon: User, subtitle: "Registro y gestión de huéspedes activos" },
      { to: "/servicios", modulo: "servicios", label: "Servicios", icon: ServiceBellIcon, subtitle: "Solicitudes de servicio y atención a habitaciones" },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/usuarios", modulo: "usuarios", label: "Usuarios", icon: Users, subtitle: "Administración de usuarios del sistema Hestia" },
      { to: "/roles", modulo: "roles", label: "Roles", icon: Shield, subtitle: "Permisos y niveles de acceso por rol" },
      { to: "/reportes", modulo: "reportes", label: "Reportes", icon: Database, subtitle: "Exportación de datos para análisis y Machine Learning" },
    ],
  },
  {
    title: "Sistema",
    items: [{ to: "/configuracion", modulo: "configuracion", label: "Configuración", icon: Settings, subtitle: "Ajustes generales del sistema y del hotel" }],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
