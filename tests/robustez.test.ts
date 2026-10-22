import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  agregarJugador,
  avanzarRonda,
  borrarResultado,
  cargarResultado,
  crearEvento,
  eliminarEvento,
  fusionarEventos,
  iniciarRonda,
  primeraRondaEditable,
  retirarJugador,
  retirarPareja,
} from "../lib/evento.ts";
import { metricasRotacion, partidosPorRonda } from "../lib/rotation.ts";
import { calcularTabla, validarResultado } from "../lib/scoring.ts";
import { validarClub, validarEvento } from "../lib/validacion.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";
import type { EventoAmericano, Jugador, Pareja } from "../types/americano.ts";

const jugadores = (n: number, mixto = false): Jugador[] =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, genero: mixto ? (i % 2 ? "F" : "M") : "M", rating: 1 + (i % 6) }));

const base = (n = 8, extra: Partial<Parameters<typeof crearEvento>[0]> = {}) =>
  crearEvento({
    nombre: "Test",
    categoria: { rama: "MASCULINO", nivel: "5TA" },
    modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 },
    pistas: 2,
    duracionRondaMin: 15,
    totalRondas: 6,
    jugadores: jugadores(n),
    semilla: 11,
    ...extra,
  });

const espera = () => new Promise((r) => setTimeout(r, 3));

/* ---------- dos dispositivos ---------- */

test("dos dispositivos cargan pistas distintas a la vez: se conservan ambos marcadores", async () => {
  const e0 = iniciarRonda(base());
  const [p1, p2] = e0.rondas[0].partidos;
  const celA = cargarResultado(e0, p1.id, { puntosA: 14, puntosB: 10 });
  await espera();
  const celB = cargarResultado(e0, p2.id, { puntosA: 8, puntosB: 16 });
  for (const f of [fusionarEventos(celA, celB), fusionarEventos(celB, celA)]) {
    const ps = f.rondas[0].partidos;
    assert.equal(ps.find((p) => p.id === p1.id)!.resultado!.puntosA, 14);
    assert.equal(ps.find((p) => p.id === p2.id)!.resultado!.puntosB, 16);
  }
});

test("dos dispositivos corrigen el mismo partido: gana la última corrección", async () => {
  const e0 = iniciarRonda(base());
  const p = e0.rondas[0].partidos[0];
  const a = cargarResultado(e0, p.id, { puntosA: 13, puntosB: 11 });
  await espera();
  const b = cargarResultado(e0, p.id, { puntosA: 11, puntosB: 13 });
  assert.equal(fusionarEventos(a, b).rondas[0].partidos[0].resultado!.puntosA, 11);
  assert.equal(fusionarEventos(b, a).rondas[0].partidos[0].resultado!.puntosA, 11);
});

test("borrar un resultado también se propaga (no revive con la copia vieja)", async () => {
  const e0 = iniciarRonda(base());
  const p = e0.rondas[0].partidos[0];
  const conRes = cargarResultado(e0, p.id, { puntosA: 13, puntosB: 11 });
  await espera();
  const borrado = borrarResultado(conRes, p.id);
  assert.equal(fusionarEventos(conRes, borrado).rondas[0].partidos[0].resultado, null);
});

test("un marcador cargado offline sobrevive a que otro dispositivo avance la ronda", async () => {
  const e0 = iniciarRonda(base());
  const p = e0.rondas[0].partidos[1];
  const offline = cargarResultado(e0, p.id, { puntosA: 20, puntosB: 4 });
  await espera();
  const otro = avanzarRonda(cargarResultado(e0, e0.rondas[0].partidos[0].id, { puntosA: 12, puntosB: 12 }));
  const f = fusionarEventos(offline, otro);
  assert.equal(f.rondaActual, 2);
  assert.equal(f.rondas[0].partidos[1].resultado!.puntosA, 20);
  assert.equal(f.rondas[0].partidos[0].resultado!.puntosA, 12);
});

test("un evento eliminado no revive aunque otro dispositivo lo edite después", async () => {
  const e0 = base();
  const borrado = eliminarEvento(e0);
  await espera();
  const editado = cargarResultado(e0, e0.rondas[0].partidos[0].id, { puntosA: 12, puntosB: 12 });
  assert.equal(fusionarEventos(borrado, editado).eliminado, true);
});

/* ---------- plantel a mitad del evento ---------- */

test("retirar un jugador: no aparece en rondas futuras y lo jugado queda intacto", () => {
  let e = iniciarRonda(base(9));
  for (const p of e.rondas[0].partidos) e = cargarResultado(e, p.id, { puntosA: 14, puntosB: 10 });
  const r1Antes = JSON.stringify(e.rondas[0]);
  const jugo = e.rondas[0].partidos[0].parejaA.jugadorIds[0];
  e = retirarJugador(e, jugo);
  assert.equal(JSON.stringify(e.rondas[0]), r1Antes);
  for (const r of e.rondas.slice(1)) for (const p of r.partidos) assert.ok(![...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes(jugo));
  assert.ok(!e.rondas.slice(1).some((r) => r.descansanIds.includes(jugo)));
  const fila = calcularTabla(e).filas.find((f) => f.entidadId === jugo)!;
  assert.equal(fila.pj, 1);
  assert.equal(fila.retirado, true);
  assert.equal(e.rondas.length, e.totalRondas);
});

test("retirar antes de empezar la ronda actual re-sortea también esa ronda", () => {
  const e = base(9);
  assert.equal(primeraRondaEditable(e), 1);
  const r = retirarJugador(e, "j1");
  assert.ok(r.rondas.every((x) => x.partidos.every((p) => ![...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes("j1"))));
});

test("jugador que llega tarde: entra desde la próxima ronda sin acaparar partidos", () => {
  let e = iniciarRonda(base(8, { totalRondas: 7 }));
  for (const r of [0, 1, 2]) {
    for (const p of e.rondas[r].partidos) e = cargarResultado(e, p.id, { puntosA: 12, puntosB: 12 });
    e = avanzarRonda(e);
  }
  e = agregarJugador(e, { id: "tarde", nombre: "Tarde", genero: "M", rating: 3 });
  const futuras = e.rondas.filter((r) => r.numero >= 4);
  const juegaTarde = futuras.filter((r) => r.partidos.some((p) => [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes("tarde"))).length;
  assert.ok(juegaTarde >= 2 && juegaTarde <= 4, `jugó ${juegaTarde}`);
  assert.ok(e.rondas.slice(0, 3).every((r) => r.partidos.every((p) => ![...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes("tarde"))));
  // los ids de partidos re-sorteados son nuevos: no se confunden con el cuadro anterior al fusionar
  assert.ok(futuras[0].partidos[0].id.startsWith("r4-p1-"));
});

test("re-sorteo evita repetir compañeros ya jugados", () => {
  let e = iniciarRonda(base(12, { pistas: 3, totalRondas: 8 }));
  for (const r of [0, 1, 2]) e = avanzarRonda(e);
  e = retirarJugador(e, "j5");
  assert.equal(metricasRotacion(e.rondas).companerosRepetidos, 0);
});

test("dupla fija: retirar pareja la saca de rondas futuras", () => {
  const parejas: Pareja[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, jugadorIds: [`j${2 * i + 1}`, `j${2 * i + 2}`] }));
  let e = crearEvento({
    nombre: "D", categoria: { rama: "MASCULINO", nivel: "4TA" }, modalidad: "DUPLA_FIJA", puntuacion: { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6 },
    pistas: 3, duracionRondaMin: 20, totalRondas: 5, jugadores: jugadores(12), parejas, semilla: 4,
  });
  e = avanzarRonda(iniciarRonda(e));
  e = retirarPareja(e, "p2");
  for (const r of e.rondas.slice(1)) for (const p of r.partidos) assert.ok(p.parejaA.id !== "p2" && p.parejaB.id !== "p2");
  // con 5 parejas y 3 pistas solo caben 2 partidos por ronda
  assert.ok(e.rondas.slice(1).every((r) => r.partidos.length === 2));
});

/* ---------- cantidades raras ---------- */

test("cantidades de jugadores raras no rompen el sorteo", () => {
  for (const n of [4, 5, 6, 7, 9, 11, 13, 17, 23, 25]) {
    const e = base(n, { pistas: 6, totalRondas: 5 });
    const esperados = Math.min(6, Math.floor(n / 4));
    assert.ok(e.rondas.every((r) => r.partidos.length === esperados), `n=${n}`);
    assert.ok(e.rondas.every((r) => r.descansanIds.length === n - esperados * 4), `n=${n}`);
    const m = metricasRotacion(e.rondas);
    assert.ok(m.maxPartidos - m.minPartidos <= 1, `n=${n}: ${JSON.stringify(m)}`);
  }
});

test("mixto desbalanceado (3 hombres, 9 mujeres): parejas siempre mixtas", () => {
  const js: Jugador[] = [...jugadores(3).map((j) => ({ ...j, genero: "M" as const })), ...Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, nombre: `F${i}`, genero: "F" as const }))];
  assert.equal(partidosPorRonda(js, 3, true), 1);
  const e = crearEvento({ nombre: "M", categoria: { rama: "MIXTO", nivel: "6TA" }, modalidad: "INDIVIDUAL_ROTATIVO", puntuacion: { metodo: "PUNTOS_TOTALES" }, pistas: 3, duracionRondaMin: 15, totalRondas: 4, jugadores: js });
  const g = new Map(js.map((j) => [j.id, j.genero]));
  for (const r of e.rondas) for (const p of r.partidos) for (const par of [p.parejaA, p.parejaB]) assert.notEqual(g.get(par.jugadorIds[0]), g.get(par.jugadorIds[1]));
});

test("menos de 4 jugadores: no genera partidos (el setup lo bloquea)", () => {
  assert.equal(base(3).rondas.length, 0);
});

/* ---------- marcadores inválidos ---------- */

test("marcadores imposibles se rechazan con mensaje claro", () => {
  const pt = { metodo: "PUNTOS_TOTALES" as const, puntosPorPartido: 24 };
  assert.ok(validarResultado(pt, { puntosA: 0, puntosB: 0 }));
  assert.ok(validarResultado(pt, { puntosA: -1, puntosB: 5 }));
  assert.ok(validarResultado(pt, { puntosA: 1.5, puntosB: 5 }));
  assert.ok(validarResultado(pt, { puntosA: 30, puntosB: 0 }));
  assert.equal(validarResultado(pt, { puntosA: 10, puntosB: 9 }), null); // se acabó el tiempo
  const g = { metodo: "GAMES_PUNTO_ORO" as const, gamesPorPartido: 6 };
  assert.ok(validarResultado(g, { puntosA: 6, puntosB: 6 }));
  assert.ok(validarResultado(g, { puntosA: 7, puntosB: 2 }));
  assert.equal(validarResultado(g, { puntosA: 4, puntosB: 4 }), null); // empate por tiempo
  const s = { metodo: "SETS_CORTOS" as const, gamesPorPartido: 4, setsMaximos: 3 };
  assert.ok(validarResultado(s, { puntosA: 0, puntosB: 0, sets: [] }));
  assert.ok(validarResultado(s, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 4 }] }));
  assert.ok(validarResultado(s, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 1 }, { a: 4, b: 2 }, { a: 4, b: 0 }] }));
  assert.ok(validarResultado({ ...s, setsMaximos: 1 }, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 1 }, { a: 1, b: 4 }] }));
});

/* ---------- validación de API ---------- */

test("los eventos de mockData.json pasan la validación de la API", () => {
  const mock = JSON.parse(readFileSync(new URL("../data/mockData.json", import.meta.url), "utf8")) as { eventos: EventoAmericano[] };
  for (const e of mock.eventos) assert.deepEqual(validarEvento(e), [], e.nombre);
});

test("la API rechaza payloads basura o manipulados", () => {
  const e = base();
  assert.ok(validarEvento(null).length);
  assert.ok(validarEvento("hola").length);
  assert.ok(validarEvento({ ...e, id: "../../etc" }).length);
  assert.ok(validarEvento({ ...e, pistas: 9 }).length);
  assert.ok(validarEvento({ ...e, horaInicio: "25:00" }).length);
  assert.ok(validarEvento({ ...e, jugadores: [...e.jugadores, e.jugadores[0]] }).length);
  const malo = structuredClone(e);
  malo.rondas[0].partidos[0].parejaA.jugadorIds = ["fantasma", "j1"];
  assert.ok(validarEvento(malo).length);
  const imposible = cargarResultado(e, e.rondas[0].partidos[0].id, { puntosA: 40, puntosB: 0 });
  assert.ok(validarEvento(imposible).some((m) => m.includes("24")));
  assert.deepEqual(validarEvento(e), []);
});

test("validación de club", () => {
  assert.deepEqual(validarClub(CLUB_POR_DEFECTO), []);
  assert.ok(validarClub({ ...CLUB_POR_DEFECTO, dias: CLUB_POR_DEFECTO.dias.slice(0, 6) }).length);
  assert.ok(validarClub({ ...CLUB_POR_DEFECTO, dias: CLUB_POR_DEFECTO.dias.map((d) => ({ ...d, cierre: "06:00" })) }).length);
});

test("reloj del dispositivo atrasado: igual cada edición gana a la versión anterior", () => {
  const futuro = { ...base(), actualizadoEn: "2099-01-01T00:00:00.000Z" } as EventoAmericano;
  const editado = cargarResultado(futuro, futuro.rondas[0].partidos[0].id, { puntosA: 13, puntosB: 11 });
  assert.ok(editado.actualizadoEn > futuro.actualizadoEn);
  assert.equal(fusionarEventos(futuro, editado).rondas[0].partidos[0].resultado!.puntosA, 13);
  const avanzado = avanzarRonda(editado);
  assert.equal(fusionarEventos(editado, avanzado).rondaActual, 2);
});

test("criterios de ranking del rotativo", () => {
  let e = base(8, { totalRondas: 1 });
  const [p1] = e.rondas[0].partidos;
  e = cargarResultado(e, p1.id, { puntosA: 15, puntosB: 9 });
  const pts = (criterio: "PUNTOS_A_FAVOR" | "SOLO_GANADOS" | "VICTORIAS") => {
    const t = calcularTabla({ ...e, puntuacion: { ...e.puntuacion, criterio } });
    const fila = (id: string) => t.filas.find((f) => f.entidadId === id)!.puntos;
    return [fila(p1.parejaA.jugadorIds[0]), fila(p1.parejaB.jugadorIds[0])];
  };
  assert.deepEqual(pts("PUNTOS_A_FAVOR"), [15, 9]); // ganador y perdedor suman lo suyo
  assert.deepEqual(pts("SOLO_GANADOS"), [15, 0]); // el perdedor no suma
  assert.deepEqual(pts("VICTORIAS"), [3, 0]);
});
