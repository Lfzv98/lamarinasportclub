/**
 * Reglas de la programación que pidió el club (La Marina, Venezuela):
 * nunca un partido repetido, cada dupla con todos sus partidos, nadie en dos partidos a la vez,
 * duplas que rotan de pista, y la categoría máxima de noche en la pista principal (Pista 1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catMaster, catNivel } from "../lib/torneo/categorias.ts";
import { categoriasEstelares, programarTorneo } from "../lib/torneo/programacion.ts";
import { crearTorneo, inscribirDupla, publicarCategoria, reglasDe, sortearCategoria } from "../lib/torneo/torneo.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";
import type { CategoriaTorneo, JugadorTorneo, PartidoTorneo, Torneo } from "../types/torneo.ts";

const jug = (id: string, genero: "M" | "F" = "M"): JugadorTorneo => ({ id, nombre: id, apellido: id.toUpperCase(), genero });
const DIAS = [
  { fecha: "2026-12-04", inicio: "16:00", fin: "23:00" },
  { fecha: "2026-12-05", inicio: "08:00", fin: "23:00" },
  { fecha: "2026-12-06", inicio: "08:00", fin: "20:00" },
];

/** Torneo tipo diciembre: 5 categorías, 45 duplas, 5 pistas, y jugadores que se anotan en dos categorías. */
function torneoDiciembre(semilla = 7): Torneo {
  const cats: [CategoriaTorneo, number, "M" | "F" | "X"][] = [
    [catNivel("MASCULINO", "1RA"), 8, "M"],
    [catNivel("MASCULINO", "4TA"), 12, "M"],
    [catNivel("FEMENINO", "5TA"), 10, "F"],
    [catNivel("MIXTO", "6TA"), 9, "X"],
    [catMaster("MASCULINO", 45), 6, "M"],
  ];
  let t = crearTorneo({ nombre: "Copa Navidad", dias: DIAS, canchas: CLUB_POR_DEFECTO.pistas, categorias: cats.map((c) => c[0]) });
  for (const [c, n, g] of cats) {
    const id = c.id;
    for (let i = 1; i <= n; i++) {
      // Los de la Master +45 también juegan 4ta: comparten jugadores entre categorías.
      const a = id.startsWith("M-MASTER") && i <= 3 ? jug(`M-4TA-a${i}`) : jug(`${id}-a${i}`, g === "F" ? "F" : "M");
      const b = jug(`${id}-b${i}`, g === "M" ? "M" : "F");
      t = inscribirDupla(t, id, a, b, { id: `${id}-d${i}`, puntos: 2000 - i * 10 });
    }
    t = sortearCategoria(t, id, { semilla });
    t = publicarCategoria(t, id);
  }
  return t;
}

const todos = (t: Torneo) => t.categorias.flatMap((c) => c.cuadro?.partidos ?? []);
const jugadores = (t: Torneo, p: PartidoTorneo) => [p.duplaA, p.duplaB].flatMap((d) => t.categorias.flatMap((c) => c.duplas).find((x) => x.id === d)?.jugadorIds ?? []);
const minutos = (t: Torneo, p: PartidoTorneo) => {
  const d = t.dias.findIndex((x) => x.fecha === p.programacion!.fecha);
  const [h, m] = p.programacion!.hora.split(":").map(Number);
  return d * 1440 + h * 60 + m;
};

for (const semilla of [1, 7, 42]) {
  test(`(semilla ${semilla}) ningún partido repetido y cada dupla con todos sus partidos de grupo`, () => {
    const t = programarTorneo(torneoDiciembre(semilla)).torneo;
    const ps = todos(t);
    assert.equal(new Set(ps.map((p) => p.id)).size, ps.length, "ids de partido únicos");
    for (const c of t.categorias) {
      for (const g of c.cuadro!.grupos) {
        const deGrupo = c.cuadro!.partidos.filter((p) => p.fase === "GRUPOS" && p.grupoId === g.id);
        const cruces = deGrupo.map((p) => [p.duplaA, p.duplaB].sort().join(" vs "));
        assert.equal(new Set(cruces).size, cruces.length, `cruce repetido en ${c.categoria.id} grupo ${g.nombre}`);
        // Todos contra todos: n·(n−1)/2 partidos y n−1 por dupla.
        const n = g.duplaIds.length;
        assert.equal(deGrupo.length, (n * (n - 1)) / 2, `${c.categoria.id} grupo ${g.nombre} completo`);
        for (const d of g.duplaIds) assert.equal(deGrupo.filter((p) => p.duplaA === d || p.duplaB === d).length, n - 1, `${d} juega con todos`);
      }
    }
  });

  test(`(semilla ${semilla}) todo entra, nadie juega dos a la vez y se respeta el descanso`, () => {
    const r = programarTorneo(torneoDiciembre(semilla));
    const t = r.torneo;
    const jugables = todos(t).filter((p) => !p.bye && p.duplaA && p.duplaB);
    assert.deepEqual(r.sinLugar, [], "todos los partidos tienen horario");
    const dur = (p: PartidoTorneo) => reglasDe(t, p).minutos;
    // Una pista, un partido a la vez.
    const porPista = new Map<number, PartidoTorneo[]>();
    for (const p of todos(t).filter((x) => x.programacion)) porPista.set(p.programacion!.pista, [...(porPista.get(p.programacion!.pista) ?? []), p]);
    for (const [pista, lista] of porPista) {
      const orden = lista.sort((a, b) => minutos(t, a) - minutos(t, b));
      for (let i = 1; i < orden.length; i++) assert.ok(minutos(t, orden[i]) >= minutos(t, orden[i - 1]) + dur(orden[i - 1]), `pista ${pista} con dos partidos a la vez`);
    }
    // Ningún jugador (aunque esté en dos categorías) en dos partidos sin el descanso mínimo.
    const porJugador = new Map<string, PartidoTorneo[]>();
    for (const p of jugables) for (const j of jugadores(t, p)) porJugador.set(j, [...(porJugador.get(j) ?? []), p]);
    for (const [j, lista] of porJugador) {
      const orden = lista.sort((a, b) => minutos(t, a) - minutos(t, b));
      for (let i = 1; i < orden.length; i++)
        assert.ok(minutos(t, orden[i]) >= minutos(t, orden[i - 1]) + dur(orden[i - 1]) + t.descansoMin, `${j} juega ${orden[i - 1].id} y ${orden[i].id} sin descanso`);
    }
  });

  test(`(semilla ${semilla}) las duplas rotan de pista`, () => {
    const t = programarTorneo(torneoDiciembre(semilla)).torneo;
    const estelares = new Set(categoriasEstelares(t));
    const pistas = new Map<string, number[]>();
    for (const p of todos(t).filter((x) => x.fase === "GRUPOS" && x.programacion && !estelares.has(x.categoriaId)))
      for (const d of [p.duplaA!, p.duplaB!]) pistas.set(d, [...(pistas.get(d) ?? []), p.programacion!.pista]);
    // Con 3 o más partidos nadie repite siempre pista; con 2 (grupos de 3) se tolera alguna si la
    // única pista libre a esa hora era la misma (esperar por otra pista atrasaría el torneo).
    const siempreIgual = (min: number) => [...pistas].filter(([, ps]) => ps.length >= min && new Set(ps).size === 1).map(([d]) => d);
    assert.deepEqual(siempreIgual(3), [], "ninguna dupla juega siempre en la misma pista");
    const conDos = [...pistas].filter(([, ps]) => ps.length === 2).length;
    assert.ok(siempreIgual(2).length <= Math.ceil(conDos * 0.15), `pocas duplas de grupos de 3 repiten pista (${siempreIgual(2).length}/${conDos})`);
  });
}

test("la categoría máxima (1ra) va de noche en la pista principal", () => {
  const t = programarTorneo(torneoDiciembre()).torneo;
  assert.deepEqual(categoriasEstelares(t), ["M-1RA"]);
  const primera = todos(t).filter((p) => p.categoriaId === "M-1RA" && p.fase === "GRUPOS");
  const deNoche = primera.filter((p) => p.programacion!.hora >= "19:00");
  assert.equal(deNoche.length, primera.length, "todos los partidos de grupo de 1ra de noche");
  // A cada hora de noche, uno de sus partidos va en la Pista 1.
  for (const h of new Set(primera.map((p) => `${p.programacion!.fecha} ${p.programacion!.hora}`)))
    assert.ok(primera.some((p) => `${p.programacion!.fecha} ${p.programacion!.hora}` === h && p.programacion!.pista === 1), `a las ${h} la 1ra está en Pista 1`);
  // La final de 1ra cierra el torneo en la Pista 1.
  const final = todos(t).find((p) => p.categoriaId === "M-1RA" && p.etiqueta === "Final")!;
  assert.equal(final.programacion!.pista, 1);
  const ultimo = todos(t).filter((p) => p.programacion).reduce((a, p) => Math.max(a, minutos(t, p)), 0);
  assert.equal(minutos(t, final), ultimo, "la final de 1ra es el último partido del torneo");
  // Las otras categorías no le quitan la Pista 1 de noche.
  const intrusos = todos(t).filter((p) => p.categoriaId !== "M-1RA" && p.programacion?.pista === 1 && p.programacion.hora >= "19:00" && p.fase === "GRUPOS");
  assert.deepEqual(intrusos.map((p) => p.id), []);
});

test("las jornadas de cada grupo van en orden", () => {
  for (const semilla of [1, 7, 42]) {
    const t = programarTorneo(torneoDiciembre(semilla)).torneo;
    for (const c of t.categorias)
      for (const g of c.cuadro!.grupos) {
        const ps = c.cuadro!.partidos.filter((p) => p.grupoId === g.id && p.programacion);
        for (const a of ps) for (const b of ps) if (a.ronda < b.ronda) assert.ok(minutos(t, a) <= minutos(t, b), `${c.categoria.id} ${a.etiqueta} antes que ${b.etiqueta}`);
      }
  }
});

test("la categoría estelar se puede elegir o apagar", () => {
  const base = torneoDiciembre();
  assert.deepEqual(categoriasEstelares({ ...base, horarioEstelar: null }), []);
  assert.deepEqual(categoriasEstelares({ ...base, horarioEstelar: { categorias: ["F-5TA"], desde: "20:00" } }), ["F-5TA"]);
  const t = programarTorneo({ ...base, horarioEstelar: { categorias: ["F-5TA"], desde: "20:00" } }).torneo;
  const f = todos(t).filter((p) => p.categoriaId === "F-5TA" && p.fase === "GRUPOS");
  assert.ok(f.filter((p) => p.programacion!.hora >= "20:00").length >= f.length * 0.6);
  // Apagado: la 1ra juega cuando le toque, sin reservar la noche.
  const sin = programarTorneo({ ...base, horarioEstelar: null }).torneo;
  assert.ok(todos(sin).some((p) => p.categoriaId === "M-1RA" && p.programacion && p.programacion.hora < "19:00"));
});
