/**
 * Americano individual y mixto: cambiar o quitar a un jugador que aún no jugó (no vino, entra otro).
 * El que entra ocupa su mismo lugar, nadie suma ni pierde nada y no se repiten parejas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cargarResultado, cambiarJugador, crearEvento, iniciarRonda, jugadorEnPistaAhora, jugadorSinJugar, quitarJugador } from "../lib/evento.ts";
import { planRondas } from "../lib/rotation.ts";
import { calcularTabla } from "../lib/scoring.ts";
import type { EventoAmericano, Genero, Jugador } from "../types/americano.ts";

const jug = (id: string, genero: Genero = "M", nombre = id.toUpperCase()): Jugador => ({ id, nombre, genero, nivel: "4TA", fotoUrl: null });

function evento(n: number, mixto = false): EventoAmericano {
  const jugadores = Array.from({ length: n }, (_, i) => jug(`j${i}`, mixto ? (i % 2 ? "F" : "M") : "M"));
  return crearEvento({
    nombre: "Individual", categoria: { rama: mixto ? "MIXTO" : "MASCULINO", nivel: "4TA" }, modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 2, duracionRondaMin: 15,
    totalRondas: planRondas(n, "INDIVIDUAL_ROTATIVO", 2).rondas, jugadores, semilla: 5,
  });
}

const enPartidos = (e: EventoAmericano, id: string) => e.rondas.some((r) => r.partidos.some((p) => [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes(id)));

function sinRepetidosPorRonda(e: EventoAmericano) {
  for (const r of e.rondas) {
    const ids = r.partidos.flatMap((p) => [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds]);
    assert.equal(new Set(ids).size, ids.length, `ronda ${r.numero}: nadie juega dos veces`);
    for (const id of ids) assert.ok(e.jugadores.some((j) => j.id === id), `ronda ${r.numero}: ${id} existe`);
  }
}

test("individual: el que entra ocupa el mismo lugar en todas las rondas", () => {
  const e0 = iniciarRonda(evento(8));
  const sale = "j3";
  const antes = e0.rondas.map((r) => r.partidos.map((p) => [p.parejaA.jugadorIds, p.parejaB.jugadorIds].map((x) => x.map((id) => (id === sale ? "X" : id)).sort().join("+"))));
  assert.ok(jugadorSinJugar(e0, sale));
  const e = cambiarJugador(e0, sale, jug("nuevo", "M", "Pedro"));
  const despues = e.rondas.map((r) => r.partidos.map((p) => [p.parejaA.jugadorIds, p.parejaB.jugadorIds].map((x) => x.map((id) => (id === "nuevo" ? "X" : id)).sort().join("+"))));
  assert.deepEqual(despues, antes, "mismos compañeros y rivales");
  assert.ok(!enPartidos(e, sale) && !e.jugadores.some((j) => j.id === sale), "el que no vino desaparece");
  assert.ok(e.rondas[0].partidos.some((p) => `${p.parejaA.nombre}${p.parejaB.nombre}`.includes("Pedro")), "su nombre sale en la pista");
  assert.equal(e.rondas[0].estado, "EN_JUEGO");
  sinRepetidosPorRonda(e);
  const t = calcularTabla(e);
  assert.ok(t.filas.every((f) => f.pj === 0));
  assert.ok(t.filas.some((f) => f.nombre.includes("Pedro")));
});

test("individual: quitar a uno que no está en pista re-sortea sin él", () => {
  let e = evento(9); // 9 jugadores, 2 pistas: uno descansa cada ronda
  e = iniciarRonda(e);
  const descansa = e.rondas[0].descansanIds[0];
  assert.ok(!jugadorEnPistaAhora(e, descansa));
  e = quitarJugador(e, descansa);
  assert.equal(e.jugadores.length, 8);
  assert.ok(!enPartidos(e, descansa));
  assert.ok(!e.rondas.some((r) => r.descansanIds.includes(descansa)));
  sinRepetidosPorRonda(e);
  for (const r of e.rondas.slice(1)) assert.equal(r.partidos.length, 2, `ronda ${r.numero} con las 2 pistas`);
});

test("individual: el que ya jugó no figura como sin jugar, el que está en pista sí está en pista", () => {
  let e = iniciarRonda(evento(8));
  const p = e.rondas[0].partidos[0];
  e = cargarResultado(e, p.id, { puntosA: 14, puntosB: 10 });
  assert.ok(!jugadorSinJugar(e, p.parejaA.jugadorIds[0]));
  assert.ok(jugadorEnPistaAhora(e, e.rondas[0].partidos[1].parejaA.jugadorIds[0]));
});

test("mixto: cambiar a una jugadora mantiene el mixto parejo", () => {
  const e0 = iniciarRonda(evento(8, true));
  const sale = e0.jugadores.find((j) => j.genero === "F")!.id;
  const e = cambiarJugador(e0, sale, jug("ana", "F", "Ana"));
  for (const r of e.rondas)
    for (const p of r.partidos)
      for (const par of [p.parejaA, p.parejaB]) {
        const gs = par.jugadorIds.map((id) => e.jugadores.find((j) => j.id === id)!.genero).sort().join("");
        assert.equal(gs, "FM", `ronda ${r.numero}: pareja ${par.nombre} es mixta`);
      }
  sinRepetidosPorRonda(e);
});
