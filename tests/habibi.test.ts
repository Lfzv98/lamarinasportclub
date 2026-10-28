import { test } from "node:test";
import assert from "node:assert/strict";
import { cargarResultado, fusionarEventos } from "../lib/evento.ts";
import {
  armarLlave,
  bloqueoArmar,
  borrarResultadoLlave,
  cargarResultadoLlave,
  crearHabibi,
  cruces,
  duplasDeGrupo,
  erroresHabibi,
  fasesLlave,
  fusionarLlave,
  iniciosPosibles,
  podio,
  semillaDe,
  type NuevoHabibiInput,
} from "../lib/habibi.ts";
import { calcularTabla, ganador, normalizarResultado, validarResultado } from "../lib/scoring.ts";
import { validarEvento } from "../lib/validacion.ts";
import type { ConfigPuntuacion, EventoAmericano, InicioLlave, Jugador, Pareja, PistaClub } from "../types/americano.ts";

const A16: ConfigPuntuacion = { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16, modo: "TOTAL" };
const cancha = (n: number): PistaClub => ({ numero: n, nombre: `Pista ${n}`, techada: true, activa: true });

function grupo(letra: string, n: number) {
  const jugadores: Jugador[] = [];
  const parejas: Pareja[] = [];
  for (let i = 1; i <= n; i++) {
    const a = { id: `${letra}${i}a`, nombre: `${letra}${i}a`, genero: "M" as const };
    const b = { id: `${letra}${i}b`, nombre: `${letra}${i}b`, genero: "M" as const };
    jugadores.push(a, b);
    parejas.push({ id: `${letra}${i}`, jugadorIds: [a.id, b.id], nombre: `${letra}${i}` });
  }
  return { jugadores, parejas };
}

function input(n = 8, inicio: InicioLlave = "OCTAVOS", extra: Partial<NuevoHabibiInput> = {}): NuevoHabibiInput {
  return {
    nombre: "Habibi test",
    fecha: "2026-10-28",
    categoria: { rama: "MASCULINO", nivel: "5TA" },
    modalidad: "DUPLA_FIJA",
    grupos: [
      { ...grupo("A", n), canchas: [cancha(1), cancha(2), cancha(3), cancha(4)] },
      { ...grupo("B", n), canchas: [cancha(5), cancha(6)] },
    ],
    puntuacionGrupos: A16,
    cronometro: true,
    duracionRondaMin: 15,
    inicio,
    tercerPuesto: false,
    puntuacionLlave: A16,
    canchasLlave: [cancha(1), cancha(2), cancha(3), cancha(4), cancha(5), cancha(6)],
    ...extra,
  };
}

/** Juega todo el grupo: la dupla con número menor siempre gana 10-6 (así 1º = dupla 1, 2º = dupla 2…). */
function jugarGrupo(g: EventoAmericano): EventoAmericano {
  let e = g;
  for (const r of g.rondas)
    for (const p of r.partidos) {
      const na = Number(p.parejaA.id.slice(1));
      const nb = Number(p.parejaB.id.slice(1));
      e = cargarResultado(e, p.id, na < nb ? { puntosA: 10, puntosB: 6 } : { puntosA: 6, puntosB: 10 });
    }
  return e;
}

/** En la llave gana siempre la dupla de grupo A con número menor, o la de número menor si son del mismo grupo. */
function jugarFase(llave: EventoAmericano): EventoAmericano {
  let e = llave;
  for (const c of cruces(e)) {
    if (!c.parejaA || !c.parejaB || c.partido?.resultado) continue;
    const peso = (p: Pareja) => (p.id[0] === "A" ? 0 : 100) + Number(p.id.slice(1));
    e = cargarResultadoLlave(e, c.id, peso(c.parejaA) < peso(c.parejaB) ? { puntosA: 9, puntosB: 7 } : { puntosA: 7, puntosB: 9 });
  }
  return e;
}

test("crea dos grupos en dupla fija todos contra todos y la llave enlazada", () => {
  const { llave, grupos } = crearHabibi(input());
  assert.equal(grupos.length, 2);
  for (const g of grupos) {
    assert.equal(g.modalidad, "DUPLA_FIJA");
    assert.equal(g.habibi?.rol, "GRUPO");
    const cruces = new Set(g.rondas.flatMap((r) => r.partidos.map((p) => [p.parejaA.id, p.parejaB.id].sort().join("-"))));
    assert.equal(cruces.size, 28, "8 duplas: 28 partidos distintos");
    assert.deepEqual(validarEvento(g), []);
  }
  assert.equal(grupos[0].totalRondas, 7, "8 duplas en 4 pistas: 7 rondas");
  assert.equal(llave.habibi?.rol, "LLAVE");
  assert.deepEqual(fasesLlave("OCTAVOS", false), ["OCTAVOS", "CUARTOS", "SEMIS", "FINAL"]);
  assert.deepEqual(llave.rondas.map((r) => r.fase), ["OCTAVOS", "CUARTOS", "SEMIS", "FINAL"]);
  assert.deepEqual(validarEvento(llave), []);
});

test("octavos sigue la hoja: 1A-3A, 6B-8B, 2A-4A, 5B-7B, 5A-7A, 2B-4B, 6A-8A, 1B-3B", () => {
  const { llave, grupos } = crearHabibi(input());
  const jugados = grupos.map(jugarGrupo);
  assert.deepEqual(calcularTabla(jugados[0]).filas.map((f) => f.entidadId), ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
  const armada = armarLlave(llave, jugados);
  const octavos = armada.rondas[0].partidos.map((p) => `${semillaDe(armada, p.parejaA.id)}-${semillaDe(armada, p.parejaB.id)}`);
  assert.deepEqual(octavos, ["1A-3A", "6B-8B", "2A-4A", "5B-7B", "5A-7A", "2B-4B", "6A-8A", "1B-3B"]);
  assert.equal(armada.estado, "EN_CURSO");
  assert.deepEqual(validarEvento(armada), [], "8 partidos en octavos son válidos en la llave");
  // Las 6 pistas se reparten; dos partidos van en segundo turno.
  assert.deepEqual(armada.rondas[0].partidos.map((p) => p.pista), [1, 2, 3, 4, 5, 6, 1, 2]);
});

test("cada dupla aparece una sola vez por fase y el ganador avanza hasta la final", () => {
  const { llave, grupos } = crearHabibi(input());
  let e = armarLlave(llave, grupos.map(jugarGrupo));
  for (let i = 0; i < 4; i++) {
    for (const r of e.rondas) {
      const ids = r.partidos.flatMap((p) => [p.parejaA.id, p.parejaB.id]);
      assert.equal(new Set(ids).size, ids.length, `ninguna dupla repetida en ${r.fase}`);
    }
    e = jugarFase(e);
  }
  // Cuartos: siempre un ganador del A contra uno del B.
  const cuartos = e.rondas.find((r) => r.fase === "CUARTOS")!.partidos;
  assert.equal(cuartos.length, 4);
  for (const p of cuartos) assert.notEqual(p.parejaA.id[0], p.parejaB.id[0]);
  assert.equal(e.estado, "FINALIZADO");
  const top = podio(e);
  assert.equal(top[0].pareja.id, "A1");
  assert.equal(top[1].lugar, 2);
  assert.equal(top.filter((x) => x.lugar === 3).length, 2, "sin 3er puesto, los dos semifinalistas comparten el 3º");
  assert.deepEqual(validarEvento(e), []);
});

test("cuartos y semis directo usan los cruces A contra B y separan a los primeros", () => {
  for (const [inicio, esperado] of [
    ["CUARTOS", ["1A-4B", "2B-3A", "1B-4A", "2A-3B"]],
    ["SEMIS", ["1A-2B", "1B-2A"]],
  ] as const) {
    const { llave, grupos } = crearHabibi(input(6, inicio));
    const armada = armarLlave(llave, grupos.map(jugarGrupo));
    assert.equal(armada.rondas[0].fase, inicio);
    assert.deepEqual(
      armada.rondas[0].partidos.map((p) => `${semillaDe(armada, p.parejaA.id)}-${semillaDe(armada, p.parejaB.id)}`),
      esperado,
    );
    // Solo viajan a la llave las duplas clasificadas.
    assert.equal(armada.parejas.length, inicio === "CUARTOS" ? 8 : 4);
  }
});

test("las opciones de inicio dependen del grupo más chico", () => {
  assert.deepEqual(iniciosPosibles(8), ["OCTAVOS", "CUARTOS", "SEMIS"]);
  assert.deepEqual(iniciosPosibles(5), ["CUARTOS", "SEMIS"]);
  assert.deepEqual(iniciosPosibles(3), ["SEMIS"]);
  assert.ok(erroresHabibi(input(6, "OCTAVOS")).some((m) => m.includes("8 duplas")));
  assert.deepEqual(erroresHabibi(input(6, "CUARTOS")), []);
});

test("3er puesto con los perdedores de semis y final con reglas propias", () => {
  const sets: ConfigPuntuacion = { metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3, puntoDeOro: true };
  const { llave, grupos } = crearHabibi(input(4, "SEMIS", { tercerPuesto: true, puntuacionFinal: sets }));
  assert.deepEqual(llave.rondas.map((r) => r.fase), ["SEMIS", "TERCER_PUESTO", "FINAL"]);
  let e = armarLlave(llave, grupos.map(jugarGrupo));
  e = jugarFase(e);
  const tercero = e.rondas.find((r) => r.fase === "TERCER_PUESTO")!.partidos[0];
  assert.deepEqual([tercero.parejaA.id, tercero.parejaB.id], ["B2", "B1"]);
  const final = e.rondas.find((r) => r.fase === "FINAL")!;
  assert.equal(final.puntuacion?.metodo, "SETS_CORTOS");
  // La final valida con sus propias reglas.
  e = cargarResultadoLlave(e, final.partidos[0].id, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 4, b: 1 }] });
  e = cargarResultadoLlave(e, tercero.id, { puntosA: 10, puntosB: 6 });
  assert.deepEqual(validarEvento(e), []);
  assert.equal(e.estado, "FINALIZADO");
  assert.deepEqual(podio(e).map((x) => `${x.lugar}:${x.pareja.id}`), ["1:A1", "2:A2", "3:B2"]);
});

test("empate en la llave: se define con el punto de oro de desempate", () => {
  const r = normalizarResultado(A16, { puntosA: 8, puntosB: 8, desempate: "B" });
  assert.equal(ganador(A16, r), -1);
  assert.equal(validarResultado(A16, r), null);
  // Si el marcador no está igualado, el desempate se ignora.
  assert.equal(normalizarResultado(A16, { puntosA: 9, puntosB: 7, desempate: "B" }).desempate, undefined);
  const { llave, grupos } = crearHabibi(input(2, "SEMIS"));
  let e = armarLlave(llave, grupos.map(jugarGrupo));
  const semi = e.rondas[0].partidos[0];
  e = cargarResultadoLlave(e, semi.id, { puntosA: 8, puntosB: 8 });
  assert.equal(e.rondas.find((x) => x.fase === "FINAL")!.partidos.length, 0, "empate sin definir no avanza a nadie");
  e = cargarResultadoLlave(e, semi.id, { puntosA: 8, puntosB: 8, desempate: "B" });
  e = cargarResultadoLlave(e, e.rondas[0].partidos[1].id, { puntosA: 9, puntosB: 7 });
  const final = e.rondas.find((x) => x.fase === "FINAL")!.partidos[0];
  assert.equal(final.parejaA.id, semi.parejaB.id);
});

test("corregir un marcador anterior cambia quién avanza y limpia lo que dependía de él", () => {
  const { llave, grupos } = crearHabibi(input(4, "CUARTOS"));
  let e = armarLlave(llave, grupos.map(jugarGrupo));
  e = jugarFase(e); // cuartos
  e = jugarFase(e); // semis
  const semi1 = e.rondas.find((r) => r.fase === "SEMIS")!.partidos[0];
  assert.ok(semi1.resultado);
  // Se corrige el primer cuarto: ahora gana 4B en vez de 1A.
  const q1 = e.rondas[0].partidos[0];
  e = cargarResultadoLlave(e, q1.id, { puntosA: 3, puntosB: 13 });
  const semiNueva = e.rondas.find((r) => r.fase === "SEMIS")!.partidos[0];
  assert.equal(semiNueva.parejaA.id, "B4");
  assert.equal(semiNueva.resultado, null, "la semi con otra dupla vuelve a pendiente");
  assert.equal(e.rondas.find((r) => r.fase === "FINAL")!.partidos.length, 0);
  // Borrar un resultado también retrocede.
  e = borrarResultadoLlave(e, q1.id);
  assert.equal(e.rondas.find((r) => r.fase === "SEMIS")!.partidos.length, 1);
});

test("dos celulares cargando partidos distintos de la llave no se pisan", () => {
  const { llave, grupos } = crearHabibi(input(4, "CUARTOS"));
  const base = armarLlave(llave, grupos.map(jugarGrupo));
  const [p1, p2] = base.rondas[0].partidos;
  const cel1 = cargarResultadoLlave(base, p1.id, { puntosA: 10, puntosB: 6 });
  const cel2 = cargarResultadoLlave(base, p2.id, { puntosA: 6, puntosB: 10 });
  const unida = fusionarEventos(cel1, cel2);
  const r = unida.rondas[0].partidos;
  assert.ok(r[0].resultado && r[1].resultado);
});

test("no se arma la llave si un grupo se quedó sin duplas suficientes", () => {
  const { llave, grupos } = crearHabibi(input(4, "CUARTOS"));
  const conRetiro = { ...grupos[1], parejas: grupos[1].parejas.map((p, i) => (i === 0 ? { ...p, retirada: true } : p)) };
  assert.match(bloqueoArmar(llave, [grupos[0], conRetiro]) ?? "", /grupo B tiene 3 duplas/);
  assert.equal(bloqueoArmar(llave, grupos), null);
});

test("dos celulares cargan los dos octavos de un mismo cuarto: al unir, el cuarto queda armado", () => {
  const { llave, grupos } = crearHabibi(input());
  const base = armarLlave(llave, grupos.map(jugarGrupo));
  const [o1, o2] = base.rondas[0].partidos;
  const cel1 = cargarResultadoLlave(base, o1.id, { puntosA: 10, puntosB: 6 });
  const cel2 = cargarResultadoLlave(base, o2.id, { puntosA: 6, puntosB: 10 });
  const unida = fusionarLlave(fusionarEventos(cel1, cel2));
  const cuarto = unida.rondas.find((r) => r.fase === "CUARTOS")!.partidos[0];
  assert.ok(cuarto, "el cuarto 1 tiene sus dos duplas");
  assert.deepEqual([cuarto.parejaA.id, cuarto.parejaB.id], [o1.parejaA.id, o2.parejaB.id]);
});

test("rehacer la llave no resucita resultados viejos al sincronizar con otro celular", async () => {
  const { llave, grupos } = crearHabibi(input(4, "SEMIS"));
  const jugados = grupos.map(jugarGrupo);
  const vieja = jugarFase(armarLlave(llave, jugados));
  assert.ok(vieja.rondas[0].partidos.every((p) => p.resultado));
  await new Promise((r) => setTimeout(r, 5));
  const nueva = armarLlave(vieja, jugados);
  const unida = fusionarLlave(fusionarEventos(vieja, nueva));
  assert.ok(unida.rondas[0].partidos.every((p) => !p.resultado), "la llave rehecha queda en blanco");
  assert.equal(unida.rondas.find((r) => r.fase === "FINAL")!.partidos.length, 0);
});

/* ---------- grupos individuales ---------- */

/** Jugadores sueltos con nombres que ordenan igual que su número (A01, A02…). */
function sueltos(letra: string, n: number, mixto = false): Jugador[] {
  return Array.from({ length: n }, (_, i) => {
    const id = `${letra}${String(i + 1).padStart(2, "0")}`;
    return { id, nombre: id, genero: mixto && i % 2 === 1 ? ("F" as const) : ("M" as const) };
  });
}

function inputIndividual(n = 16, extra: Partial<NuevoHabibiInput> = {}, mixto = false): NuevoHabibiInput {
  const base = input(8, "OCTAVOS", extra);
  return {
    ...base,
    modalidad: "INDIVIDUAL_ROTATIVO",
    categoria: { rama: mixto ? "MIXTO" : "MASCULINO", nivel: "5TA" },
    grupos: base.grupos.map((g, i) => ({ ...g, parejas: [], jugadores: sueltos(i ? "B" : "A", n, mixto) })),
    ...extra,
  };
}

test("individual: crea grupos rotativos sin duplas y valida la cantidad de jugadores", () => {
  const { llave, grupos } = crearHabibi(inputIndividual());
  assert.equal(grupos.length, 2);
  for (const g of grupos) {
    assert.equal(g.modalidad, "INDIVIDUAL_ROTATIVO");
    assert.equal(g.parejas.length, 0);
    assert.equal(g.jugadores.length, 16);
    assert.ok(g.rondas.length > 0);
  }
  const info = llave.habibi;
  assert.ok(info?.rol === "LLAVE" && info.emparejar === "EQUILIBRADO");
  assert.deepEqual(erroresHabibi(inputIndividual()), []);
  // Para octavos hacen falta 16 jugadores por grupo (8 duplas).
  assert.ok(erroresHabibi(inputIndividual(12)).some((e) => e.includes("16 jugadores")));
  assert.deepEqual(erroresHabibi(inputIndividual(12, { inicio: "CUARTOS" })), []);
  assert.ok(erroresHabibi(inputIndividual(3, { inicio: "SEMIS" })).some((e) => e.includes("al menos 4 jugadores")));
});

test("individual: las duplas de la llave salen del ranking (equilibradas o por orden)", () => {
  const { grupos } = crearHabibi(inputIndividual());
  const [a] = grupos;
  // Sin partidos jugados el ranking queda por nombre: A01, A02… A16.
  const eq = duplasDeGrupo(a, 8, "EQUILIBRADO").map((p) => p.jugadorIds.join("+"));
  assert.deepEqual(eq.slice(0, 2), ["A01+A16", "A02+A15"]);
  assert.equal(eq[7], "A08+A09");
  const orden = duplasDeGrupo(a, 8, "POR_ORDEN").map((p) => p.jugadorIds.join("+"));
  assert.deepEqual(orden.slice(0, 2), ["A01+A02", "A03+A04"]);
  // Cuartos: solo pasan los 8 mejores.
  assert.deepEqual(
    duplasDeGrupo(a, 4, "EQUILIBRADO").map((p) => p.jugadorIds.join("+")),
    ["A01+A08", "A02+A07", "A03+A06", "A04+A05"],
  );
});

test("individual mixto: cada dupla de la llave es hombre + mujer", () => {
  const { grupos } = crearHabibi(inputIndividual(16, {}, true));
  const porId = new Map(grupos[0].jugadores.map((j) => [j.id, j]));
  const duplas = duplasDeGrupo(grupos[0], 8, "EQUILIBRADO");
  assert.equal(duplas.length, 8);
  for (const d of duplas) assert.deepEqual(d.jugadorIds.map((id) => porId.get(id)!.genero).sort(), ["F", "M"]);
  // Mejor hombre con la mujer que pasa última.
  assert.deepEqual(duplas[0].jugadorIds, ["A01", "A16"]);
  // Con menos de 8 mujeres no alcanza para octavos.
  const pocas = inputIndividual(16, {}, true);
  pocas.grupos[0].jugadores = pocas.grupos[0].jugadores.map((j, i) => (i < 4 ? j : { ...j, genero: "M" as const }));
  assert.ok(erroresHabibi(pocas).some((e) => e.includes("8 hombres y 8 mujeres")));
});

test("individual: se arma la llave completa sin repetir jugadores y con la hoja de cruces", () => {
  const { llave, grupos } = crearHabibi(inputIndividual());
  const jugados = grupos.map((g) => {
    let e = g;
    for (const r of g.rondas) for (const p of r.partidos) e = cargarResultado(e, p.id, { puntosA: 9, puntosB: 7 });
    return e;
  });
  assert.equal(bloqueoArmar(llave, jugados), null);
  const armada = armarLlave(llave, jugados);
  assert.equal(armada.parejas.length, 16);
  const ids = armada.parejas.flatMap((p) => p.jugadorIds);
  assert.equal(new Set(ids).size, 32, "ningún jugador está en dos duplas");
  for (const p of armada.parejas) assert.equal(new Set(p.jugadorIds.map((id) => id[0])).size, 1, "cada dupla es de un solo grupo");
  const primero = cruces(armada)[0];
  assert.equal(semillaDe(armada, primero.parejaA!.id), "1A");
  assert.equal(semillaDe(armada, primero.parejaB!.id), "3A");
  assert.deepEqual(validarEvento(armada), []);
});
