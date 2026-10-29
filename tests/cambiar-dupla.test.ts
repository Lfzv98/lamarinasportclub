/**
 * Cambiar o quitar una dupla que aún no jugó (no vino, la reemplazan), incluso con la
 * ronda 1 ya en juego: nadie suma ni pierde nada y la rotación sigue completa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarPareja, cambiarPareja, crearEvento, iniciarRonda, parejaEnPistaAhora, parejaSinJugar, quitarPareja, retirarPareja } from "../lib/evento.ts";
import { planRondas } from "../lib/rotation.ts";
import { calcularTabla } from "../lib/scoring.ts";
import type { EventoAmericano, Jugador, Pareja } from "../types/americano.ts";

const jug = (id: string, nombre = id.toUpperCase()): Jugador => ({ id, nombre, genero: "M", nivel: "4TA", fotoUrl: null });

function evento(n: number): EventoAmericano {
  const jugadores: Jugador[] = [];
  const parejas: Pareja[] = [];
  for (let i = 0; i < n; i++) {
    jugadores.push(jug(`a${i}`), jug(`b${i}`));
    parejas.push({ id: `p${i}`, jugadorIds: [`a${i}`, `b${i}`], nombre: `A${i} / B${i}` });
  }
  return crearEvento({
    nombre: "Jueves", categoria: { rama: "MASCULINO", nivel: "4TA" }, modalidad: "DUPLA_FIJA",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 4, duracionRondaMin: 15,
    totalRondas: planRondas(n, "DUPLA_FIJA", 4).rondas, jugadores, parejas, semilla: 3,
  });
}

const ids = (e: EventoAmericano) => e.rondas.flatMap((r) => r.partidos.flatMap((p) => [p.parejaA.id, p.parejaB.id]));

test("caso Americano Jueves: la dupla que no vino se cambia en su mismo lugar y la sobrante se quita", () => {
  let e = iniciarRonda(evento(8)); // ronda 1 en juego, sin marcadores
  const enPista3 = e.rondas[0].partidos[2].parejaA.id;
  e = retirarPareja(e, enPista3); // la marcaron "Retiro"…
  e = agregarPareja(e, jug("m1", "Manuel"), jug("mx", "Massimiliano")); // …y la sumaron aparte
  const sobrante = e.parejas[e.parejas.length - 1].id;
  assert.ok(parejaEnPistaAhora(e, enPista3), "la retirada sigue en la pista 3 de la ronda 1");

  e = cambiarPareja(e, enPista3, jug("m2", "Manuel"), jug("mx2", "Massimiliano"));
  e = quitarPareja(e, sobrante);

  assert.equal(e.parejas.length, 8);
  assert.ok(e.parejas.every((p) => !p.retirada));
  assert.ok(!ids(e).includes(sobrante), "la sobrante no queda en ninguna ronda");
  assert.ok(!e.rondas.some((r) => r.descansanIds.includes(sobrante)));
  const p3 = e.rondas[0].partidos[2];
  assert.equal(p3.parejaA.id, enPista3);
  assert.equal(p3.parejaA.nombre, "Manuel / Massimiliano");
  assert.equal(e.rondas[0].estado, "EN_JUEGO", "la ronda en juego sigue igual");
  // Cada ronda sigue con las 4 pistas llenas y sin duplas repetidas.
  for (const r of e.rondas) {
    assert.equal(r.partidos.length, 4, `ronda ${r.numero}`);
    const enRonda = r.partidos.flatMap((p) => [p.parejaA.id, p.parejaB.id]);
    assert.equal(new Set(enRonda).size, 8, `ronda ${r.numero} sin repetidos`);
  }
  // Nadie suma ni pierde nada; los viejos jugadores no quedan colgando.
  const t = calcularTabla(e);
  assert.equal(t.filas.length, 8);
  assert.ok(t.filas.every((f) => f.pj === 0 && f.pp === 0 && !f.retirado));
  assert.ok(t.filas.some((f) => f.nombre === "Manuel / Massimiliano"));
  const usados = new Set(e.parejas.flatMap((p) => p.jugadorIds));
  assert.ok(e.jugadores.every((j) => usados.has(j.id)), "sin jugadores sueltos");
  assert.deepEqual(t.filas.map((f) => f.posicion), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("una dupla con marcador ya no se puede cambiar ni quitar", () => {
  let e = iniciarRonda(evento(4));
  const p = e.rondas[0].partidos[0];
  assert.ok(parejaSinJugar(e, p.parejaA.id));
  e = { ...e, rondas: e.rondas.map((r, i) => (i ? r : { ...r, partidos: r.partidos.map((x, k) => (k ? x : { ...x, resultado: { puntosA: 13, puntosB: 11 }, estado: "FINALIZADO" as const })) })) };
  assert.ok(!parejaSinJugar(e, p.parejaA.id));
  assert.ok(!parejaSinJugar(e, p.parejaB.id));
});
