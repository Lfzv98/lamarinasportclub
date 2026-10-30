import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avanzarRonda,
  canchasActivas,
  cargarResultado,
  crearEvento,
  fusionarEventos,
  iniciarRonda,
  partidosEnEspera,
  reactivarPista,
  retirarPareja,
  suspenderPista,
} from "../lib/evento.ts";
import { crearRng, metricasRotacion, planRondas } from "../lib/rotation.ts";
import { validarEvento } from "../lib/validacion.ts";
import type { EventoAmericano, Jugador, Pareja, Partido, PistaClub } from "../types/americano.ts";

const jugadores = (n: number, mixto = false): Jugador[] =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, genero: mixto ? (i % 2 ? "F" : "M") : "M", rating: 1 + (i % 6) }));

const canchas = (n: number): PistaClub[] => Array.from({ length: n }, (_, i) => ({ numero: i + 1, nombre: `Pista ${i + 1}`, techada: i < n - 1, activa: true }));

function duplaFija(nParejas: number, pistas: number, semilla = 7, totalRondas = planRondas(nParejas, "DUPLA_FIJA", pistas).rondas): EventoAmericano {
  const parejas: Pareja[] = Array.from({ length: nParejas }, (_, i) => ({ id: `p${i + 1}`, jugadorIds: [`j${2 * i + 1}`, `j${2 * i + 2}`] }));
  return crearEvento({
    nombre: "Lluvia dupla", categoria: { rama: "MASCULINO", nivel: "5TA" }, modalidad: "DUPLA_FIJA", puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16 },
    pistas, canchas: canchas(pistas), duracionRondaMin: 15, totalRondas, jugadores: jugadores(nParejas * 2), parejas, semilla,
  });
}

function individual(n: number, pistas: number, mixto = false, semilla = 7): EventoAmericano {
  const genero = mixto ? { hombres: Math.ceil(n / 2), mujeres: Math.floor(n / 2) } : undefined;
  return crearEvento({
    nombre: "Lluvia individual", categoria: { rama: mixto ? "MIXTO" : "MASCULINO", nivel: "5TA" }, modalidad: "INDIVIDUAL_ROTATIVO", puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16 },
    pistas, canchas: canchas(pistas), duracionRondaMin: 15, totalRondas: planRondas(n, "INDIVIDUAL_ROTATIVO", pistas, genero).rondas, jugadores: jugadores(n, mixto), semilla,
  });
}

const ronda = (e: EventoAmericano, n = e.rondaActual) => e.rondas.find((r) => r.numero === n)!;
const cruce = (p: Partido) => [p.parejaA.id, p.parejaB.id].sort().join(" vs ");
const enCancha = (p: Partido) => [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds];

function cargarTodo(e: EventoAmericano, n = e.rondaActual): EventoAmericano {
  for (const p of ronda(e, n).partidos) if (p.estado !== "FINALIZADO") e = cargarResultado(e, p.id, { puntosA: 9, puntosB: 7 });
  return e;
}

/** Lo que no puede pasar nunca, con o sin lluvia. */
function invariantes(e: EventoAmericano, msg = "") {
  assert.deepEqual(validarEvento(e), [], msg);
  const ids = new Set<string>();
  for (const r of e.rondas) {
    const usados = new Set<string>();
    const pistas = new Set<number>();
    for (const p of r.partidos) {
      assert.ok(!ids.has(p.id), `${msg} partido ${p.id} aparece dos veces`);
      ids.add(p.id);
      for (const j of enCancha(p)) {
        assert.ok(!usados.has(j), `${msg} ronda ${r.numero}: ${j} juega dos veces`);
        usados.add(j);
      }
      assert.ok(!pistas.has(p.pista), `${msg} ronda ${r.numero}: dos partidos en la pista ${p.pista}`);
      pistas.add(p.pista);
    }
    for (const id of r.descansanIds) assert.ok(!r.partidos.some((p) => p.parejaA.id === id || p.parejaB.id === id || enCancha(p).includes(id)), `${msg} ronda ${r.numero}: ${id} descansa y juega`);
  }
  // Nada pendiente cae en una pista suspendida (salvo que estén todas suspendidas: entonces todo espera).
  const fuera = new Set((e.pistasSuspendidas ?? []).map((s) => s.numero));
  if (canchasActivas(e).length)
    for (const r of e.rondas)
      for (const p of r.partidos) if (p.estado === "PENDIENTE" && r.numero > e.rondaActual) assert.ok(!fuera.has(p.pista), `${msg} ${p.id} en pista suspendida ${p.pista}`);
}

/** Dupla fija: un cruce solo se repite cuando ya se jugaron todos contra todos. */
function sinCrucesRepetidos(e: EventoAmericano, msg = "") {
  const n = e.parejas.filter((p) => !p.retirada).length;
  const vistos = new Set<string>();
  for (const r of e.rondas)
    for (const p of r.partidos) {
      const k = cruce(p);
      if (vistos.has(k)) assert.ok(vistos.size >= (n * (n - 1)) / 2, `${msg} cruce ${k} repetido en la ronda ${r.numero}`);
      vistos.add(k);
    }
}

test("lluvia en dupla fija: 16 duplas y 4 pistas, se suspende una en plena ronda y todo se reacomoda en 3", () => {
  let e = iniciarRonda(duplaFija(16, 4));
  const [p1, p2, p3] = ronda(e).partidos;
  e = cargarResultado(e, p1.id, { puntosA: 9, puntosB: 7 });
  e = cargarResultado(e, p2.id, { puntosA: 10, puntosB: 6 });
  const r1Antes = ronda(e, 1).partidos.length;
  const pistaMojada = p3.pista;

  e = suspenderPista(e, pistaMojada, { motivo: "Lluvia", marcador: "8-6" });

  // La ronda en curso sigue en las otras pistas (no se pausa) y el partido mojado sale de ella.
  assert.equal(ronda(e, 1).estado, "EN_JUEGO");
  assert.equal(ronda(e, 1).partidos.length, r1Antes - 1);
  assert.ok(!ronda(e, 1).partidos.some((p) => p.id === p3.id));
  // Queda en espera con su marcador y entra primero en la ronda 2, en otra pista.
  const espera = partidosEnEspera(e);
  assert.equal(espera.length, 1);
  assert.equal(espera[0].id, p3.id);
  assert.equal(espera[0].suspendido?.marcador, "8-6");
  assert.equal(espera[0].suspendido?.pista, pistaMojada);
  assert.equal(espera[0].rondaNumero, 2);
  assert.notEqual(espera[0].pista, pistaMojada);
  assert.equal(cruce(espera[0]), cruce(p3));
  // De la ronda 2 en adelante se juega en 3 pistas y nunca en la mojada.
  for (const r of e.rondas.filter((x) => x.numero >= 2)) {
    assert.ok(r.partidos.length <= 3, `ronda ${r.numero}: ${r.partidos.length} partidos`);
    assert.ok(r.partidos.every((p) => p.pista !== pistaMojada));
  }
  invariantes(e);
  sinCrucesRepetidos(e);

  // Se termina la ronda 1 y la 2 arranca sola con el partido suspendido.
  e = avanzarRonda(cargarTodo(e));
  e = iniciarRonda(e);
  assert.equal(ronda(e).partidos.find((p) => p.id === p3.id)?.estado, "EN_JUEGO");
  e = cargarResultado(e, p3.id, { puntosA: 9, puntosB: 7 });
  assert.equal(partidosEnEspera(e).length, 0);
  invariantes(e);
  sinCrucesRepetidos(e);
});

test("lluvia en individual: los 4 del partido suspendido siguen juntos y nadie repite compañero", () => {
  let e = iniciarRonda(individual(16, 4));
  const antes = metricasRotacion(e.rondas).companerosRepetidos;
  const p = ronda(e).partidos[1];
  e = suspenderPista(e, p.pista, { marcador: "5-3" });
  const sigue = partidosEnEspera(e)[0];
  assert.deepEqual(sigue.parejaA.jugadorIds, p.parejaA.jugadorIds);
  assert.deepEqual(sigue.parejaB.jugadorIds, p.parejaB.jugadorIds);
  assert.equal(sigue.rondaNumero, 2);
  assert.ok(metricasRotacion(e.rondas).companerosRepetidos <= antes);
  // Con 3 pistas, 16 jugadores: 12 juegan y 4 esperan cada ronda.
  for (const r of e.rondas.filter((x) => x.numero >= 2)) {
    assert.equal(r.partidos.length, 3);
    assert.equal(r.descansanIds.length, 4);
  }
  invariantes(e);
});

test("lluvia en mixto: las parejas siguen siendo hombre + mujer", () => {
  let e = iniciarRonda(individual(12, 3, true));
  e = suspenderPista(e, ronda(e).partidos[0].pista);
  const g = new Map(e.jugadores.map((j) => [j.id, j.genero]));
  for (const r of e.rondas) for (const p of r.partidos) for (const par of [p.parejaA, p.parejaB]) assert.notEqual(g.get(par.jugadorIds[0]), g.get(par.jugadorIds[1]));
  assert.equal(metricasRotacion(e.rondas).companerosRepetidos, 0);
  invariantes(e);
});

test("lluvia en la última ronda: se agrega una ronda para terminar el partido suspendido", () => {
  let e = duplaFija(6, 3);
  const total = e.totalRondas;
  for (let r = 1; r < total; r++) e = avanzarRonda(cargarTodo(iniciarRonda(e)));
  e = iniciarRonda(e);
  const p = ronda(e).partidos[0];
  e = suspenderPista(e, p.pista);
  assert.equal(e.totalRondas, total + 1);
  const extra = ronda(e, total + 1);
  assert.deepEqual(extra.partidos.map((x) => x.id), [p.id]);
  // Al cerrar la última ronda original no se finaliza: falta el suspendido.
  e = avanzarRonda(cargarTodo(e));
  assert.equal(e.estado, "EN_CURSO");
  assert.equal(e.rondaActual, total + 1);
  e = avanzarRonda(cargarTodo(iniciarRonda(e)));
  assert.equal(e.estado, "FINALIZADO");
  sinCrucesRepetidos(e);
  invariantes(e);
});

test("todas las pistas suspendidas: la ronda se pausa y al reactivar sigue sola", () => {
  let e = iniciarRonda(duplaFija(4, 2));
  const [a, b] = ronda(e).partidos;
  e = suspenderPista(e, a.pista, { marcador: "3-2" });
  e = suspenderPista(e, b.pista, { marcador: "4-4" });
  assert.equal(canchasActivas(e).length, 0);
  assert.equal(ronda(e, 1).estado, "PAUSADA");
  assert.equal(partidosEnEspera(e).length, 2);
  e = reactivarPista(e, a.pista);
  assert.deepEqual(canchasActivas(e), [a.pista]);
  // Con una sola pista, los dos suspendidos se terminan uno por ronda y no se pierde ninguno.
  const espera = partidosEnEspera(e).sort((x, y) => x.rondaNumero - y.rondaNumero);
  assert.equal(espera.length, 2);
  assert.deepEqual(espera.map((p) => p.rondaNumero), [2, 3]);
  assert.ok(espera.every((p) => p.pista === a.pista));
  assert.equal(espera.find((p) => p.id === b.id)?.suspendido?.marcador, "4-4");
  invariantes(e);
  sinCrucesRepetidos(e);
});

test("reactivar la pista: las rondas que faltan vuelven a usarla", () => {
  let e = iniciarRonda(duplaFija(8, 4));
  const mojada = ronda(e).partidos[3].pista;
  e = suspenderPista(e, mojada);
  assert.ok(e.rondas.filter((r) => r.numero >= 2).every((r) => r.partidos.length <= 3));
  e = reactivarPista(e, mojada);
  assert.equal(e.pistasSuspendidas, undefined);
  assert.ok(e.rondas.filter((r) => r.numero >= 3).some((r) => r.partidos.some((p) => p.pista === mojada)));
  assert.ok(ronda(e, 2).partidos.length === 4);
  // El partido que se cortó sigue primero en la ronda 2.
  assert.equal(ronda(e, 2).partidos[0].suspendido?.pista, mojada);
  invariantes(e);
  sinCrucesRepetidos(e);
});

test("suspender antes de empezar la ronda: solo se reacomoda, no queda nada en espera", () => {
  let e = duplaFija(8, 4);
  e = suspenderPista(e, 4);
  assert.equal(partidosEnEspera(e).length, 0);
  assert.ok(e.rondas.every((r) => r.partidos.length <= 3 && r.partidos.every((p) => p.pista !== 4)));
  invariantes(e);
  sinCrucesRepetidos(e);
});

test("si una dupla del partido suspendido se retira, ese partido ya no se juega", () => {
  let e = iniciarRonda(duplaFija(8, 4));
  const p = ronda(e).partidos[0];
  e = suspenderPista(e, p.pista);
  e = retirarPareja(e, p.parejaA.id);
  assert.equal(partidosEnEspera(e).length, 0);
  assert.ok(!e.rondas.some((r) => r.partidos.some((x) => x.id === p.id)));
  invariantes(e);
});

test("dos celulares: la suspensión no pisa un marcador cargado en otra pista", async () => {
  const e0 = iniciarRonda(duplaFija(8, 4));
  const [p1, , , p4] = ronda(e0).partidos;
  const celA = cargarResultado(e0, p1.id, { puntosA: 9, puntosB: 7 });
  await new Promise((r) => setTimeout(r, 3));
  const celB = suspenderPista(e0, p4.pista);
  for (const f of [fusionarEventos(celA, celB), fusionarEventos(celB, celA)]) {
    assert.equal(f.rondas[0].partidos.find((p) => p.id === p1.id)?.resultado?.puntosA, 9);
    assert.equal(partidosEnEspera(f).length, 1);
    assert.ok(f.pistasSuspendidas?.some((s) => s.numero === p4.pista));
  }
});

test("lluvia al azar en 48 eventos: nunca se repite un cruce ni se pierde un partido", () => {
  const rng = crearRng(2026);
  const azar = (n: number) => Math.floor(rng() * n);
  let casos = 0;
  let conRepetido = 0;
  for (const modalidad of ["DUPLA_FIJA", "INDIVIDUAL", "MIXTO"] as const)
    for (const pistas of [2, 3, 4, 6])
      for (let s = 1; s <= 4; s++) {
        const n = modalidad === "DUPLA_FIJA" ? pistas * 2 + azar(pistas * 2) : pistas * 4 + azar(pistas * 4);
        let e = modalidad === "DUPLA_FIJA" ? duplaFija(n, pistas, s, Math.min(planRondas(n, "DUPLA_FIJA", pistas).rondas, 12)) : individual(n, pistas, modalidad === "MIXTO", s);
        const msg = `${modalidad} ${n} con ${pistas} pistas, semilla ${s}:`;
        const repetidosAntes = metricasRotacion(e.rondas).companerosRepetidos;
        const suspendidos = new Set<string>();
        let vueltas = 0;
        while (e.estado !== "FINALIZADO" && vueltas++ < 60) {
          e = iniciarRonda(e);
          // A mitad de ronda: a veces llueve en una pista, a veces vuelve a salir el sol.
          const accion = azar(4);
          const susp = e.pistasSuspendidas ?? [];
          if (accion === 0) {
            const libres = canchasActivas(e);
            if (libres.length) {
              const pista = libres[azar(libres.length)];
              const p = ronda(e).partidos.find((x) => x.pista === pista && x.estado === "EN_JUEGO");
              if (p) suspendidos.add(p.id);
              e = suspenderPista(e, pista, { marcador: "4-3" });
            }
          } else if (accion === 1 && susp.length) e = reactivarPista(e, susp[azar(susp.length)].numero);
          invariantes(e, msg);
          if (!canchasActivas(e).length) e = reactivarPista(e, e.pistasSuspendidas![0].numero);
          // Se carga la mitad, luego el resto, y se avanza.
          for (const p of ronda(e).partidos) if (azar(2)) e = cargarResultado(e, p.id, { puntosA: 9, puntosB: 7 });
          e = avanzarRonda(cargarTodo(e));
        }
        assert.equal(e.estado, "FINALIZADO", msg);
        invariantes(e, msg);
        if (modalidad === "DUPLA_FIJA") sinCrucesRepetidos(e, msg);
        else {
          // Individual: el mismo partido (mismas dos parejas) nunca se repite. Con menos pistas la
          // rotación tiene menos opciones y, muy de vez en cuando, dos jugadores repiten compañero una vez.
          const partidos = e.rondas.flatMap((r) => r.partidos.map((p) => [p.parejaA.id, p.parejaB.id].sort().join(" vs ")));
          assert.equal(new Set(partidos).size, partidos.length, `${msg} se repite un partido`);
          const repetidos = metricasRotacion(e.rondas).companerosRepetidos - repetidosAntes;
          assert.ok(repetidos <= 1, `${msg} repite ${repetidos} compañeros`);
          if (repetidos > 0) conRepetido++;
        }
        // Cada partido suspendido se terminó exactamente una vez, con las mismas duplas.
        const todos = e.rondas.flatMap((r) => r.partidos);
        for (const id of suspendidos) {
          const p = todos.filter((x) => x.id === id);
          if (!p.length) continue; // se retiró alguien (no pasa aquí) o se reacomodó antes de empezar
          assert.equal(p.length, 1, `${msg} ${id}`);
          assert.equal(p[0].estado, "FINALIZADO", `${msg} ${id} quedó sin terminar`);
        }
        assert.equal(partidosEnEspera(e).length, 0, msg);
        casos++;
      }
  assert.equal(casos, 48);
  assert.ok(conRepetido <= 2, `${conRepetido} eventos con un compañero repetido`);
});

/* ---------- Americano Torneo ---------- */

import { armarLlave, crearHabibi, cruces, marcarEnJuego, type NuevoHabibiInput } from "../lib/habibi.ts";
import { eventosDelTorneo, reactivarPistaEn, suspenderPistaEn } from "../lib/lluvia.ts";

function habibi(): { llave: EventoAmericano; grupos: EventoAmericano[] } {
  const grupo = (letra: string) => {
    const jugadores: Jugador[] = [];
    const parejas: Pareja[] = [];
    for (let i = 1; i <= 8; i++) {
      jugadores.push({ id: `${letra}${i}a`, nombre: `${letra}${i}a`, genero: "M" }, { id: `${letra}${i}b`, nombre: `${letra}${i}b`, genero: "M" });
      parejas.push({ id: `${letra}${i}`, jugadorIds: [`${letra}${i}a`, `${letra}${i}b`], nombre: `${letra}${i}` });
    }
    return { jugadores, parejas };
  };
  const c = canchas(4);
  const input: NuevoHabibiInput = {
    nombre: "Habibi lluvia", fecha: "2026-10-30", categoria: { rama: "MASCULINO", nivel: "5TA" }, modalidad: "DUPLA_FIJA",
    grupos: [{ ...grupo("A"), canchas: [c[0], c[1]] }, { ...grupo("B"), canchas: [c[2], c[3]] }],
    puntuacionGrupos: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16 }, cronometro: true, duracionRondaMin: 15,
    inicio: "CUARTOS", tercerPuesto: false, puntuacionLlave: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16 }, canchasLlave: c,
  };
  return crearHabibi(input);
}

test("Americano Torneo: la lluvia en una pista de un grupo reacomoda ese grupo sin repetir cruces", () => {
  const { llave, grupos } = habibi();
  const eventos = Object.fromEntries([llave, ...grupos].map((e) => [e.id, e]));
  let a = iniciarRonda(grupos[0]);
  const p = ronda(a).partidos.find((x) => x.pista === 2)!;
  // Se suspende la pista 2 en todo el torneo: solo la usa el grupo A.
  const todos = eventosDelTorneo(a, eventos).map((e) => (e.id === a.id ? a : e));
  assert.equal(todos.length, 3);
  const despues = todos.map((e) => suspenderPistaEn(e, 2, { marcador: "6-5" }));
  a = despues.find((e) => e.id === a.id)!;
  const b = despues.find((e) => e.id === grupos[1].id)!;
  assert.deepEqual(b.rondas, grupos[1].rondas, "el grupo B no usa la pista 2: no cambia");
  assert.equal(partidosEnEspera(a)[0].id, p.id);
  assert.ok(a.rondas.filter((r) => r.numero >= 2).every((r) => r.partidos.every((x) => x.pista === 1)));
  invariantes(a);
  sinCrucesRepetidos(a);
});

test("Americano Torneo: en la llave el cruce suspendido pasa a otra pista con su marcador y nada se juega en la mojada", () => {
  let { llave, grupos } = habibi();
  grupos = grupos.map((g) => {
    let e = g;
    while (e.estado !== "FINALIZADO") e = avanzarRonda(cargarTodo(iniciarRonda(e)));
    return e;
  });
  llave = armarLlave(llave, grupos);
  const cuartos = llave.rondas.find((r) => r.fase === "CUARTOS")!.partidos;
  assert.equal(cuartos.length, 4);
  const enPista3 = cuartos.find((p) => p.pista === 3)!;
  llave = marcarEnJuego(llave, enPista3.id, true);
  llave = suspenderPistaEn(llave, 3, { marcador: "7-4" });
  const ahora = llave.rondas.flatMap((r) => r.partidos);
  const susp = ahora.find((p) => p.id === enPista3.id)!;
  assert.equal(susp.estado, "PENDIENTE");
  assert.equal(susp.suspendido?.marcador, "7-4");
  assert.notEqual(susp.pista, 3);
  assert.ok(ahora.every((p) => p.pista !== 3));
  assert.equal(cruces(llave).filter((c) => c.fase === "CUARTOS").length, 4);
  // Al reactivarla, los cruces que no empezaron vuelven a su pista.
  llave = reactivarPistaEn(llave, 3);
  assert.equal(llave.pistasSuspendidas, undefined);
  assert.equal(llave.rondas.flatMap((r) => r.partidos).find((p) => p.id === enPista3.id)?.pista, 3);
  assert.deepEqual(validarEvento(llave), []);
});

/* ---------- todas las combinaciones: modalidad × puntuación × pistas ---------- */

import type { ConfigPuntuacion, Resultado } from "../types/americano.ts";

const PUNTUACIONES: { cfg: ConfigPuntuacion; res: Resultado }[] = [
  { cfg: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, res: { puntosA: 14, puntosB: 10 } },
  { cfg: { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6 }, res: { puntosA: 6, puntosB: 4 } },
  { cfg: { metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 }, res: { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 4, b: 3 }] } },
];

test("lluvia en todas las combinaciones: dupla fija, individual y mixto × puntos, games y sets × 1 a 6 pistas", () => {
  let casos = 0;
  for (const { cfg, res } of PUNTUACIONES)
    for (const modalidad of ["DUPLA_FIJA", "INDIVIDUAL", "MIXTO"] as const)
      for (let pistas = 1; pistas <= 6; pistas++) {
        // Cantidades justas y con gente en espera (impares incluidas).
        const cantidades = modalidad === "DUPLA_FIJA" ? [pistas * 2, pistas * 2 + 3] : [pistas * 4, pistas * 4 + 3];
        for (const n of cantidades) {
          const base = modalidad === "DUPLA_FIJA" ? duplaFija(n, pistas, 3, Math.min(planRondas(n, "DUPLA_FIJA", pistas).rondas, 5)) : individual(n, pistas, modalidad === "MIXTO", 3);
          let e: EventoAmericano = { ...base, puntuacion: cfg, totalRondas: Math.min(base.totalRondas, 5), rondas: base.rondas.slice(0, 5) };
          const msg = `${cfg.metodo} ${modalidad} ${n} en ${pistas} pistas:`;
          const ronda1 = iniciarRonda(e);
          const mojada = ronda(ronda1).partidos.at(-1)!;
          // Se suspende en plena ronda 1 (con 1 pista se suspenden todas y se reactiva enseguida).
          e = suspenderPista(ronda1, mojada.pista, { marcador: "3-2" });
          if (!canchasActivas(e).length) {
            assert.equal(ronda(e, 1).estado, "PAUSADA", msg);
            e = reactivarPista(e, mojada.pista);
          }
          invariantes(e, msg);
          assert.equal(partidosEnEspera(e).length, 1, msg);
          let vueltas = 0;
          while (e.estado !== "FINALIZADO" && vueltas++ < 20) {
            if (ronda(e).estado !== "EN_JUEGO") e = iniciarRonda(e);
            for (const p of ronda(e).partidos) if (p.estado !== "FINALIZADO") e = cargarResultado(e, p.id, res);
            if (e.rondaActual === 3 && e.pistasSuspendidas?.length) e = reactivarPista(e, mojada.pista);
            e = avanzarRonda(e);
          }
          assert.equal(e.estado, "FINALIZADO", msg);
          invariantes(e, msg);
          if (modalidad === "DUPLA_FIJA") sinCrucesRepetidos(e, msg);
          const fin = e.rondas.flatMap((r) => r.partidos).find((p) => p.id === mojada.id);
          assert.equal(fin?.estado, "FINALIZADO", `${msg} el suspendido se terminó`);
          assert.equal(fin?.suspendido?.marcador, "3-2", msg);
          casos++;
        }
      }
  assert.equal(casos, 108);
});
