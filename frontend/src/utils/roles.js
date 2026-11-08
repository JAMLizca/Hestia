import { capitalize } from "./format";
import { COLORS } from "./status";

const ROL_COLORS = { administrador: COLORS.purple, gerente: COLORS.gold, recepcionista: COLORS.cyan, auditor: COLORS.green };

export const rolColor = (nombre) => ROL_COLORS[(nombre ?? "").toLowerCase()] ?? COLORS.navy;
export const rolLabel = (nombre) => capitalize(nombre ?? "");
export const ROLES_BASE = ["administrador", "gerente", "recepcionista", "auditor"];
