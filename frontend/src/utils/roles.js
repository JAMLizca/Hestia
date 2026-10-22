import { capitalize } from "./format";
import { COLORS } from "./status";

/** Colores de los roles base; un rol creado después usa el color netro. */
const ROL_COLORS = { administrador: COLORS.purple, gerente: COLORS.gold, recepcionista: COLORS.cyan };

export const rolColor = (nombre) => ROL_COLORS[nombre] ?? COLORS.navy;
export const rolLabel = (nombre) => capitalize(nombre ?? "");