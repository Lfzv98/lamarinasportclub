/** Estadísticas por dupla estilo transmisión (Premier Padel): winners, errores, remates, saque, breaks, puntos de oro. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { filasComparativa, porDupla } from "../lib/torneo/estadisticas.ts";
import { anotarPunto, detallarUltimo, faltaSaque, nuevoMarcador, statsPartido } from "../lib/torneo/marcador.ts";
import type { ReglasPartido } from "../types/torneo.ts";

const reglas: ReglasPartido = { sets: 3, games: 6, tieBreakEn: 6, puntoDeOro: true, superTie: true, minutos: 90 };
const base = () => nuevoMarcador({ partidoId: "p", torneoId: "t", categoriaId: "c", reglas, jugadoresA: ["a1", "a2"], jugadoresB: ["b1", "b2"], sacaPrimero: "A", primerA: "a1", primerB: "b1" });

test("cada toque de la consola suma a la dupla y al jugador que corresponde", () => {
  let m = base();
  m = anotarPunto(m, "A", { fin: "WINNER", jugadorId: "a1" });
  m = detallarUltimo(m, { golpe: "X3" });
  m = anotarPunto(m, "A", { fin: "ERROR_NO_FORZADO", jugadorId: "b2" }); // error de B: punto de A
  m = anotarPunto(m, "B", { fin: "ERROR_FORZADO", jugadorId: "a2" });
  m = anotarPunto(m, "B", { fin: "WINNER", jugadorId: "b1" });
  m = detallarUltimo(m, { golpe: "VOLEA" });
  const s = statsPartido(m);
  const A = porDupla(s, "A");
  const B = porDupla(s, "B");
  assert.deepEqual([A.puntos, A.winners, A.enf, A.ef, A.remates], [2, 1, 0, 1, 1]);
  assert.deepEqual([B.puntos, B.winners, B.enf, B.ef, B.remates], [2, 1, 1, 0, 0]);
});

test("la comparativa sigue el orden de la transmisión y la versión corta deja las 6 de la TV", () => {
  let m = base();
  m = faltaSaque(m);
  m = anotarPunto(m, "A");
  const filas = filasComparativa(m);
  assert.deepEqual(filas.slice(0, 5).map((f) => f.t), ["Puntos ganados", "Winners", "Errores no forzados", "Errores forzados", "Remates ganadores"]);
  const saque = filas.find((f) => f.t === "1er saque dentro")!;
  assert.equal(saque.ta, "0%", "el primer saque fue falta");
  assert.equal(filasComparativa(m, true).length, 6);
  assert.ok(filas.find((f) => f.t === "Errores no forzados")!.menosEsMejor);
});
