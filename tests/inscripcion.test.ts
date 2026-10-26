import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aperturaInscripcion,
  configInscripcionBase,
  confirmarEnTorneo,
  crearInscripcion,
  csvInscripciones,
  cuposCategorias,
  enlaceWhatsapp,
  estadoInicial,
  resumenInscripciones,
  validarInscripcion,
  type EntradaInscripcion,
} from "../lib/inscripcion.ts";
import { catMaster, catNivel } from "../lib/torneo/categorias.ts";
import { configurarCategoria, crearTorneo, inscribirDupla } from "../lib/torneo/torneo.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";
import type { AtletaFvp } from "../types/ranking.ts";
import type { Torneo } from "../types/torneo.ts";

const HOY = "2026-11-20";

function torneo(cambios: Partial<NonNullable<Torneo["inscripcion"]>> = {}): Torneo {
  const t = crearTorneo({
    nombre: "Copa Navidad",
    dias: [{ fecha: "2026-12-14", inicio: "08:00", fin: "22:00" }],
    canchas: CLUB_POR_DEFECTO.pistas,
    categorias: [catNivel("MASCULINO", "5TA"), catNivel("MIXTO", "6TA"), catMaster("MASCULINO", 45)],
  });
  return { ...t, inscripcion: { ...configInscripcionBase(), abierta: true, precioDupla: 140, cierre: "2026-12-10", ...cambios } };
}

const jug = (n: number, extra: Record<string, unknown> = {}) => ({
  nombre: `carlos${n}`,
  apellido: "MENDOZA",
  cedula: `V-18.456.${String(700 + n)}`,
  correo: `c${n}@correo.com`,
  telefono: "0414 123 4567",
  genero: "M",
  talla: "M",
  lado: "DRIVE",
  alergias: "Ninguna",
  ...extra,
});

const entrada = (e: Partial<EntradaInscripcion> = {}): EntradaInscripcion => ({ categoriaId: "M-5TA", jugadores: [jug(1), jug(2)], aceptaReglamento: true, ...e });

test("inscripción válida: normaliza nombres, cédula y teléfono", () => {
  const v = validarInscripcion(torneo(), entrada(), [], null, HOY);
  assert.deepEqual(v.errores, []);
  assert.equal(v.jugadores[0].nombre, "Carlos1");
  assert.equal(v.jugadores[0].apellido, "Mendoza");
  assert.equal(v.jugadores[0].cedula, "V-18456701");
  assert.equal(v.jugadores[0].telefono, "+584141234567");
});

test("cerrada, vencida o torneo ya programado: no deja inscribir", () => {
  assert.equal(aperturaInscripcion(torneo({ abierta: false }), HOY).abierta, false);
  assert.equal(aperturaInscripcion(torneo(), "2026-12-11").abierta, false);
  assert.equal(aperturaInscripcion(torneo(), "2026-12-10").abierta, true);
  assert.equal(aperturaInscripcion({ ...torneo(), estado: "PROGRAMADO" }, HOY).abierta, false);
});

test("faltan datos: dice qué falta de cada jugador", () => {
  const v = validarInscripcion(torneo(), entrada({ jugadores: [jug(1, { correo: "malo", talla: null }), jug(2, { alergias: "" })] }), [], null, HOY);
  assert.ok(v.errores.some((e) => e.startsWith("Jugador 1: Correo")));
  assert.ok(v.errores.some((e) => e.startsWith("Jugador 1: Elige la talla")));
  assert.ok(v.errores.some((e) => e.startsWith("Jugador 2:") && e.includes("Ninguna")));
});

test("sin talla si el torneo no regala franela", () => {
  const v = validarInscripcion(torneo({ pideTalla: false }), entrada({ jugadores: [jug(1, { talla: null }), jug(2, { talla: null })] }), [], null, HOY);
  assert.deepEqual(v.errores, []);
});

test("reglas de categoría: mixto pide hombre y mujer, master pide edad", () => {
  assert.ok(validarInscripcion(torneo(), entrada({ categoriaId: "X-6TA" }), [], null, HOY).errores.some((e) => e.includes("Mixto")));
  assert.deepEqual(validarInscripcion(torneo(), entrada({ categoriaId: "X-6TA", jugadores: [jug(1), jug(2, { genero: "F" })] }), [], null, HOY).errores, []);
  assert.ok(validarInscripcion(torneo(), entrada({ categoriaId: "M-MASTER45" }), [], null, HOY).errores.some((e) => e.includes("fecha de nacimiento")));
  const jovenes = [jug(1, { fechaNacimiento: "1990-01-01" }), jug(2, { fechaNacimiento: "1970-01-01" })] as [unknown, unknown];
  assert.ok(validarInscripcion(torneo(), entrada({ categoriaId: "M-MASTER45", jugadores: jovenes }), [], null, HOY).errores.some((e) => e.includes("Master +45")));
});

test("misma cédula dos veces o ya inscrito: se rechaza", () => {
  assert.ok(validarInscripcion(torneo(), entrada({ jugadores: [jug(1), jug(1)] }), [], null, HOY).errores.some((e) => e.includes("misma cédula")));
  const t = torneo();
  const v = validarInscripcion(t, entrada(), [], null, HOY);
  const previa = crearInscripcion(t, entrada(), v.jugadores, v.fvp);
  assert.ok(validarInscripcion(t, entrada({ jugadores: [jug(1), jug(3)] }), [previa], null, HOY).errores.some((e) => e.includes("ya está inscrito")));
  // Rechazada: libera a los jugadores.
  assert.deepEqual(validarInscripcion(t, entrada({ jugadores: [jug(1), jug(3)] }), [{ ...previa, estado: "RECHAZADA" }], null, HOY).errores, []);
});

test("cupo lleno: cuenta duplas del torneo y las inscripciones en curso", () => {
  let t = configurarCategoria(torneo(), "M-5TA", { cupo: 2 });
  t = inscribirDupla(t, "M-5TA", { id: "a", nombre: "A", genero: "M" }, { id: "b", nombre: "B", genero: "M" });
  const v = validarInscripcion(t, entrada(), [], null, HOY);
  const previa = crearInscripcion(t, entrada(), v.jugadores, v.fvp);
  const cupo = cuposCategorias(t, [previa]).find((c) => c.id === "M-5TA")!;
  assert.equal(cupo.ocupados, 2);
  assert.ok(validarInscripcion(t, entrada({ jugadores: [jug(5), jug(6)] }), [previa], null, HOY).errores.some((e) => e.includes("No quedan cupos")));
});

test("ranking FVP: no deja jugar por debajo de su categoría; quien no aparece igual se inscribe", () => {
  const atleta: AtletaFvp = { clave: "18456701", cedula: "V-18456701", nombre: "CARLOS MENDOZA", genero: "M", categoria: "3RA", puntos: 500 };
  const buscar = (c: string) => (c.endsWith("18456701") ? atleta : null);
  const v = validarInscripcion(torneo(), entrada(), [], buscar, HOY);
  assert.ok(v.errores.some((e) => e.includes("es 3ra en el ranking FVP")));
  const ok = validarInscripcion(torneo(), entrada({ jugadores: [jug(3), jug(2)] }), [], buscar, HOY);
  assert.deepEqual(ok.errores, []);
  assert.deepEqual(ok.fvp, [null, null]);
});

test("estado inicial: con referencia o comprobante queda por verificar", () => {
  const t = torneo();
  assert.equal(estadoInicial(t, entrada()), "PENDIENTE_PAGO");
  assert.equal(estadoInicial(t, entrada({ pago: { metodoId: "pm", referencia: "123456" } })), "PAGO_REPORTADO");
  assert.equal(estadoInicial(t, entrada({ pago: { metodoId: "efectivo" } })), "PENDIENTE_PAGO");
  assert.equal(estadoInicial(t, entrada({ pago: { metodoId: "zelle" }, comprobante: true })), "PAGO_REPORTADO");
  assert.equal(estadoInicial(torneo({ precioDupla: 0 }), entrada()), "PAGO_REPORTADO");
});

test("confirmar: la dupla entra al torneo y reusa al jugador con la misma cédula", () => {
  let t = torneo();
  t = inscribirDupla(t, "X-6TA", { id: "j-viejo", nombre: "Carlos1", apellido: "Mendoza", genero: "M", cedula: "V-18456701", fotoUrl: "/f.jpg" }, { id: "f", nombre: "Ana", genero: "F" });
  const v = validarInscripcion(t, entrada(), [], null, HOY);
  const insc = crearInscripcion(t, entrada(), v.jugadores, v.fvp);
  const { torneo: out, duplaId } = confirmarEnTorneo(t, insc, null);
  const d = out.categorias.find((c) => c.categoria.id === "M-5TA")!.duplas.find((x) => x.id === duplaId)!;
  assert.equal(d.jugadorIds[0], "j-viejo");
  assert.equal(out.jugadores.find((j) => j.id === "j-viejo")!.fotoUrl, "/f.jpg");
  assert.equal(out.jugadores.length, 3);
});

test("resumen y CSV: tallas, alergias y dinero", () => {
  const t = torneo();
  const v = validarInscripcion(t, entrada({ jugadores: [jug(1, { talla: "L", alergias: "Maní" }), jug(2)] }), [], null, HOY);
  const a = { ...crearInscripcion(t, entrada(), v.jugadores, v.fvp), estado: "CONFIRMADA" as const };
  const r = resumenInscripciones([a], t.inscripcion);
  assert.equal(r.tallas.L, 1);
  assert.equal(r.tallas.M, 1);
  assert.deepEqual(r.alergias, [{ nombre: "Carlos1 Mendoza", alergias: "Maní" }]);
  assert.equal(r.cobrado, 140);
  const csv = csvInscripciones(t, [a]);
  assert.ok(csv.startsWith("﻿Código;Estado;"));
  assert.ok(csv.includes("Confirmada;5ta Masculino"));
});

test("WhatsApp: acepta números venezolanos en cualquier formato", () => {
  assert.equal(enlaceWhatsapp("0414-123.45.67"), "https://wa.me/584141234567");
  assert.equal(enlaceWhatsapp("+58 414 1234567", "Hola"), "https://wa.me/584141234567?text=Hola");
});
