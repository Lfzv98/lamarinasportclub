/** Escala real: 450 duplas en 16 categorías (como el último Open de La Marina), de la inscripción al cierre. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { torneoGrande } from "../lib/torneo/grande.ts";
import { aplicarAccion } from "../lib/torneo/arbitraje.ts";
import { pendientesCierre, todosLosPartidos } from "../lib/torneo/torneo.ts";
import type { ResultadoTorneo, Torneo } from "../types/torneo.ts";

const gana = (g: "A" | "B"): ResultadoTorneo => ({ sets: g === "A" ? [{ a: 6, b: 3 }, { a: 6, b: 4 }] : [{ a: 4, b: 6 }, { a: 6, b: 3 }, { a: 4, b: 6 }], ganador: g, tipo: "NORMAL" });

test("450 duplas en dos semanas: todo programado, sin choques, finales el último día", () => {
  const t = torneoGrande({ id: "esc", desde: "2026-11-09", dias: 14, sortear: true });
  const ps = todosLosPartidos(t).filter((p) => !p.bye);
  assert.equal(t.categorias.reduce((s, c) => s + c.duplas.length, 0), 450);
  assert.equal(ps.filter((p) => !p.programacion).length, 0, "ningún partido sin horario");
  const slots = new Set<string>();
  for (const p of ps) {
    const k = `${p.programacion!.fecha} ${p.programacion!.hora} ${p.programacion!.pista}`;
    assert.ok(!slots.has(k), `choque de pista en ${k}`);
    slots.add(k);
  }
  const finales = ps.filter((p) => p.fase === "LLAVE" && !ps.some((q) => q.categoriaId === p.categoriaId && q.fase === "LLAVE" && q.ronda > p.ronda));
  assert.equal(finales.length, 16);
  assert.ok(finales.every((p) => p.programacion!.fecha === t.dias.at(-1)!.fecha), "las 16 finales, el último día");
});

test("450 duplas: se juega y revisa todo y el torneo se cierra solo", () => {
  let t: Torneo = torneoGrande({ id: "esc", desde: "2026-11-09", dias: 14, sortear: true });
  let n = 0;
  for (let vuelta = 0; vuelta < 12; vuelta++)
    for (const p of todosLosPartidos(t)) {
      if (p.bye || p.estado === "FINALIZADO" || !p.duplaA || !p.duplaB) continue;
      t = aplicarAccion(t, p.id, { accion: "resultado", resultado: gana(n++ % 3 ? "A" : "B") }, "Árbitro José", "PISTA");
      t = aplicarAccion(t, p.id, { accion: "revisar" }, "Árbitro principal Carla", "MESA");
    }
  const f = pendientesCierre(t);
  assert.deepEqual([f.sinJugar, f.porRevisar], [0, 0]);
  assert.equal(t.estado, "FINALIZADO");
  assert.equal(t.cerradoPor, "Automático");
  assert.ok(JSON.stringify(t).length < 1_500_000, "el torneo entero pesa menos de 1,5 MB");
});
