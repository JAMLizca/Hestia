import { CalendarDays, LayoutGrid, Settings, Shield, User, Users } from "lucide-react";
import { BedIcon, ServiceBellIcon } from "../ui/icons";

/**
 * Estructura del menú lateral tal como aparece en el mockup del panel.
 * `subtitle` es el texto bajo el título en el header de cada pantalla.
 */
export const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    title: "Gestión",
    items: [
      { to: "/reservas", label: "Reservas", icon: CalendarDays, subtitle: "Gestión de reservas y estadías del hotel" },
      { to: "/habitaciones", label: "Habitaciones", icon: BedIcon, subtitle: "Estado y disponibilidad de habitaciones" },
      { to: "/huespedes", label: "Huéspedes", icon: User, subtitle: "Registro y gestión de huéspedes activos" },
      { to: "/servicios", label: "Servicios", icon: ServiceBellIcon, subtitle: "Solicitudes de servicio y atención a habitaciones" },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/usuarios", label: "Usuarios", icon: Users, subtitle: "Administración de usuarios del sistema Hestia" },
      { to: "/roles", label: "Roles", icon: Shield, subtitle: "Permisos y niveles de acceso por rol" },
    ],
  },
  {
    title: "Sistema",
    items: [{ to: "/configuracion", label: "Configuración", icon: Settings, subtitle: "Ajustes generales del sistema y del hotel" }],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
