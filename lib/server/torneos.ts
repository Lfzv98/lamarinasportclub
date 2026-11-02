import "server-only";
import type { Torneo } from "@/types/torneo";
import { arbitroDe, huellaClave, leerAccesos, sesionDe, type SesionArbitro } from "./auth";
import { sesionValida } from "./arbitros";
import { ErrorApi } from "./http";
import type { TorneosRepository } from "./repository";

/** Lo que cada quien puede ver de un torneo. */
export type Visor = { staff: boolean; accesos: Record<string, number>; arbitro?: SesionArbitro | null };

/** Quién mira. La sesión de árbitro solo cuenta si sigue valiendo en el plantel del club. */
export async function visorDe(req: Request): Promise<Visor> {
  const s = arbitroDe(req);
  return { staff: !!(await sesionDe(req)), accesos: leerAccesos(req), arbitro: s && (await sesionValida(s)) ? s : null };
}

/** Un árbitro del club (sesión ya validada en `visorDe`) ve y anota cualquier torneo vigente. */
export function esArbitroDe(t: Torneo, a?: SesionArbitro | null): boolean {
  return !!a?.arbitroId && !t.eliminado;
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
  if (puedeVer(t, v)) return { ...t, acceso, historial: [] };
  return {
    ...t,
    acceso,
    arbitros: null,
    bloqueado: true,
    jugadores: [],
    historial: [],
    bloqueos: [],
    categorias: t.categorias.map((c) => ({ ...c, duplas: [], cuadro: null })),
  };
}

/**
 * Lee, cambia y guarda un torneo sin pisar lo que otro guardó en el medio (dos tablets cerrando
 * partidos a la vez, mesa técnica revisando mientras el staff programa…). Si la versión cambió entre
 * la lectura y el guardado, vuelve a leer y aplica el cambio sobre la versión nueva. `cambio` puede
 * lanzar un ErrorApi (validaciones): se valida siempre contra la versión vigente.
 */
export async function actualizarTorneo(
  repo: TorneosRepository,
  id: string,
  cambio: (t: Torneo) => Torneo,
  intentos = 6,
): Promise<{ antes: Torneo; despues: Torneo }> {
  for (let i = 0; ; i++) {
    const t = await repo.obtener(id);
    if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
    const final = cambio(t);
    if (final === t) return { antes: t, despues: t };
    if (await repo.guardarSi(final, t.actualizadoEn)) return { antes: t, despues: final };
    // Último recurso: guardar igual (mejor un cambio aplicado sobre la última lectura que perderlo).
    if (i >= intentos - 1) {
      await repo.guardar(final);
      return { antes: t, despues: final };
    }
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 60 * (i + 1)));
  }
}
