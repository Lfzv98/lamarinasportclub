/**
 * Pruebas de las mejoras pedidas por Moncho: categorías por suma y 2da,
 * rondas automáticas, mixto individual, duplas en espera, cronómetro on/off
 * y desempates del ranking.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaLabel, cumpleSuma, nivelesPara, ejemplosSuma, formatoLabel, formatosPara, nivelParaSuma, sumaPareja } from "../lib/categories.ts";
import { cargarResultado, crearEvento } from "../lib/evento.ts";
import { generarRondasDuplaFija, generarRondasIndividual, metricasRotacion, planRondas } from "../lib/rotation.ts";
import { calcularTabla, explicacionRanking } from "../lib/scoring.ts";
import { validarEvento } from "../lib/validacion.ts";
import type { EventoAmericano, Genero, Jugador, Nivel, Pareja } from "../types/americano.ts";

const jug = (id: string, genero: Genero = "M", nivel: Nivel = "4TA"): Jugador => ({ id, nombre: id.toUpperCase(), genero, nivel, fotoUrl: null });
const parejas = (n: number): { jugadores: Jugador[]; parejas: Pareja[] } => {
  const jugadores: Jugador[] = [];
  const ps: Pareja[] = [];
  for (let i = 0; i < n; i++) {
    jugadores.push(jug(`a${i}`), jug(`b${i}`));
    ps.push({ id: `p${i}`, jugadorIds: [`a${i}`, `b${i}`], nombre: `P${i}` });
  }
  return { jugadores, parejas: ps };
};

/* ---------- categorías ---------- */

test("categorías: 2da, suma y nombre propio", () => {
  assert.equal(categoriaLabel({ rama: "MASCULINO", nivel: "2DA" }), "Masculino 2da");
  assert.equal(categoriaLabel({ rama: "FEMENINO", nivel: "5TA", suma: 9 }), "Femenino Suma 9");
  assert.equal(categoriaLabel({ rama: "MIXTO", nivel: "5TA", suma: 9, nombre: "Copa Aniversario" }), "Copa Aniversario");
  assert.equal(sumaPareja("4TA", "5TA"), 9);
  assert.equal(sumaPareja("OPEN", "2DA"), 3);
  assert.ok(cumpleSuma({ suma: 9 }, "4TA", "5TA"));
  assert.ok(cumpleSuma({ suma: 9 }, "4TA", "6TA")); // más débil, permitido
  assert.ok(!cumpleSuma({ suma: 9 }, "3RA", "5TA")); // suma 8: más fuerte
  assert.match(ejemplosSuma(9), /5ta \+ 4ta/);
  assert.equal(nivelParaSuma(9), "5TA");
});

test("Femenino no tiene 2da: ni en la categoría ni en las jugadoras", () => {
  assert.ok(!nivelesPara("FEMENINO").includes("2DA"));
  assert.ok(nivelesPara("MASCULINO").includes("2DA") && nivelesPara("MIXTO").includes("2DA"));
  const js = Array.from({ length: 4 }, (_, i) => ({ ...jug(`f${i}`, "F"), nivel: "3RA" as Nivel }));
  const e = crearEvento({
    nombre: "F", categoria: { rama: "FEMENINO", nivel: "3RA" }, modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 1, duracionRondaMin: 15, totalRondas: 3, jugadores: js, semilla: 1,
  });
  assert.deepEqual(validarEvento(e), []);
  assert.ok(validarEvento({ ...e, categoria: { rama: "FEMENINO", nivel: "2DA" } }).some((m) => /2da/.test(m)));
  assert.ok(validarEvento({ ...e, jugadores: e.jugadores.map((j, i) => (i ? j : { ...j, nivel: "2DA" })) }).some((m) => /2da/.test(m)));
});

test("formatos: ya no existe 'Mixto' como formato, se elige en la categoría", () => {
  assert.deepEqual(formatosPara("MIXTO").map((f) => f.id), ["INDIVIDUAL", "DUPLA_FIJA"]);
  assert.equal(formatoLabel("INDIVIDUAL_ROTATIVO", "MIXTO"), "Individual mixto");
  assert.equal(formatoLabel("DUPLA_FIJA", "MIXTO"), "Dupla fija mixta");
  assert.equal(formatoLabel("INDIVIDUAL_ROTATIVO", "FEMENINO"), "Individual");
});

test("la API valida suma, nombre, 2da y cronómetro", () => {
  const { jugadores, parejas: ps } = parejas(4);
  const base = crearEvento({
    nombre: "T", categoria: { rama: "MASCULINO", nivel: "2DA", suma: 9, nombre: "Copa" }, modalidad: "DUPLA_FIJA",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 2, duracionRondaMin: 15, cronometro: false, totalRondas: 3, jugadores, parejas: ps, semilla: 1,
  });
  assert.equal(base.cronometro, false);
  assert.deepEqual(validarEvento(base), []);
  for (const mal of [{ categoria: { ...base.categoria, suma: 30 } }, { categoria: { ...base.categoria, nombre: "x".repeat(80) } }, { cronometro: "no" }, { categoria: { rama: "MIXTO", nivel: "1RA" } }])
    assert.ok(validarEvento({ ...base, ...mal }).length > 0, JSON.stringify(mal));
  assert.ok(validarEvento({ ...base, jugadores: base.jugadores.map((j, i) => (i ? j : { ...j, nivel: "9NA" })) }).length > 0);
  // Por defecto el cronómetro está encendido y no se guarda el campo.
  assert.equal(crearEvento({ ...base, categoria: { rama: "MASCULINO", nivel: "4TA" }, parejas: ps, cronometro: undefined }).cronometro, undefined);
});

/* ---------- rondas automáticas ---------- */

test("dupla fija: las rondas automáticas completan el todos contra todos sin repetir (2-16 duplas, 1-6 pistas)", () => {
  for (let n = 2; n <= 16; n++)
    for (let pistas = 1; pistas <= 6; pistas++) {
      const plan = planRondas(n, "DUPLA_FIJA", pistas);
      const { parejas: ps } = parejas(n);
      const rondas = generarRondasDuplaFija(ps, { pistas, rondas: plan.rondas, semilla: n * 13 + pistas });
      const cruces = new Set<string>();
      for (const r of rondas)
        for (const p of r.partidos) {
          const k = [p.parejaA.id, p.parejaB.id].sort().join("|");
          assert.ok(!cruces.has(k), `n=${n} pistas=${pistas}: cruce repetido ${k}`);
          cruces.add(k);
        }
      // Con 1 pista y muchas duplas el todos contra todos no cabe en 30 rondas: se juega lo que cabe.
      if (plan.equitativo) assert.equal(cruces.size, (n * (n - 1)) / 2, `n=${n} pistas=${pistas}`);
      else assert.equal(plan.rondas, 30, `n=${n} pistas=${pistas}`);
      assert.equal(plan.enEspera, n - plan.porRonda * 2);
      // Cada dupla espera lo mismo que las demás (± 1 por la última ronda incompleta).
      const espera = new Map<string, number>();
      rondas.forEach((r) => r.descansanIds.forEach((id) => espera.set(id, (espera.get(id) ?? 0) + 1)));
      const v = ps.map((p) => espera.get(p.id) ?? 0);
      assert.ok(Math.max(...v) - Math.min(...v) <= 1, `n=${n} pistas=${pistas} esperas ${v}`);
    }
});

test("individual: rondas automáticas sin repetir pareja y, si se puede, todos juegan lo mismo", () => {
  for (let n = 4; n <= 24; n++)
    for (let pistas = 1; pistas <= Math.min(6, Math.floor(n / 4)); pistas++) {
      const plan = planRondas(n, "INDIVIDUAL_ROTATIVO", pistas);
      const js = Array.from({ length: n }, (_, i) => jug(`j${String(i).padStart(2, "0")}`));
      const m = metricasRotacion(generarRondasIndividual(js, { pistas, rondas: plan.rondas, semilla: n * 7 + pistas }));
      assert.equal(m.companerosRepetidos, 0, `n=${n} pistas=${pistas}`);
      if (plan.equitativo) assert.equal(m.minPartidos, m.maxPartidos, `n=${n} pistas=${pistas}`);
      assert.ok(plan.rondas >= 3 || plan.sinRepetir < 3, `n=${n}`);
    }
  // Casos clásicos.
  assert.equal(planRondas(4, "INDIVIDUAL_ROTATIVO", 1).rondas, 3);
  assert.equal(planRondas(5, "INDIVIDUAL_ROTATIVO", 1).rondas, 5);
  assert.equal(planRondas(8, "INDIVIDUAL_ROTATIVO", 2).rondas, 7);
  assert.deepEqual(planRondas(10, "INDIVIDUAL_ROTATIVO", 2).partidos, [4, 4]);
});

test("mixto individual: siempre hombre + mujer, sin repetir pareja, con casillas de cualquier tamaño", () => {
  for (let h = 2; h <= 10; h++)
    for (let m = 2; m <= 10; m++)
      for (const pistas of [1, 2, 3, 4]) {
        const plan = planRondas(h + m, "INDIVIDUAL_ROTATIVO", pistas, { hombres: h, mujeres: m });
        const js = [...Array.from({ length: h }, (_, i) => jug(`h${i}`, "M")), ...Array.from({ length: m }, (_, i) => jug(`m${i}`, "F"))];
        const rondas = generarRondasIndividual(js, { pistas, rondas: plan.rondas, semilla: h * 31 + m * 7 + pistas, mixto: true });
        for (const r of rondas)
          for (const p of r.partidos)
            for (const par of [p.parejaA, p.parejaB]) assert.deepEqual(par.jugadorIds.map((id) => id[0]).sort(), ["h", "m"], `h=${h} m=${m}`);
        assert.equal(metricasRotacion(rondas).companerosRepetidos, 0, `h=${h} m=${m} pistas=${pistas}`);
        assert.equal(plan.enEspera, h + m - plan.porRonda * 4);
      }
});

test("suma en individual: evita parejas más fuertes que la categoría", () => {
  // Suma 9 con 4 de 3ra y 4 de 6ta: 3ra + 3ra = 6 no sirve; 3ra + 6ta = 9 sí.
  const js = [...["a", "b", "c", "d"].map((x) => jug(x, "M", "3RA")), ...["e", "f", "g", "h"].map((x) => jug(x, "M", "6TA"))];
  const nivel = new Map(js.map((j) => [j.id, j.nivel!]));
  const rondas = generarRondasIndividual(js, { pistas: 2, rondas: 4, semilla: 5, suma: 9 });
  for (const r of rondas)
    for (const p of r.partidos)
      for (const par of [p.parejaA, p.parejaB]) assert.ok(cumpleSuma({ suma: 9 }, nivel.get(par.jugadorIds[0]), nivel.get(par.jugadorIds[1])), JSON.stringify(par));
});

/* ---------- desempates ---------- */

function eventoDupla(n: number): EventoAmericano {
  const { jugadores, parejas: ps } = parejas(n);
  return crearEvento({
    nombre: "Dupla", categoria: { rama: "MASCULINO", nivel: "4TA" }, modalidad: "DUPLA_FIJA",
    puntuacion: { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6, criterio: "VICTORIAS" }, pistas: 2, duracionRondaMin: 15,
    totalRondas: planRondas(n, "DUPLA_FIJA", 2).rondas, jugadores, parejas: ps, semilla: 9,
  });
}

function jugar(e: EventoAmericano, a: string, b: string, ga: number, gb: number): EventoAmericano {
  const p = e.rondas.flatMap((r) => r.partidos).find((x) => (x.parejaA.id === a && x.parejaB.id === b) || (x.parejaA.id === b && x.parejaB.id === a));
  assert.ok(p, `${a} vs ${b}`);
  const directo = p.parejaA.id === a;
  return cargarResultado(e, p.id, { puntosA: directo ? ga : gb, puntosB: directo ? gb : ga });
}

test("desempate: con las mismas victorias y puntos manda el enfrentamiento directo", () => {
  let e = eventoDupla(4);
  // P0 y P1 ganan 2 de 3. P0 tiene mejor diferencia, pero P1 le ganó a P0.
  e = jugar(e, "p1", "p0", 6, 5);
  e = jugar(e, "p0", "p2", 6, 0);
  e = jugar(e, "p0", "p3", 6, 0);
  e = jugar(e, "p1", "p2", 6, 4);
  e = jugar(e, "p3", "p1", 6, 4);
  e = jugar(e, "p2", "p3", 6, 2);
  const t = calcularTabla(e);
  const [primero, segundo] = t.filas;
  assert.equal(primero.puntos, segundo.puntos);
  assert.ok(segundo.diferencia > primero.diferencia, "P0 tiene mejor diferencia que P1");
  assert.equal(primero.entidadId, "p1");
  assert.equal(segundo.entidadId, "p0");
  assert.deepEqual([primero.posicion, segundo.posicion], [1, 2]);
  assert.match(t.desempates![0].motivo, /enfrentamiento directo/);
});

test("desempate: sin directo decide la diferencia y luego los games a favor", () => {
  let e = eventoDupla(4);
  e = jugar(e, "p0", "p2", 6, 1); // P0 +5
  e = jugar(e, "p1", "p3", 6, 3); // P1 +3
  const t = calcularTabla(e);
  assert.deepEqual(t.filas.slice(0, 2).map((f) => f.entidadId), ["p0", "p1"]);
  assert.match(t.desempates!.find((d) => d.arriba === "P0")!.motivo, /mejor diferencia/);
});

test("desempate: si todo es idéntico comparten posición (1, 1, 3…)", () => {
  let e = eventoDupla(4);
  e = jugar(e, "p0", "p2", 6, 3);
  e = jugar(e, "p1", "p3", 6, 3);
  const t = calcularTabla(e);
  assert.deepEqual(t.filas.map((f) => f.posicion), [1, 1, 3, 3]);
  assert.ok(t.filas[0].empatado && t.filas[1].empatado);
  assert.match(t.desempates![0].motivo, /comparten posición/);
  // Antes de jugar nadie comparte puesto: 1, 2, 3, 4.
  assert.deepEqual(calcularTabla(eventoDupla(4)).filas.map((f) => f.posicion), [1, 2, 3, 4]);
});

test("desempate: tres duplas empatadas se ordenan por la mini tabla entre ellas", () => {
  let e = eventoDupla(4);
  // Triple empate a 2 victorias entre P0, P1 y P2 (ciclo), todas le ganan a P3.
  e = jugar(e, "p0", "p1", 6, 4);
  e = jugar(e, "p1", "p2", 6, 1);
  e = jugar(e, "p2", "p0", 6, 5);
  for (const x of ["p0", "p1", "p2"]) e = jugar(e, x, "p3", 6, 2);
  const t = calcularTabla(e);
  // Entre ellas: P1 +5-2 = +3, P0 +2-1 = +1, P2 +1-5 = -4.
  assert.deepEqual(t.filas.map((f) => f.entidadId), ["p1", "p0", "p2", "p3"]);
  assert.match(explicacionRanking(e.puntuacion, true), /enfrentamiento directo/);
});

test("individual: empate en puntos se define por diferencia y no inventa un directo", () => {
  const js = Array.from({ length: 4 }, (_, i) => jug(`j${i}`));
  let e = crearEvento({
    nombre: "I", categoria: { rama: "MASCULINO", nivel: "4TA" }, modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 1, duracionRondaMin: 15, totalRondas: 3, jugadores: js, semilla: 2,
  });
  e = cargarResultado(e, e.rondas[0].partidos[0].id, { puntosA: 12, puntosB: 12 });
  const t = calcularTabla(e);
  assert.deepEqual(t.filas.map((f) => f.posicion), [1, 1, 1, 1]);
  assert.doesNotMatch(explicacionRanking(e.puntuacion, false), /directo/);
});

/* ---------- duplas en espera ---------- */

test("más duplas que pistas: cada ronda anota quién espera y nadie espera dos veces seguidas de más", () => {
  const e = eventoDupla(5); // 5 duplas, 2 pistas → 1 en espera por ronda
  assert.equal(e.totalRondas, 5);
  for (const r of e.rondas) {
    assert.equal(r.partidos.length, 2);
    assert.equal(r.descansanIds.length, 1);
    const enCancha = new Set(r.partidos.flatMap((p) => [p.parejaA.id, p.parejaB.id]));
    assert.ok(!enCancha.has(r.descansanIds[0]));
  }
  // Cada dupla espera exactamente una ronda.
  assert.deepEqual(e.rondas.map((r) => r.descansanIds[0]).sort(), ["p0", "p1", "p2", "p3", "p4"]);
});

test("caso del club: 5 pistas y más inscritos que cupos (26 jugadores, 13 duplas, mixto 13 + 13)", () => {
  const plan = planRondas(26, "INDIVIDUAL_ROTATIVO", 5);
  assert.deepEqual([plan.rondas, plan.porRonda, plan.enEspera, plan.equitativo, plan.rondasParejas], [8, 5, 6, false, 13]);
  const js = Array.from({ length: 26 }, (_, i) => jug(`j${String(i).padStart(2, "0")}`));
  const m8 = metricasRotacion(generarRondasIndividual(js, { pistas: 5, rondas: 8, semilla: 1 }));
  assert.deepEqual([m8.companerosRepetidos, m8.minPartidos, m8.maxPartidos], [0, 6, 7]);
  const m13 = metricasRotacion(generarRondasIndividual(js, { pistas: 5, rondas: 13, semilla: 1 }));
  assert.deepEqual([m13.companerosRepetidos, m13.minPartidos, m13.maxPartidos], [0, 10, 10]);

  const d = planRondas(13, "DUPLA_FIJA", 5);
  const { parejas: ps } = parejas(13);
  const rondas = generarRondasDuplaFija(ps, { pistas: 5, rondas: d.rondas, semilla: 3 });
  const cruces = new Set(rondas.flatMap((r) => r.partidos.map((p) => [p.parejaA.id, p.parejaB.id].sort().join("|"))));
  assert.equal(cruces.size, 78);
  assert.equal(rondas.reduce((s, r) => s + r.partidos.length, 0), 78);

  const mx = [...Array.from({ length: 13 }, (_, i) => jug(`h${i}`, "M")), ...Array.from({ length: 13 }, (_, i) => jug(`m${i}`, "F"))];
  const pm = planRondas(26, "INDIVIDUAL_ROTATIVO", 5, { hombres: 13, mujeres: 13 });
  const rm = generarRondasIndividual(mx, { pistas: 5, rondas: pm.rondas, semilla: 4, mixto: true });
  assert.equal(metricasRotacion(rm).companerosRepetidos, 0);
  assert.ok(rm.every((r) => r.partidos.every((p) => [p.parejaA, p.parejaB].every((x) => x.jugadorIds.map((id) => id[0]).sort().join() === "h,m"))));
});
