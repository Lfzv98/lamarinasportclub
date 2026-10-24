import { test } from "node:test";
import assert from "node:assert/strict";
import { descripcionPuntuacion, empateTieBreak, ganador, normalizarResultado, validarResultado } from "../lib/scoring.ts";
import { validarEvento } from "../lib/validacion.ts";
import { crearEvento } from "../lib/evento.ts";
import type { ConfigPuntuacion, Jugador } from "../types/americano.ts";

const ok = (cfg: ConfigPuntuacion, r: Parameters<typeof validarResultado>[1]) => assert.equal(validarResultado(cfg, r), null, JSON.stringify(r));
const mal = (cfg: ConfigPuntuacion, r: Parameters<typeof validarResultado>[1]) => assert.ok(validarResultado(cfg, r), JSON.stringify(r));

test("puntos: a 13 (primero en llegar)", () => {
  const c: ConfigPuntuacion = { metodo: "PUNTOS_TOTALES", puntosPorPartido: 13, modo: "A_GANAR" };
  ok(c, { puntosA: 13, puntosB: 9 });
  ok(c, { puntosA: 10, puntosB: 8 }); // se acabó el tiempo
  mal(c, { puntosA: 14, puntosB: 9 });
  mal(c, { puntosA: 13, puntosB: 13 });
  assert.equal(descripcionPuntuacion(c), "A 13 puntos");
});

test("puntos: 13 en total sigue funcionando como el americano clásico", () => {
  const c: ConfigPuntuacion = { metodo: "PUNTOS_TOTALES", puntosPorPartido: 13 };
  ok(c, { puntosA: 7, puntosB: 6 });
  mal(c, { puntosA: 13, puntosB: 9 });
});

test("games: 5 en total con tie a 5 si quedan 2-2", () => {
  const c: ConfigPuntuacion = { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 5, modo: "TOTAL", tieBreak: 5 };
  assert.equal(empateTieBreak(c), 2);
  assert.match(descripcionPuntuacion(c), /5 games en total · si quedan 2-2, tie a 5/);
  ok(c, { puntosA: 4, puntosB: 1 });
  ok(c, { puntosA: 3, puntosB: 2 });
  ok(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 5, b: 3 } });
  ok(c, { puntosA: 2, puntosB: 3, tieBreak: { a: 6, b: 8 } });
  mal(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 5, b: 4 } }); // sin 2 de diferencia
  mal(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 3, b: 5 } }); // el tie lo gana el otro
  mal(c, { puntosA: 4, puntosB: 1, tieBreak: { a: 5, b: 1 } }); // no hubo 2-2
  mal(c, { puntosA: 4, puntosB: 2 });
  const n = normalizarResultado(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 5, b: 2 } });
  assert.deepEqual(n.tieBreak, { a: 5, b: 2 });
  assert.equal(ganador(c, n), 1);
});

test("games: 6 en total con tie si quedan 3-3 → 4-3", () => {
  const c: ConfigPuntuacion = { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6, modo: "TOTAL", tieBreak: 7 };
  ok(c, { puntosA: 4, puntosB: 3, tieBreak: { a: 7, b: 4 } });
  ok(c, { puntosA: 3, puntosB: 3 }); // se acabó el tiempo antes del tie
  mal(c, { puntosA: 5, puntosB: 3 });
});

test("games: a 6 (primero en llegar) con tie a 5-5", () => {
  const c: ConfigPuntuacion = { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6, tieBreak: 7 };
  assert.equal(empateTieBreak(c), 5);
  ok(c, { puntosA: 6, puntosB: 5, tieBreak: { a: 9, b: 7 } });
  ok(c, { puntosA: 6, puntosB: 2 });
  mal(c, { puntosA: 6, puntosB: 2, tieBreak: { a: 7, b: 2 } });
  mal({ ...c, tieBreak: null }, { puntosA: 6, puntosB: 5, tieBreak: { a: 7, b: 2 } });
});

test("sets: mejor de 3 a 6 games con super tie a 10", () => {
  const c: ConfigPuntuacion = { metodo: "SETS_CORTOS", gamesPorPartido: 6, setsMaximos: 3, superTie: 10, puntoDeOro: false };
  ok(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 7, b: 6 }] });
  ok(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 5, b: 7 }, { a: 10, b: 8 }] });
  ok(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 5, b: 7 }, { a: 12, b: 14 }] });
  mal(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 5, b: 7 }, { a: 10, b: 9 }] });
  mal(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 5 }] });
  mal(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }, { a: 10, b: 3 }] }); // ya estaba decidido
  const n = normalizarResultado(c, { puntosA: 0, puntosB: 0, sets: [{ a: 6, b: 4 }, { a: 5, b: 7 }, { a: 10, b: 8 }] });
  assert.deepEqual([n.puntosA, n.puntosB], [12, 11]); // el super tie cuenta como un game
  assert.equal(ganador(c, n), 1);
  assert.match(descripcionPuntuacion(c), /super tie a 10 · con ventaja/);
});

test("sets cortos a 4 siguen igual", () => {
  const c: ConfigPuntuacion = { metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 };
  ok(c, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 3 }, { a: 2, b: 4 }, { a: 4, b: 0 }] });
  mal(c, { puntosA: 0, puntosB: 0, sets: [{ a: 5, b: 3 }] });
});

test("la API rechaza reglas fuera de rango", () => {
  const jugadores: Jugador[] = Array.from({ length: 8 }, (_, i) => ({ id: `j${i}`, nombre: `J${i}`, genero: "M", nivel: "4TA", fotoUrl: null }));
  const base = crearEvento({
      nombre: "T", categoria: { rama: "MASCULINO", nivel: "4TA" }, modalidad: "INDIVIDUAL_ROTATIVO",
      puntuacion: { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 5, modo: "TOTAL", tieBreak: 5 }, pistas: 2, duracionRondaMin: 15, totalRondas: 3, jugadores, semilla: 1,
  });
  assert.deepEqual(validarEvento(base), []);
  for (const p of [{ modo: "RARO" }, { gamesPorPartido: 40 }, { tieBreak: 1 }, { setsMaximos: 2 }, { puntoDeOro: "si" }, { tieConDiferencia: "no" }])
    assert.ok(validarEvento({ ...base, puntuacion: { ...base.puntuacion, ...p } }).length > 0, JSON.stringify(p));
});

test("tie-break sin diferencia de 2: gana el primero en llegar", () => {
  const c: ConfigPuntuacion = { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 5, modo: "TOTAL", tieBreak: 7, tieConDiferencia: false };
  ok(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 7, b: 6 } });
  ok(c, { puntosA: 2, puntosB: 3, tieBreak: { a: 4, b: 7 } });
  mal(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 8, b: 6 } }); // se pasó del 7
  mal(c, { puntosA: 3, puntosB: 2, tieBreak: { a: 6, b: 5 } }); // nadie llegó
  assert.match(descripcionPuntuacion(c), /tie a 7 sin diferencia de 2/);
  // Con la regla por defecto, 7-6 no vale.
  mal({ ...c, tieConDiferencia: undefined }, { puntosA: 3, puntosB: 2, tieBreak: { a: 7, b: 6 } });
  const s: ConfigPuntuacion = { metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3, superTie: 10, tieConDiferencia: false };
  ok(s, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 1, b: 4 }, { a: 10, b: 9 }] });
  mal(s, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 1, b: 4 }, { a: 11, b: 9 }] });
  assert.match(descripcionPuntuacion(s), /super tie a 10 sin diferencia de 2/);
});
