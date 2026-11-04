/** Consola del árbitro en una sola pantalla: previa sin pasos, deshacer cualquier acción y cierre con cuenta regresiva. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { apilar, cambiarSacador, deshacerUno, elegirEnSorteo, faltaParaEmpezar, ganadorCierre, previaVacia, proximoDeshacer, retocar, sellar } from "../lib/torneo/consola.ts";
import { anotarPunto, calcularMarcador, detallarUltimo, faltaSaque, nuevoMarcador, pedirAtencion, sancionar } from "../lib/torneo/marcador.ts";
import type { MarcadorVivo, ReglasPartido } from "../types/torneo.ts";

const reglas: ReglasPartido = { sets: 3, games: 6, tieBreakEn: 6, puntoDeOro: true, superTie: true, minutos: 90 };
const nuevo = () => nuevoMarcador({ partidoId: "p", torneoId: "t", categoriaId: "c", reglas, jugadoresA: ["a1", "a2"], jugadoresB: ["b1", "b2"], sacaPrimero: "A", primerA: "a1", primerB: "b1" });
/** Cada acción con su propia hora, como en la tablet. */
let reloj = Date.parse("2026-11-04T10:00:00Z");
const hora = (m: MarcadorVivo): MarcadorVivo => ({ ...m, actualizadoEn: new Date((reloj += 1000)).toISOString() });
const nombre = (l: "A" | "B") => (l === "A" ? "Díaz / García" : "Castillo / Zambrano");

test("previa: dice qué falta en orden y queda lista con saque y primer sacador de cada dupla", () => {
  let p = previaVacia();
  assert.match(faltaParaEmpezar(p, nombre)!, /Saca primero/);
  p = { ...p, saca: "B" };
  assert.equal(faltaParaEmpezar(p, nombre), "Toca quién saca primero en Castillo / Zambrano");
  p = { ...p, primer: { A: null, B: "b2" } };
  assert.equal(faltaParaEmpezar(p, nombre), "Toca quién saca primero en Díaz / García");
  p = { ...p, primer: { A: "a1", B: "b2" } };
  assert.equal(faltaParaEmpezar(p, nombre), null);
});

test("previa: el sorteo resuelve el saque si el ganador eligió sacar o restar; si eligió lado, no lo toca", () => {
  const p = { ...previaVacia(), sorteo: { gana: "B" as const, eligio: null } };
  assert.equal(elegirEnSorteo(p, "SACAR").saca, "B");
  assert.equal(elegirEnSorteo(p, "RESTAR").saca, "A");
  assert.equal(elegirEnSorteo({ ...p, saca: "A" }, "LADO").saca, "A");
  assert.deepEqual(elegirEnSorteo(p, "LADO").sorteo, { gana: "B", eligio: "LADO" });
  assert.equal(elegirEnSorteo(previaVacia(), "SACAR").saca, null, "sin ganador no hace nada");
});

test("cambiar sacador en el 1er set corrige el orden inicial de esa dupla y nada más", () => {
  const m = nuevo();
  assert.equal(calcularMarcador(m).sacador, "a1");
  const c = cambiarSacador(m, "A");
  assert.deepEqual(c.ordenSaque, ["a2", "b1", "a1", "b2"]);
  assert.equal(calcularMarcador(c).sacador, "a2");
  assert.deepEqual(cambiarSacador(m, "B").ordenSaque, ["a1", "b2", "a2", "b1"]);
});

test("cambiar sacador desde el 2º set usa el cambio de orden FIP de ese set y no toca el 1º", () => {
  let m = nuevo();
  for (let i = 0; i < 24; i++) m = anotarPunto(m, "A"); // 6-0
  const e = calcularMarcador(m);
  assert.equal(e.setActual, 1);
  const antes = e.sacador;
  const c = cambiarSacador(m, e.equipoSaca);
  assert.deepEqual(c.ordenSaque, m.ordenSaque, "el orden inicial queda igual");
  assert.notEqual(calcularMarcador(c).sacador, antes);
  assert.deepEqual(calcularMarcador(c).sets[0], calcularMarcador(m).sets[0]);
});

test("deshacer vuelve atrás cualquier acción en orden: atención, sanción, punto y falta", () => {
  let pila: ReturnType<typeof apilar> = [];
  let m = hora(nuevo());
  const hacer = (n: MarcadorVivo, que: string) => {
    const s = hora(n);
    pila = apilar(pila, m, s, que);
    m = s;
  };
  hacer(faltaSaque(m), "Falta");
  hacer(anotarPunto(m, "A"), "Punto");
  hacer(sancionar(m, { lado: "B", motivo: "Demora en el juego" }).marcador, "Advertencia");
  hacer(pedirAtencion(m, "b1", "LESION"), "Atención médica");
  assert.equal(proximoDeshacer(pila, m), "Atención médica");

  const pasos: string[] = [];
  for (let r = deshacerUno(pila, m); r; r = deshacerUno(pila, m)) {
    assert.ok(r.m.actualizadoEn > m.actualizadoEn, "cada versión deshecha es más nueva para que el servidor la tome");
    pasos.push(r.que);
    pila = r.pila;
    m = r.m;
  }
  assert.deepEqual(pasos, ["Atención médica", "Advertencia", "Punto", "Falta"]);
  assert.equal(m.puntos.length, 0);
  assert.ok(!m.faltaPendiente);
  assert.equal(m.sanciones?.length ?? 0, 0);
  assert.equal(m.atenciones?.length ?? 0, 0);
  assert.equal(proximoDeshacer(pila, m), null);
});

test("el detalle del punto no suma un paso: deshacer quita el punto con su detalle", () => {
  let m = hora(nuevo());
  const p1 = hora(anotarPunto(m, "A"));
  let pila = apilar([], m, p1, "Punto");
  const d = hora(detallarUltimo(p1, { fin: "WINNER", jugadorId: "a1" }));
  pila = retocar(pila, p1, d);
  assert.equal(proximoDeshacer(pila, d), "Punto");
  const r = deshacerUno(pila, d)!;
  assert.equal(r.m.puntos.length, 0);
});

test("si el marcador cambió por fuera (otra tablet, recarga), deshacer quita el último punto", () => {
  let m = hora(nuevo());
  m = hora(anotarPunto(m, "A"));
  const pila = apilar([], nuevo(), hora(nuevo()), "viejo");
  m = hora(anotarPunto(m, "B"));
  assert.equal(proximoDeshacer(pila, m), "Último punto");
  const r = deshacerUno(pila, m)!;
  assert.equal(r.m.puntos.length, 1);
  assert.deepEqual(r.pila, []);
  assert.equal(deshacerUno([], hora(nuevo())), null, "sin nada que deshacer");
});

test("deshacer un punto que cerró el partido lo vuelve a abrir", () => {
  let m = hora(nuevo());
  for (let i = 0; i < 47; i++) m = anotarPunto(m, "A");
  m = hora(m);
  const fin = hora(anotarPunto(m, "A"));
  assert.ok(calcularMarcador(fin).terminado);
  const r = deshacerUno(apilar([], m, fin, "Punto"), { ...fin, finalizado: true })!;
  assert.equal(calcularMarcador(r.m).terminado, false);
  assert.equal(r.m.finalizado, false);
});

test("sellar: dos acciones en el mismo milisegundo quedan en orden", () => {
  const a = nuevo();
  const b = { ...anotarPunto(a, "A"), actualizadoEn: a.actualizadoEn };
  assert.ok(sellar(a, b).actualizadoEn > a.actualizadoEn);
  assert.equal(sellar(a, a), a);
});

test("cierre: ganador según retiro, descalificación o W.O.", () => {
  assert.equal(ganadorCierre({ tipo: "NORMAL" }, "B"), "B");
  assert.equal(ganadorCierre({ tipo: "RETIRO", seRetira: "A" }, null), "B");
  assert.equal(ganadorCierre({ tipo: "WO", noVino: "B" }, null), "A");
  assert.equal(ganadorCierre({ tipo: "DESCALIFICACION", descalificado: "B", marcador: nuevo() }, null), "A");
});
