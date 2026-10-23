import { test } from "node:test";
import assert from "node:assert/strict";
import { generarRondasDuplaFija, generarRondasIndividual, metricasRotacion } from "../lib/rotation.ts";
import { calcularTabla, validarResultado } from "../lib/scoring.ts";
import { cargarResultado, crearEvento } from "../lib/evento.ts";
import type { Jugador, Pareja } from "../types/americano.ts";

const jugadores = (n: number, mixto = false): Jugador[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `j${i + 1}`,
    nombre: `J${i + 1}`,
    genero: mixto ? (i % 2 === 0 ? "M" : "F") : "M",
    rating: 1 + (i % 6),
  }));

test("8 jugadores, 2 pistas, 7 rondas: nadie repite compañero", () => {
  const rondas = generarRondasIndividual(jugadores(8), { pistas: 2, rondas: 7, semilla: 42 });
  assert.equal(rondas.length, 7);
  const m = metricasRotacion(rondas);
  assert.equal(m.companerosRepetidos, 0);
  assert.equal(m.minPartidos, 7);
});

test("10 jugadores, 2 pistas: descansos repartidos (diferencia máx. 1 partido)", () => {
  const rondas = generarRondasIndividual(jugadores(10), { pistas: 2, rondas: 5, semilla: 7 });
  const m = metricasRotacion(rondas);
  assert.ok(m.maxPartidos - m.minPartidos <= 1, JSON.stringify(m));
  for (const r of rondas) assert.equal(r.descansanIds.length, 2);
});

test("12 jugadores, 3 pistas, 8 rondas: sin compañero repetido", () => {
  const m = metricasRotacion(generarRondasIndividual(jugadores(12), { pistas: 3, rondas: 8, semilla: 1 }));
  assert.equal(m.companerosRepetidos, 0);
});

test("mixto: cada pareja es hombre + mujer", () => {
  const js = jugadores(12, true);
  const g = new Map(js.map((j) => [j.id, j.genero]));
  const rondas = generarRondasIndividual(js, { pistas: 3, rondas: 6, semilla: 3, mixto: true });
  for (const r of rondas)
    for (const p of r.partidos)
      for (const par of [p.parejaA, p.parejaB]) assert.notEqual(g.get(par.jugadorIds[0]), g.get(par.jugadorIds[1]));
  assert.equal(metricasRotacion(rondas).companerosRepetidos, 0);
});

test("determinista con la misma semilla", () => {
  const a = generarRondasIndividual(jugadores(8), { pistas: 2, rondas: 4, semilla: 99 });
  const b = generarRondasIndividual(jugadores(8), { pistas: 2, rondas: 4, semilla: 99 });
  assert.deepEqual(a, b);
});

test("dupla fija: 6 parejas, 3 pistas → todos contra todos en 5 rondas", () => {
  const parejas: Pareja[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, jugadorIds: [`a${i}`, `b${i}`] }));
  const rondas = generarRondasDuplaFija(parejas, { pistas: 3, rondas: 5, semilla: 5 });
  const cruces = new Set(rondas.flatMap((r) => r.partidos.map((p) => [p.parejaA.id, p.parejaB.id].sort().join("-"))));
  assert.equal(cruces.size, 15);
});

test("dupla fija: 5 parejas, 2 pistas → descansos equitativos", () => {
  const parejas: Pareja[] = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, jugadorIds: [`a${i}`, `b${i}`] }));
  const rondas = generarRondasDuplaFija(parejas, { pistas: 2, rondas: 5, semilla: 5 });
  const count = new Map<string, number>();
  rondas.forEach((r) => r.partidos.forEach((p) => [p.parejaA.id, p.parejaB.id].forEach((id) => count.set(id, (count.get(id) ?? 0) + 1))));
  const v = [...count.values()];
  assert.ok(Math.max(...v) - Math.min(...v) <= 1);
});

test("validación de marcadores", () => {
  assert.equal(validarResultado({ metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, { puntosA: 14, puntosB: 10 }), null);
  assert.ok(validarResultado({ metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, { puntosA: 20, puntosB: 10 }));
  assert.equal(validarResultado({ metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6 }, { puntosA: 6, puntosB: 4 }), null);
  assert.equal(validarResultado({ metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 }, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 4, b: 3 }] }), null);
  assert.ok(validarResultado({ metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 }, { puntosA: 0, puntosB: 0, sets: [{ a: 5, b: 2 }] }));
});

test("tabla de posiciones individual", () => {
  let e = crearEvento({
    nombre: "t", categoria: { rama: "MASCULINO", nivel: "5TA" }, modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 2, duracionRondaMin: 15, totalRondas: 3, jugadores: jugadores(8), semilla: 1,
  });
  const p = e.rondas[0].partidos[0];
  e = cargarResultado(e, p.id, { puntosA: 15, puntosB: 9 });
  const t = calcularTabla(e);
  const top = t.filas.slice(0, 2).map((f) => f.entidadId).sort();
  assert.deepEqual(top, [...p.parejaA.jugadorIds].sort());
  assert.equal(t.filas[0].diferencia, 6);
  assert.equal(t.filas[0].pg, 1);
});

import { horaRonda, rondasQueCaben, validarFranja } from "../lib/horarios.ts";

test("horarios: rondas que caben y hora de cada ronda", () => {
  assert.equal(rondasQueCaben("19:00", "22:00", 15, 3), 10); // 10×15 + 9×3 = 177 min
  assert.equal(rondasQueCaben("19:00", "19:10", 15, 3), 0);
  assert.equal(horaRonda({ horaInicio: "19:00", duracionRondaMin: 15, minutosEntreRondas: 3 }, 3), "19:36");
  assert.equal(validarFranja({ abierto: true, apertura: "08:00", cierre: "22:00" }, "21:00", "23:00"), "El club cierra a las 22:00.");
});

test("dupla fija: nunca repite un cruce antes de completar todos contra todos", async () => {
  const { generarRondasDuplaFija, rondasSugeridas } = await import("../lib/rotation.ts");
  for (const n of [5, 6, 7, 8, 9, 10]) for (const pistas of [2, 3, 4]) {
    if (Math.floor(n / 2) < pistas) continue;
    const ps = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, jugadorIds: [`a${i}`, `b${i}`] as [string, string] }));
    const rondas = rondasSugeridas(n, "DUPLA_FIJA", pistas);
    for (let s = 1; s <= 5; s++) {
      const vistos = new Set<string>();
      for (const r of generarRondasDuplaFija(ps, { pistas, rondas, semilla: s })) {
        const claves = r.partidos.map((p) => [p.parejaA.id, p.parejaB.id].sort().join());
        const repetidos = claves.filter((k) => vistos.has(k));
        claves.forEach((k) => vistos.add(k));
        // Un cruce solo puede repetirse si en esa ronda ya se completó la vuelta.
        if (repetidos.length) assert.equal(vistos.size, (n * (n - 1)) / 2, `${n} parejas, ${pistas} pistas: cruce ${repetidos[0]} repetido`);
      }
    }
  }
});

test("mixto: las rondas sugeridas no obligan a repetir compañero", async () => {
  const { generarRondasIndividual, rondasSugeridas, metricasRotacion } = await import("../lib/rotation.ts");
  for (const n of [8, 10, 12, 16]) {
    const js = Array.from({ length: n }, (_, i) => ({ id: `j${i}`, nombre: `J${i}`, genero: (i % 2 ? "F" : "M") as "F" | "M", nivel: "4TA" as const, fotoUrl: null }));
    const rondas = rondasSugeridas(n, "INDIVIDUAL_ROTATIVO", 2, { hombres: n / 2, mujeres: n / 2 });
    assert.equal(metricasRotacion(generarRondasIndividual(js, { pistas: 2, rondas, semilla: 3, mixto: true })).companerosRepetidos, 0, `${n} jugadores, ${rondas} rondas`);
  }
});
