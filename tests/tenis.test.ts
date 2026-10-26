/** Tenis: marcador ITF (juegos, sets, tie-break, súper tie-break, saque y cambios de lado) y cuadros. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATOS, analizar, anotar, aviso, calcular, canto, deshacer, falta, nuevoMarcador, textoPuntos, textoSet } from "../lib/tenis/marcador.ts";
import { actualizarPartido, cerrarPartido, crearTorneoTenis, fusionarTenis, leerLista, lineasSiembra, tablaLiga } from "../lib/tenis/torneo.ts";
import type { Lado, MarcadorTenis, ReglasTenis } from "../types/tenis.ts";

const A = ["a1"];
const clasico = FORMATOS.CLASICO.reglas;

function jugar(m: MarcadorTenis, secuencia: string): MarcadorTenis {
  for (const c of secuencia) m = anotar(m, (c === "a" ? 0 : 1) as Lado);
  return m;
}
const juego = (g: "a" | "b") => g.repeat(4);
const nuevo = (orden = ["a1", "b1"]) => nuevoMarcador(orden, "IZQ", null);

test("un juego: 15, 30, 40 y juego", () => {
  let m = jugar(nuevo(), "aa");
  let e = calcular(m, clasico, A);
  assert.deepEqual(textoPuntos(e, clasico), ["30", "0"]);
  assert.equal(canto(e, clasico), "30-cero");
  m = jugar(m, "aa");
  e = calcular(m, clasico, A);
  assert.deepEqual(e.juegos, [1, 0]);
  assert.equal(e.equipoSaca, 1, "el saque pasa al otro");
  assert.equal(e.cambioDeLado, true, "cambio tras el primer juego");
  assert.equal(e.descanso, 0, "sin descanso tras el primer juego del set");
});

test("iguales y ventaja; sin ventaja el punto decisivo cierra el juego", () => {
  const m = jugar(nuevo(), "aaabbb");
  let e = calcular(m, clasico, A);
  assert.deepEqual(textoPuntos(e, clasico), ["40", "40"]);
  assert.equal(canto(e, clasico), "Iguales");
  e = calcular(jugar(m, "a"), clasico, A);
  assert.deepEqual(textoPuntos(e, clasico), ["AD", ""]);
  e = calcular(jugar(m, "ab"), clasico, A);
  assert.deepEqual(e.juegos, [0, 0]);
  const sinVentaja: ReglasTenis = { ...clasico, ventaja: false };
  assert.equal(aviso(calcular(m, sinVentaja, A), m, sinVentaja, A)?.tipo, "PUNTO_DE_QUIEBRE");
  e = calcular(jugar(m, "b"), sinVentaja, A);
  assert.deepEqual(e.juegos, [0, 1], "el decisivo lo gana el que resta");
});

test("set 6-4 con descanso de 120 s y cambio al primer juego del set siguiente", () => {
  // A gana sus juegos de saque, B los suyos, y A quiebra dos veces: 6-4.
  let m = nuevo();
  const orden = ["a", "b", "a", "b", "a", "b", "a", "b", "a", "a"]; // juegos 1..10, el 10 lo gana A sacando B
  for (const g of orden) m = jugar(m, juego(g as "a" | "b"));
  const e = calcular(m, clasico, A);
  assert.equal(e.sets.length, 1);
  assert.deepEqual([e.sets[0].a, e.sets[0].b], [6, 4]);
  assert.equal(e.descanso, 120);
  assert.equal(e.cambioDeLado, false, "10 juegos: no se cambia al terminar el set");
  const e2 = calcular(jugar(m, juego("a")), clasico, A);
  assert.equal(e2.cambioDeLado, true, "se cambia tras el primer juego del set 2");
  assert.equal(e2.descanso, 0);
});

test("tie-break a 7: saque 1 y luego 2, cambio cada 6 puntos, 7-6 y el siguiente set lo abre el otro", () => {
  let m = nuevo();
  for (let i = 0; i < 12; i++) m = jugar(m, juego(i % 2 ? "b" : "a"));
  let e = calcular(m, clasico, A);
  assert.deepEqual(e.juegos, [6, 6]);
  assert.equal(e.enTieBreak, true);
  assert.equal(e.equipoSaca, 0, "juego 13: saca A");
  m = jugar(m, "a");
  e = calcular(m, clasico, A);
  assert.equal(e.equipoSaca, 1, "tras el primer punto saca B");
  m = jugar(m, "b");
  assert.equal(calcular(m, clasico, A).equipoSaca, 1, "B saca dos");
  m = jugar(m, "aaab");
  e = calcular(m, clasico, A);
  assert.equal(e.cambioDeLado, true, "cambio a los 6 puntos");
  assert.deepEqual(textoPuntos(e, clasico), ["4", "2"]);
  m = jugar(m, "aaa");
  e = calcular(m, clasico, A);
  assert.equal(e.sets[0].a, 7);
  assert.deepEqual(e.sets[0].tb, [7, 2]);
  assert.equal(textoSet(e.sets[0]), "7-6(2)");
  assert.equal(e.equipoSaca, 1, "quien sacó primero en el tie-break resta en el set siguiente");
  assert.equal(e.cambioDeLado, true, "13 juegos: se cambia al terminar el set");
});

test("súper tie-break a 10 en lugar del tercer set", () => {
  const r = FORMATOS.SUPER_TB.reglas;
  let m = nuevo();
  for (let i = 0; i < 6; i++) m = jugar(m, juego("a"));
  for (let i = 0; i < 6; i++) m = jugar(m, juego("b"));
  let e = calcular(m, r, A);
  assert.deepEqual(e.setsGanados, [1, 1]);
  assert.equal(e.superTieBreak, true);
  assert.equal(e.objetivoTieBreak, 10);
  m = jugar(m, "aaaaaaaaab");
  e = calcular(m, r, A);
  assert.equal(e.ganador, null, "9-1 todavía no");
  assert.equal(aviso(e, m, r, A)?.tipo, "PUNTO_DE_PARTIDO");
  m = jugar(m, "a");
  e = calcular(m, r, A);
  assert.equal(e.ganador, 0);
  assert.equal(textoSet(e.sets[2], true), "[10-1]");
});

test("dobles: rota el saque entre los cuatro", () => {
  const orden = ["a1", "b1", "a2", "b2"];
  let m = nuevo(orden);
  const sacadores: string[] = [];
  for (let i = 0; i < 5; i++) {
    sacadores.push(orden[calcular(m, clasico, ["a1", "a2"]).turnoSaque]);
    m = jugar(m, juego("a"));
  }
  assert.deepEqual(sacadores, ["a1", "b1", "a2", "b2", "a1"]);
});

test("faltas, doble falta, deshacer y estadísticas", () => {
  let m = nuevo();
  m = falta(m, 0);
  assert.equal(m.falta, true);
  m = falta(m, 0);
  assert.equal(m.puntos[0].tipo, "DOBLE_FALTA");
  assert.equal(m.puntos[0].g, 1);
  m = deshacer(m);
  assert.equal(m.puntos.length, 0);
  assert.equal(m.falta, true, "deshacer la doble falta vuelve al segundo saque");
  m = anotar(m, 0);
  m = anotar(m, 0, "ACE");
  m = jugar(m, "aa");
  const a = analizar(m, clasico, A);
  assert.equal(a.stats[0].aces, 1);
  assert.equal(a.stats[0].segundos, 1);
  assert.equal(a.stats[0].ganadosPrimero, 3);
  assert.equal(a.stats[0].juegosSaqueGanados, 1);
  assert.deepEqual(a.impulso, [1, 2, 3, 4]);
});

test("quiebres en las estadísticas", () => {
  let m = jugar(nuevo(), "bbbb"); // B quiebra a A en cero
  const a = analizar(m, clasico, A);
  assert.equal(a.stats[1].quiebresOportunidad, 1);
  assert.equal(a.stats[1].quiebresGanados, 1);
  assert.equal(a.quiebres.length, 1);
  m = jugar(m, "aaa"); // saca B y A tiene 0-40
  assert.deepEqual(aviso(calcular(m, clasico, A), m, clasico, A), { tipo: "PUNTO_DE_QUIEBRE", para: 0 });
});

test("cuadro de 6 con 2 cabezas de serie: byes a los sembrados y el ganador avanza", () => {
  assert.deepEqual(lineasSiembra(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const { inscritos, errores } = leerLista("(1) Ana Pérez\n(2) Bea Ruiz\nCarla Gil\nDani Sosa\nEva Luna\nFabi Mar", "SINGLES");
  assert.deepEqual(errores, []);
  let t = crearTorneoTenis({ nombre: "Copa", superficie: "ARCILLA", modalidad: "SINGLES", rama: "FEMENINO", categoria: "Open", reglas: clasico, formato: "ELIMINACION", fecha: "2026-11-01", canchas: 2, inscritos, semilla: 7 });
  const r1 = t.partidos.filter((p) => p.ronda === 1);
  assert.equal(r1.length, 4);
  const byes = r1.filter((p) => p.resultado?.tipo === "BYE");
  assert.equal(byes.length, 2);
  const sembrados = inscritos.filter((i) => i.siembra).map((i) => i.id);
  for (const p of byes) assert.ok(sembrados.includes((p.a ?? p.b)!));
  // Semifinal 1 ya tiene a la cabeza 1 esperando.
  const sf = t.partidos.find((p) => p.ronda === 2 && p.orden === 0)!;
  assert.equal(sf.a, sembrados[0]);
  const real = r1.find((p) => p.a && p.b)!;
  t = cerrarPartido(t, real.id, 1, "WO");
  const sf2 = t.partidos.find((p) => p.ronda === 2 && (p.a === real.b || p.b === real.b));
  assert.ok(sf2, "el ganador por W.O. pasa a semis");
  assert.equal(t.estado, "EN_JUEGO");
});

test("partido único terminado con marcador y fusión por partido", () => {
  const { inscritos } = leerLista("Ana / Bea\nCarla / Dani", "DOBLES");
  const t0 = crearTorneoTenis({ nombre: "Amistoso", superficie: "DURA", modalidad: "DOBLES", rama: "FEMENINO", categoria: "Open", reglas: FORMATOS.PRO_SET.reglas, formato: "PARTIDO", fecha: "2026-11-01", canchas: 1, inscritos });
  const p = t0.partidos[0];
  const [a1, a2] = inscritos[0].jugadores.map((j) => j.id);
  const [b1, b2] = inscritos[1].jugadores.map((j) => j.id);
  let m = nuevoMarcador([a1, b1, a2, b2], "IZQ", null);
  for (let i = 0; i < 8; i++) m = jugar(m, juego("a"));
  const t1 = actualizarPartido(t0, p.id, (x) => ({ ...x, estado: "EN_JUEGO", marcador: m }));
  assert.equal(t1.partidos[0].resultado?.ganador, 0);
  assert.equal(t1.estado, "FINALIZADO");
  // Otra versión cambió el nombre más tarde: se queda con el nombre nuevo y el partido nuevo.
  const t2 = { ...t0, nombre: "Amistoso del sábado", actualizadoEn: new Date(Date.now() + 1000).toISOString() };
  const f = fusionarTenis(t1, t2);
  assert.equal(f.nombre, "Amistoso del sábado");
  assert.equal(f.partidos[0].resultado?.ganador, 0);
});

test("liga de 4: 6 partidos y tabla", () => {
  const { inscritos } = leerLista("Ana\nBea\nCarla\nDani", "SINGLES");
  let t = crearTorneoTenis({ nombre: "Liga", superficie: "DURA", modalidad: "SINGLES", rama: "FEMENINO", categoria: "2da", reglas: clasico, formato: "LIGA", fecha: "2026-11-01", canchas: 2, inscritos, semilla: 3 });
  assert.equal(t.partidos.length, 6);
  for (const p of t.partidos) t = cerrarPartido(t, p.id, p.a === inscritos[0].id || p.b === inscritos[0].id ? (p.a === inscritos[0].id ? 0 : 1) : 0, "WO");
  assert.equal(tablaLiga(t)[0].id, inscritos[0].id);
  assert.equal(tablaLiga(t)[0].pg, 3);
  assert.equal(t.estado, "FINALIZADO");
});

test("ranking por superficie junta torneos por nombre y detecta al especialista", async () => {
  const { fichasJugadores, ordenar, especialidad } = await import("../lib/tenis/jugadores.ts");
  const torneos = [];
  for (const [sup, ganaAna] of [["ARCILLA", true], ["ARCILLA", true], ["ARCILLA", true], ["DURA", false], ["DURA", false]] as const) {
    const { inscritos } = leerLista(sup === "ARCILLA" ? "Ána López\nBea Ruiz" : "ana lópez\nBea Ruiz", "SINGLES");
    let t = crearTorneoTenis({ nombre: "x", superficie: sup, modalidad: "SINGLES", rama: "FEMENINO", categoria: "Open", reglas: clasico, formato: "PARTIDO", fecha: "2026-11-01", canchas: 1, inscritos });
    const p = t.partidos[0];
    const ana = p.a === inscritos[0].id ? 0 : 1;
    t = cerrarPartido(t, p.id, (ganaAna ? ana : 1 - ana) as Lado, "WO");
    torneos.push(t);
  }
  const fichas = fichasJugadores(torneos);
  assert.equal(fichas.length, 2, "Ána López y ana lópez son la misma");
  const ana = fichas.find((f) => f.nombre.toLowerCase().includes("l"))!;
  assert.deepEqual(ana.por.ARCILLA, { pj: 3, pg: 3 });
  assert.deepEqual(ana.por.DURA, { pj: 2, pg: 0 });
  assert.equal(especialidad(ana), "ARCILLA");
  assert.equal(ordenar(fichas, "DURA")[0].nombre, "Bea Ruiz");
});

test("datos de prueba de tenis: torneos en juego con partidos en vivo", async () => {
  const { torneosDemoTenis } = await import("../lib/tenis/demo.ts");
  const [dura, arcilla, amistoso] = torneosDemoTenis("demo-x-", "2026-11-01");
  assert.ok(dura.id.startsWith("demo-x-"));
  assert.equal(dura.partidos.filter((p) => p.ronda === 1 && p.resultado).length, 4);
  assert.equal(dura.partidos.filter((p) => p.estado === "EN_JUEGO").length, 1);
  assert.equal(dura.estado, "EN_JUEGO");
  assert.equal(arcilla.partidos.filter((p) => p.estado === "EN_JUEGO").length, 1);
  assert.equal(amistoso.estado, "FINALIZADO");
});
