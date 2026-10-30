/**
 * Lluvia (o falla de luz, mantenimiento…) en americanos y en el Americano Torneo: un solo
 * punto de entrada para suspender y reactivar pistas, sea un americano, un grupo o la llave.
 *
 * En el Americano Torneo la pista mojada lo está para todo el torneo: se suspende en los
 * grupos y en la llave que la usan.
 */
import type { EventoAmericano } from "@/types/americano";
import { canchasDelEvento, reactivarPista, suspenderPista, type OpcionesSuspension } from "./evento.ts";
import { reactivarPistaLlave, suspenderPistaLlave } from "./habibi.ts";

export function suspenderPistaEn(e: EventoAmericano, numero: number, opts: OpcionesSuspension = {}): EventoAmericano {
  return e.habibi?.rol === "LLAVE" ? suspenderPistaLlave(e, numero, opts) : suspenderPista(e, numero, opts);
}

export function reactivarPistaEn(e: EventoAmericano, numero: number): EventoAmericano {
  return e.habibi?.rol === "LLAVE" ? reactivarPistaLlave(e, numero) : reactivarPista(e, numero);
}

/** Eventos que comparten pistas con `e`: él mismo o, en un Americano Torneo, sus grupos y su llave. */
export function eventosDelTorneo(e: EventoAmericano, eventos: Record<string, EventoAmericano>): EventoAmericano[] {
  const torneoId = e.habibi?.rol === "GRUPO" ? e.habibi.torneoId : e.habibi?.rol === "LLAVE" ? e.id : null;
  if (!torneoId) return [e];
  const llave = eventos[torneoId] ?? (e.id === torneoId ? e : undefined);
  if (llave?.habibi?.rol !== "LLAVE") return [e];
  const grupos = llave.habibi.grupos.map((g) => (g.eventoId === e.id ? e : eventos[g.eventoId])).filter((g): g is EventoAmericano => !!g && !g.eliminado);
  return [...grupos, llave.id === e.id ? e : llave];
}

/** Pistas de todos esos eventos (sin repetir), en orden. */
export function pistasDelTorneo(lista: EventoAmericano[]): number[] {
  return [...new Set(lista.flatMap((e) => canchasDelEvento(e)))].sort((a, b) => a - b);
}
