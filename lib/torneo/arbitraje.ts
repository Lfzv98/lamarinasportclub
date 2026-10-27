/**
 * Lo que hace el árbitro (anotador) con un partido. El cliente lo aplica al instante y el
 * servidor lo vuelve a aplicar sobre la versión vigente del torneo (POST /api/torneos/:id/partidos/:pid),
 * así un árbitro nunca sube el torneo entero ni pisa cambios del staff.
 *
 * Roles: el árbitro de pista cierra resultados que llegan a mesa técnica "por revisar"; la mesa
 * técnica (árbitro principal o staff) los da por buenos ("revisar") o los corrige con un motivo.
 */
import type { ResultadoTorneo, Torneo } from "@/types/torneo";
import { cargarResultado, cargarWO, corregirResultado, iniciarPartido, llamarAPista, marcarVisto } from "./torneo.ts";

export type AccionPartido =
  | { accion: "llamar"; pista: number }
  | { accion: "iniciar"; pista?: number | null }
  | { accion: "resultado"; resultado: ResultadoTorneo }
  | { accion: "wo"; ganador: "A" | "B" }
  | { accion: "revisar" }
  | { accion: "corregir"; resultado: ResultadoTorneo; motivo: string };

/** PISTA = árbitro de pista; MESA = árbitro principal o staff. */
export type RolPartido = "PISTA" | "MESA";

export function aplicarAccion(t: Torneo, partidoId: string, a: AccionPartido, por?: string, rol: RolPartido = "PISTA"): Torneo {
  const revision = rol === "MESA" ? "VISTO" : "POR_REVISAR";
  switch (a.accion) {
    case "llamar":
      return llamarAPista(t, partidoId, a.pista);
    case "iniciar":
      return iniciarPartido(t, partidoId, a.pista ?? undefined);
    case "resultado":
      return cargarResultado(t, partidoId, a.resultado, por, revision);
    case "wo":
      return cargarWO(t, partidoId, a.ganador, por, revision);
    case "revisar":
      return marcarVisto(t, partidoId, por ?? "Mesa técnica");
    case "corregir":
      return corregirResultado(t, partidoId, a.resultado, a.motivo, por ?? "Mesa técnica");
  }
}
