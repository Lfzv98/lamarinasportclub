/** Prueba de carga pura: 450 duplas, de la inscripción al cierre. node --experimental-strip-types scripts/stress-grande.ts */
import { torneoGrande } from "../lib/torneo/grande.ts";
import { aplicarAccion } from "../lib/torneo/arbitraje.ts";
import { pendientesCierre, todosLosPartidos } from "../lib/torneo/torneo.ts";
import { programarTorneo } from "../lib/torneo/programacion.ts";
import { suspenderPistas } from "../lib/torneo/imprevistos.ts";
import type { ResultadoTorneo, Torneo } from "../types/torneo.ts";

const ms = (t0: number) => `${(performance.now() - t0).toFixed(0)} ms`;
let t0 = performance.now();
let t: Torneo = torneoGrande({ id: "stress", desde: "2026-11-09" });
console.log("inscribir 450 duplas:", ms(t0), "duplas:", t.categorias.reduce((s, c) => s + c.duplas.length, 0), "jugadores:", t.jugadores.length);
t0 = performance.now();
t = torneoGrande({ id: "stress", desde: "2026-11-09", sortear: true });
const partidos = todosLosPartidos(t).filter((p) => !p.bye);
const sin = partidos.filter((p) => !p.programacion);
console.log("inscribir+sortear+publicar+programar:", ms(t0), "partidos:", partidos.length, "sin horario:", sin.length);
const json = JSON.stringify(t);
console.log("tamaño JSON:", (json.length / 1024).toFixed(0), "KB");
// Choques: misma pista a la misma hora, o un jugador en dos partidos a la vez.
const porSlot = new Map<string, number>();
for (const p of partidos) if (p.programacion) { const k = `${p.programacion.fecha} ${p.programacion.hora} ${p.programacion.pista}`; porSlot.set(k, (porSlot.get(k) ?? 0) + 1); }
console.log("choques de pista:", [...porSlot.values()].filter((n) => n > 1).length);
const ult = t.dias.at(-1)!.fecha;
const finales = partidos.filter((p) => p.fase === "LLAVE" && !partidos.some((q) => q.categoriaId === p.categoriaId && q.fase === "LLAVE" && q.ronda > p.ronda));
console.log("finales:", finales.length, "el último día:", finales.filter((p) => p.programacion?.fecha === ult).length);

// Reprogramar con lluvia a media competencia.
t0 = performance.now();
const r = suspenderPistas(t, { pistas: [5, 10, 11, 12, 13], motivo: "Lluvia", ahora: Date.parse("2026-11-10T21:00:00Z"), hastaMs: Date.parse("2026-11-10T23:00:00Z"), marcadores: {}, por: "Staff" });
console.log("lluvia en 5 pistas exteriores + reprogramar:", ms(t0), "afectados:", (r as unknown as { reprogramados?: number }).reprogramados ?? "-");

// Jugar todo: árbitros de pista cargan, mesa técnica revisa.
const gana = (g: "A" | "B"): ResultadoTorneo => ({ sets: g === "A" ? [{ a: 6, b: 3 }, { a: 6, b: 4 }] : [{ a: 4, b: 6 }, { a: 6, b: 3 }, { a: 4, b: 6 }], ganador: g, tipo: "NORMAL" });
t0 = performance.now();
let acciones = 0, maxMs = 0;
for (let vuelta = 0; vuelta < 12; vuelta++) {
  let algo = false;
  for (const p of todosLosPartidos(t)) {
    if (p.bye || p.estado === "FINALIZADO" || !p.duplaA || !p.duplaB) continue;
    const a = performance.now();
    t = aplicarAccion(t, p.id, { accion: "resultado", resultado: gana(acciones % 3 ? "A" : "B") }, "Árbitro José", "PISTA");
    t = aplicarAccion(t, p.id, { accion: "revisar" }, "Árbitro principal Carla", "MESA");
    maxMs = Math.max(maxMs, performance.now() - a);
    acciones += 2;
    algo = true;
  }
  if (!algo) break;
}
console.log(`jugar y revisar todo: ${ms(t0)} · ${acciones} acciones · peor: ${maxMs.toFixed(0)} ms · promedio: ${((performance.now() - t0) / acciones).toFixed(1)} ms`);
console.log("pendientes:", JSON.stringify(pendientesCierre(t)), "estado:", t.estado, "cerrado por:", t.cerradoPor);
console.log("tamaño JSON final:", (JSON.stringify(t).length / 1024).toFixed(0), "KB");
t0 = performance.now();
programarTorneo(t, { desde: "2026-11-12T18:00:00.000Z" });
console.log("reprogramar «Desde ahora» con todo jugado:", ms(t0));
