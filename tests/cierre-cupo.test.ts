/** Cierre del torneo (automático y a mano) y cupo máximo por categoría. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarAccion } from "../lib/torneo/arbitraje.ts";
import { CONFIG_CUADRO_BASE, catNivel } from "../lib/torneo/categorias.ts";
import {
  borrarResultado,
  cerrarTorneo,
  crearTorneo,
  cupoLibre,
  fijarCupo,
  inscribirDupla,
  listoParaCerrar,
  marcarVisto,
  pendientesCierre,
  publicarCategoria,
  reabrirTorneo,
  sortearCategoria,
} from "../lib/torneo/torneo.ts";
import { programarTorneo } from "../lib/torneo/programacion.ts";
import { pasosTorneo } from "../lib/torneo/pasos.ts";
import { configInscripcionBase, cuposCategorias, validarInscripcion } from "../lib/inscripcion.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";
import type { JugadorTorneo, ResultadoTorneo, Torneo } from "../types/torneo.ts";

const jug = (id: string): JugadorTorneo => ({ id, nombre: id, apellido: id.toUpperCase(), genero: "M", cedula: `V-${1000 + id.length * 7 + id.charCodeAt(id.length - 1)}${id}` });
const cid = "M-4TA";
const gana = (g: "A" | "B"): ResultadoTorneo => ({ sets: g === "A" ? [{ a: 6, b: 3 }, { a: 6, b: 4 }] : [{ a: 3, b: 6 }, { a: 4, b: 6 }], ganador: g, tipo: "NORMAL" });

function base(): Torneo {
  let t = crearTorneo({ nombre: "Copa", dias: [{ fecha: "2026-12-05", inicio: "08:00", fin: "22:00" }], canchas: CLUB_POR_DEFECTO.pistas, categorias: [catNivel("MASCULINO", "4TA")] });
  for (let i = 1; i <= 4; i++) t = inscribirDupla(t, cid, jug(`a${i}`), jug(`b${i}`), { id: `d${i}`, puntos: 1000 - i });
  t = sortearCategoria(t, cid, { semilla: 3, por: "Staff", config: { ...CONFIG_CUADRO_BASE, formato: "ELIMINACION" } });
  t = publicarCategoria(t, cid, "Staff");
  return programarTorneo(t).torneo;
}
const jugables = (t: Torneo) => t.categorias[0].cuadro!.partidos.filter((p) => !p.bye);
/** Juega lo que se pueda con resultados del árbitro de pista (quedan por revisar). */
function jugarTodo(t: Torneo): Torneo {
  for (let vuelta = 0; vuelta < 5; vuelta++)
    for (const p of jugables(t)) if (p.estado !== "FINALIZADO" && p.duplaA && p.duplaB) t = aplicarAccion(t, p.id, { accion: "resultado", resultado: gana("A") }, "Árbitro José", "PISTA");
  return t;
}

test("el torneo se cierra solo cuando mesa técnica da Visto a la última final", () => {
  let t = jugarTodo(base());
  assert.equal(pendientesCierre(t).sinJugar, 0);
  assert.ok(pendientesCierre(t).porRevisar > 0);
  assert.equal(listoParaCerrar(t), false);
  assert.notEqual(t.estado, "FINALIZADO");
  const ids = jugables(t).map((p) => p.id);
  for (const id of ids.slice(0, -1)) t = aplicarAccion(t, id, { accion: "revisar" }, "Árbitro principal Carla", "MESA");
  assert.notEqual(t.estado, "FINALIZADO", "falta revisar la final");
  t = aplicarAccion(t, ids.at(-1)!, { accion: "revisar" }, "Árbitro principal Carla", "MESA");
  assert.equal(t.estado, "FINALIZADO");
  assert.equal(t.cerradoPor, "Automático");
  assert.ok(t.cerradoEn);
  assert.ok(t.historial?.some((h) => h.texto.includes("cerrado solo")));
  assert.equal(pasosTorneo(t)[6].estado, "HECHO");
});

test("el resultado del árbitro de pista no cierra el torneo: queda esperando revisión", () => {
  let t = base();
  for (const p of jugables(t)) if (p.duplaA && p.duplaB) t = aplicarAccion(t, p.id, { accion: "resultado", resultado: gana("A") }, "Staff", "MESA");
  // Semis por mesa (VISTO). La final la cierra el árbitro de pista.
  const fin = jugables(t).find((p) => p.estado !== "FINALIZADO")!;
  t = aplicarAccion(t, fin.id, { accion: "resultado", resultado: gana("B") }, "Árbitro José", "PISTA");
  assert.notEqual(t.estado, "FINALIZADO");
  t = aplicarAccion(t, fin.id, { accion: "revisar" }, "Staff", "MESA");
  assert.equal(t.estado, "FINALIZADO");
});

test("cerrar a mano, reabrir y borrar un resultado reabre", () => {
  let t = base();
  t = cerrarTorneo(t, "Luis");
  assert.equal(t.estado, "FINALIZADO");
  assert.equal(t.cerradoPor, "Luis");
  t = reabrirTorneo(t, "Luis");
  assert.equal(t.estado, "PROGRAMADO");
  assert.equal(t.cerradoEn, null);
  // Todo jugado y revisado → cerrado; borrar un resultado lo vuelve a abrir.
  t = jugarTodo(t);
  for (const p of jugables(t)) t = aplicarAccion(t, p.id, { accion: "revisar" }, "Staff", "MESA");
  assert.equal(t.estado, "FINALIZADO");
  t = borrarResultado(t, jugables(t).at(-1)!.id, "Staff");
  assert.equal(t.estado, "EN_JUEGO");
});

test("dos Visto seguidos no cambian nada (idempotente)", () => {
  let t = jugarTodo(base());
  const id = jugables(t)[0].id;
  t = marcarVisto(t, id, "Carla");
  const antes = t;
  const otra = marcarVisto(t, id, "Staff");
  assert.equal(otra, antes);
  assert.equal(jugables(otra)[0].revision?.por, "Carla");
});

test("cupo por categoría: se fija, bloquea la inscripción online al llenarse y queda en el historial", () => {
  let t = crearTorneo({ nombre: "Copa", dias: [{ fecha: "2026-12-05", inicio: "08:00", fin: "22:00" }], canchas: CLUB_POR_DEFECTO.pistas, categorias: [catNivel("MASCULINO", "4TA")] });
  t = { ...t, inscripcion: { ...configInscripcionBase(), abierta: true } };
  assert.equal(cupoLibre(t.categorias[0]), null);
  t = fijarCupo(t, cid, 2, "Luis");
  assert.equal(t.categorias[0].cupo, 2);
  assert.ok(t.historial?.some((h) => h.texto.includes("Cupo de")));
  t = inscribirDupla(t, cid, jug("a1"), jug("b1"));
  assert.equal(cupoLibre(t.categorias[0]), 1);
  t = inscribirDupla(t, cid, jug("a2"), jug("b2"));
  assert.equal(cupoLibre(t.categorias[0]), 0);
  assert.equal(cuposCategorias(t, [])[0].ocupados, 2);
  const persona = (n: string, c: string) => ({ nombre: n, apellido: "Pérez", cedula: c, correo: `${n}@correo.com`, telefono: "04141234567", genero: "M" as const, lado: "DRIVE" as const, alergias: "Ninguna", talla: "M" as const });
  const r = validarInscripcion(t, { categoriaId: cid, jugadores: [persona("Ana", "V-20111222"), persona("Beto", "V-20111333")], aceptaReglamento: true }, [], null);
  assert.ok(r.errores.some((e) => e.includes("No quedan cupos")), r.errores.join(" | "));
  // Límites: mínimo 2, máximo 128; null = sin límite.
  assert.equal(fijarCupo(t, cid, 1).categorias[0].cupo, 2);
  assert.equal(fijarCupo(t, cid, 500).categorias[0].cupo, 128);
  assert.equal(fijarCupo(t, cid, null).categorias[0].cupo, null);
});
