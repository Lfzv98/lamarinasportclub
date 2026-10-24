import "server-only";
import type { Torneo } from "@/types/torneo";
import { arbitroDe, huellaClave, leerAccesos, sesionDe, type SesionArbitro } from "./auth";

/** Lo que cada quien puede ver de un torneo. */
export type Visor = { staff: boolean; accesos: Record<string, number>; arbitro?: SesionArbitro | null };

export function visorDe(req: Request): Visor {
  return { staff: !!sesionDe(req), accesos: leerAccesos(req), arbitro: arbitroDe(req) };
}

/**
 * ¿La sesión de árbitro vale para ver este torneo? (mismo PIN vigente y sin vencer).
 * Para escribir, además, `arbitroValido` (lib/server/arbitros) revisa su registro.
 */
export function esArbitroDe(t: Torneo, a?: SesionArbitro | null): boolean {
  if (!a || !a.arbitroId || a.torneoId !== t.id || !t.arbitros?.pin || t.eliminado) return false;
  if (!(new Date(t.arbitros.vence).getTime() > Date.now())) return false;
  return a.huella === huellaClave(t.arbitros.pin);
}

/** Clave del acceso en la cookie: torneo + huella de la clave vigente. */
export const llaveAcceso = (torneoId: string, clave: string) => `${torneoId}:${huellaClave(clave)}`;

export function puedeVer(t: Torneo, v: Visor): boolean {
  if (v.staff || !t.acceso?.clave || esArbitroDe(t, v.arbitro)) return true;
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
  const arbitros = t.arbitros?.pin ? { pin: "", vence: t.arbitros.vence, turnos: t.arbitros.turnos } : null;
  if (puedeVer(t, v)) return { ...t, acceso, arbitros, historial: [] };
  return {
    ...t,
    acceso,
    arbitros: arbitros && { pin: "", vence: arbitros.vence },
    bloqueado: true,
    jugadores: [],
    historial: [],
    bloqueos: [],
    categorias: t.categorias.map((c) => ({ ...c, duplas: [], cuadro: null })),
  };
}
