/** Mesa técnica: resultados por revisar, correcciones con motivo, avisos de horario y los 7 pasos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarAccion } from "../lib/torneo/arbitraje.ts";
import { CONFIG_CUADRO_BASE, catNivel } from "../lib/torneo/categorias.ts";
import { crearTorneo, efectoCorreccion, inscribirDupla, marcarCambiosHorario, moverPartido, publicarCategoria, sortearCategoria } from "../lib/torneo/torneo.ts";
import { programarTorneo } from "../lib/torneo/programacion.ts";
import { pasosTorneo } from "../lib/torneo/pasos.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";
import type { JugadorTorneo, ResultadoTorneo, Torneo } from "../types/torneo.ts";

const jug = (id: string): JugadorTorneo => ({ id, nombre: id, apellido: id.toUpperCase(), genero: "M" });
const cid = "M-4TA";

/** 4 duplas en eliminación directa: dos semis y la final. */
function base(publicar = true): Torneo {
  let t = crearTorneo({ nombre: "Copa", dias: [{ fecha: "2026-12-05", inicio: "08:00", fin: "22:00" }], canchas: CLUB_POR_DEFECTO.pistas, categorias: [catNivel("MASCULINO", "4TA")] });
  for (let i = 1; i <= 4; i++) t = inscribirDupla(t, cid, jug(`a${i}`), jug(`b${i}`), { id: `d${i}`, puntos: 1000 - i });
  t = sortearCategoria(t, cid, { semilla: 3, por: "Staff", config: { ...CONFIG_CUADRO_BASE, formato: "ELIMINACION" } });
  if (!publicar) return t;
  t = publicarCategoria(t, cid, "Staff");
  return programarTorneo(t).torneo;
}
const partidos = (t: Torneo) => t.categorias[0].cuadro!.partidos;
const p = (t: Torneo, id: string) => partidos(t).find((x) => x.id === id)!;
const semis = (t: Torneo) => partidos(t).filter((x) => x.duplaA && x.duplaB && x.ronda === 1);
const final = (t: Torneo) => partidos(t).find((x) => x.ronda === 2 && !x.tercerPuesto)!;
const gana = (g: "A" | "B"): ResultadoTorneo => ({ sets: g === "A" ? [{ a: 6, b: 3 }, { a: 6, b: 4 }] : [{ a: 3, b: 6 }, { a: 4, b: 6 }], ganador: g, tipo: "NORMAL" });

test("el resultado del árbitro de pista cuenta al instante y llega a mesa técnica por revisar", () => {
  let t = base();
  const [s1] = semis(t);
  t = aplicarAccion(t, s1.id, { accion: "resultado", resultado: gana("A") }, "Árbitro José", "PISTA");
  assert.equal(p(t, s1.id).estado, "FINALIZADO");
  assert.equal(p(t, s1.id).revision?.estado, "POR_REVISAR");
  assert.equal(p(t, s1.id).revision?.cargadoPor, "Árbitro José");
  // La llave ya avanzó: la final conoce a un finalista.
  assert.ok(final(t).duplaA || final(t).duplaB);
  t = aplicarAccion(t, s1.id, { accion: "revisar" }, "Árbitro principal Carla", "MESA");
  assert.equal(p(t, s1.id).revision?.estado, "VISTO");
  assert.equal(p(t, s1.id).revision?.por, "Árbitro principal Carla");
  assert.equal(p(t, s1.id).revision?.cargadoPor, "Árbitro José");
});

test("lo que carga mesa técnica o el staff entra ya revisado", () => {
  let t = base();
  const [s1] = semis(t);
  t = aplicarAccion(t, s1.id, { accion: "wo", ganador: "B" }, "Staff", "MESA");
  assert.equal(p(t, s1.id).revision?.estado, "VISTO");
});

test("corregir deja quién, cuándo, antes, después y el motivo", () => {
  let t = base();
  const [s1] = semis(t);
  t = aplicarAccion(t, s1.id, { accion: "resultado", resultado: gana("A") }, "Árbitro José", "PISTA");
  const corregido: ResultadoTorneo = { sets: [{ a: 6, b: 3 }, { a: 7, b: 5 }], ganador: "A", tipo: "NORMAL" };
  assert.deepEqual(efectoCorreccion(t, s1.id, corregido), []);
  t = aplicarAccion(t, s1.id, { accion: "corregir", resultado: corregido, motivo: "Segundo set mal anotado" }, "Árbitro principal Carla", "MESA");
  const x = p(t, s1.id);
  assert.equal(x.resultado?.sets[1].a, 7);
  assert.equal(x.revision?.estado, "VISTO");
  assert.equal(x.revision?.correcciones?.length, 1);
  assert.deepEqual({ ...x.revision!.correcciones![0], en: "" }, { en: "", por: "Árbitro principal Carla", antes: "6-3 6-4", despues: "6-3 7-5", motivo: "Segundo set mal anotado" });
  assert.match(t.historial!.at(-1)!.texto, /Corrección en .*6-3 6-4 → 6-3 7-5\. Motivo: Segundo set mal anotado/);
});

test("si la corrección cambia quién avanza, avisa y anula el partido siguiente ya jugado", () => {
  let t = base();
  const [s1, s2] = semis(t);
  t = aplicarAccion(t, s1.id, { accion: "resultado", resultado: gana("A") }, "Árbitro José", "PISTA");
  t = aplicarAccion(t, s2.id, { accion: "resultado", resultado: gana("A") }, "Árbitro Ana", "PISTA");
  const f = final(t);
  assert.ok(f.duplaA && f.duplaB);
  t = aplicarAccion(t, f.id, { accion: "resultado", resultado: gana("B") }, "Árbitro Ana", "PISTA");
  const anula = efectoCorreccion(t, s1.id, gana("B"));
  assert.deepEqual(anula.map((x) => x.id), [f.id]);
  t = aplicarAccion(t, s1.id, { accion: "corregir", resultado: gana("B"), motivo: "Invirtió las duplas" }, "Staff", "MESA");
  assert.equal(p(t, f.id).estado, "PENDIENTE");
  assert.equal(p(t, f.id).resultado ?? null, null);
});

test("un partido publicado que cambia de hora queda marcado para avisar; si vuelve, se desmarca", () => {
  const t0 = base();
  const [s1] = semis(t0);
  const orig = s1.programacion!;
  const t1 = marcarCambiosHorario(t0, moverPartido(t0, s1.id, { fecha: orig.fecha, hora: "20:00", pista: orig.pista }));
  assert.deepEqual(p(t1, s1.id).cambioHorario?.antes, { fecha: orig.fecha, hora: orig.hora, pista: orig.pista });
  // Un segundo cambio conserva la hora original que conocían los jugadores.
  const t2 = marcarCambiosHorario(t1, moverPartido(t1, s1.id, { fecha: orig.fecha, hora: "21:00", pista: orig.pista }));
  assert.equal(p(t2, s1.id).cambioHorario?.antes.hora, orig.hora);
  const t3 = marcarCambiosHorario(t2, moverPartido(t2, s1.id, { fecha: orig.fecha, hora: orig.hora, pista: orig.pista }));
  assert.equal(p(t3, s1.id).cambioHorario ?? null, null);
  // Antes de publicar no se avisa nada.
  const sin = base(false);
  const movido = marcarCambiosHorario(sin, moverPartido(sin, semis(sin)[0].id, { fecha: "2026-12-05", hora: "20:00", pista: 1 }));
  assert.equal(p(movido, semis(sin)[0].id).cambioHorario ?? null, null);
});

test("los 7 pasos avanzan en orden y explican qué falta", () => {
  let t = crearTorneo({ nombre: "Copa", dias: [{ fecha: "2026-12-05", inicio: "08:00", fin: "22:00" }], canchas: CLUB_POR_DEFECTO.pistas, categorias: [catNivel("MASCULINO", "4TA")] });
  const actual = (x: Torneo) => pasosTorneo(x).find((s) => s.estado === "ACTUAL")!;
  assert.equal(actual(t).n, 2);
  assert.match(actual(t).aviso!, /menos de 2 duplas/);
  for (let i = 1; i <= 4; i++) t = inscribirDupla(t, cid, jug(`a${i}`), jug(`b${i}`), { id: `d${i}` });
  t = { ...t, validarFvp: false };
  assert.equal(actual(t).n, 3);
  t = { ...t, inscripcion: { abierta: true } as Torneo["inscripcion"] };
  assert.match(actual(t).aviso!, /inscripción online sigue abierta/);
  t = { ...t, inscripcion: null };
  t = sortearCategoria(t, cid, { semilla: 1, config: { ...CONFIG_CUADRO_BASE, formato: "ELIMINACION" } });
  assert.equal(actual(t).n, 4);
  t = programarTorneo(publicarCategoria(t, cid)).torneo;
  assert.equal(actual(t).n, 5);
  t = { ...t, arbitros: { turnos: [{ id: "t1", arbitroId: "a", fecha: "2026-12-05", pista: 1, desde: "08:00", hasta: "14:00" }] } };
  assert.equal(actual(t).n, 6);
  for (const s of semis(t)) t = aplicarAccion(t, s.id, { accion: "resultado", resultado: gana("A") }, "Árbitro", "PISTA");
  t = aplicarAccion(t, final(t).id, { accion: "resultado", resultado: gana("A") }, "Árbitro", "PISTA");
  // Todo jugado pero sin revisar: sigue en el día de juego.
  assert.equal(actual(t).n, 6);
  assert.match(actual(t).aviso!, /esperando revisión/);
  for (const x of partidos(t).filter((y) => !y.bye && y.estado === "FINALIZADO")) t = aplicarAccion(t, x.id, { accion: "revisar" }, "Mesa", "MESA");
  assert.equal(pasosTorneo(t).every((s) => s.estado === "HECHO"), true);
});
