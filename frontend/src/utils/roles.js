import { capitalize } from "./format";
import { COLORS } from "./status";

/** Colores de los roles base; un rol creado después usa el color netro. */
const ROL_COLORS = { administrador: COLORS.purple, gerente: COLORS.gold, recepcionista: COLORS.cyan, auditor: COLORS.green };

export const rolColor = (nombre) => ROL_COLORS[(nombre ?? "").toLowerCase()] ?? COLORS.navy;
export const rolLabel = (nombre) => capitalize(nombre ?? "");
/** Roles que el código del backend da por existentes (sus permisos se asignan por nombre): no se pueden eliminar. */
export const ROLES_BASE = ["administrador", "gerente", "recepcionista", "auditor"];
