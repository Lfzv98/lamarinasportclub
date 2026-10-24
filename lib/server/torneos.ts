import "server-only";
import type { Torneo } from "@/types/torneo";
import { huellaClave, leerAccesos, sesionDe } from "./auth";

/** Lo que cada quien puede ver de un torneo. */
export type Visor = { staff: boolean; accesos: Record<string, number> };

export function visorDe(req: Request): Visor {
  return { staff: !!sesionDe(req), accesos: leerAccesos(req) };
}

/** Clave del acceso en la cookie: torneo + huella de la clave vigente. */
export const llaveAcceso = (torneoId: string, clave: string) => `${torneoId}:${huellaClave(clave)}`;

export function puedeVer(t: Torneo, v: Visor): boolean {
  if (v.staff || !t.acceso?.clave) return true;
  if (!(new Date(t.acceso.vence).getTime() > Date.now())) return false;
  return !!v.accesos[llaveAcceso(t.id, t.acceso.clave)];
}

/**
 * Versión de un torneo para enviar al cliente: el staff la recibe completa; el resto
 * sin la clave, y si no tiene acceso (o la clave venció), un resumen sin datos.
 */
export function paraVisor(t: Torneo, v: Visor): Torneo {
  if (v.staff) return t;
  const acceso = t.acceso?.clave ? { clave: "", vence: t.acceso.vence } : null;
  if (puedeVer(t, v)) return { ...t, acceso, historial: [] };
  return {
    ...t,
    acceso,
    bloqueado: true,
    jugadores: [],
    historial: [],
    bloqueos: [],
    categorias: t.categorias.map((c) => ({ ...c, duplas: [], cuadro: null })),
  };
}
