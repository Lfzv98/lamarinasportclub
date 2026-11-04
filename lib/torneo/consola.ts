/**
 * Consola del árbitro: la lógica pura de la pantalla única de la tablet de pista.
 *
 * - La previa (lados, quién saca, sorteo) se arma con toques sueltos en cualquier orden y
 *   `faltaParaEmpezar` dice qué falta, sin pasos ni pantallas intermedias.
 * - Cada acción del árbitro (punto, falta, sanción, cambio de sacador, atención médica) entra en
 *   una pila: "Deshacer" vuelve exactamente al estado anterior, sea la acción que sea, en vez de
 *   pedir confirmación antes de hacerla.
 * Sin React: la usan la consola y los tests.
 */
import type { EleccionSorteo, MarcadorVivo } from "@/types/torneo";
import type { LadoPista } from "./arbitros.ts";
import { otroLado } from "./arbitros.ts";
import { alternarOrdenSet, calcularMarcador, deshacer, type Lado } from "./marcador.ts";

/* ---------- previa ---------- */

export interface Previa {
  /** Lado de la pista (visto desde la silla) donde empieza la dupla A. */
  ladoA: LadoPista;
  /** Dupla que saca el primer game. */
  saca: Lado | null;
  /** Jugador de cada dupla que saca primero cuando le toque a su dupla. */
  primer: { A: string | null; B: string | null };
  sorteo: { gana: Lado; eligio: EleccionSorteo | null } | null;
}

export const previaVacia = (): Previa => ({ ladoA: "IZQ", saca: null, primer: { A: null, B: null }, sorteo: null });

/**
 * Lo que elige el ganador del sorteo ya resuelve quién saca (si eligió sacar o restar). Si eligió
 * el lado, el saque lo decide la otra dupla y se marca tocando su botón de saque.
 */
export function elegirEnSorteo(p: Previa, eligio: EleccionSorteo): Previa {
  if (!p.sorteo) return p;
  const gana = p.sorteo.gana;
  const saca = eligio === "SACAR" ? gana : eligio === "RESTAR" ? otroLado(gana) : p.saca;
  return { ...p, saca, sorteo: { gana, eligio } };
}

/** Qué falta para poder empezar (null = listo). `nombre` da el nombre de cada dupla. */
export function faltaParaEmpezar(p: Previa, nombre: (l: Lado) => string): string | null {
  if (!p.saca) return "Toca «Saca primero» en la dupla que abre el partido";
  const orden: Lado[] = [p.saca, otroLado(p.saca)];
  for (const l of orden) if (!p.primer[l]) return `Toca quién saca primero en ${nombre(l)}`;
  return null;
}

/* ---------- corregir quién saca ---------- */

/**
 * Cambia el sacador de una dupla desde el set en curso: en el primer set corrige el orden
 * inicial (se cargó mal quién sacaba); desde el segundo set usa el cambio de orden que permite
 * la FIP al empezar cada set, que rige hasta el final.
 */
export function cambiarSacador(m: MarcadorVivo, lado: Lado): MarcadorVivo {
  const e = calcularMarcador(m);
  if (e.terminado) return m;
  if (e.setActual > 0) return alternarOrdenSet(m, e.setActual, lado);
  const suyos = lado === "A" ? m.jugadoresA : m.jugadoresB;
  const i = m.ordenSaque.findIndex((j) => suyos.includes(j));
  if (i < 0 || i + 2 > 3) return m;
  const orden = [...m.ordenSaque] as MarcadorVivo["ordenSaque"];
  [orden[i], orden[i + 2]] = [orden[i + 2], orden[i]];
  return { ...m, ordenSaque: orden, actualizadoEn: new Date().toISOString() };
}

/* ---------- deshacer cualquier acción ---------- */

export interface PasoDeshacer {
  /** El marcador justo antes de la acción. */
  antes: MarcadorVivo;
  /** `actualizadoEn` del marcador que dejó la acción: si cambió por otro lado, no se usa. */
  despues: string;
  /** Qué se deshace, para el botón ("Punto de Díaz / García", "Advertencia a…"). */
  que: string;
}

const TOPE = 40;

/** Suma una acción a la pila. */
export function apilar(pila: PasoDeshacer[], antes: MarcadorVivo, despues: MarcadorVivo, que: string): PasoDeshacer[] {
  return [...pila, { antes, despues: despues.actualizadoEn, que }].slice(-TOPE);
}

/** El detalle de un punto (winner, error, golpe) es parte de la misma acción: no suma un paso. */
export function retocar(pila: PasoDeshacer[], previo: MarcadorVivo, nuevo: MarcadorVivo): PasoDeshacer[] {
  const top = pila.at(-1);
  if (!top || top.despues !== previo.actualizadoEn) return pila;
  return [...pila.slice(0, -1), { ...top, despues: nuevo.actualizadoEn }];
}

/** Lo que haría "Deshacer" ahora, o null si no hay nada. */
export function proximoDeshacer(pila: PasoDeshacer[], m: MarcadorVivo): string | null {
  const top = pila.at(-1);
  if (top && top.despues === m.actualizadoEn) return top.que;
  if (m.faltaPendiente) return "Falta de saque";
  if (m.puntos.length) return "Último punto";
  return null;
}

/**
 * Deshace la última acción. Con la pila al día vuelve al marcador de antes tal cual (con hora
 * nueva, para que el servidor y las pantallas tomen la versión deshecha). Si la pila no sirve
 * (se recargó la tablet o anotó otro), quita el último punto o la falta pendiente.
 */
export function deshacerUno(pila: PasoDeshacer[], m: MarcadorVivo): { m: MarcadorVivo; pila: PasoDeshacer[]; que: string } | null {
  const ahora = new Date(Math.max(Date.now(), new Date(m.actualizadoEn).getTime() + 1)).toISOString();
  const top = pila.at(-1);
  if (top && top.despues === m.actualizadoEn) {
    // El paso de abajo dejó justo el marcador que se restaura: se le pone la hora nueva para seguir deshaciendo.
    const resto = pila.slice(0, -1);
    const abajo = resto.at(-1);
    if (abajo && abajo.despues === top.antes.actualizadoEn) resto[resto.length - 1] = { ...abajo, despues: ahora };
    return { m: { ...top.antes, finalizado: false, actualizadoEn: ahora }, pila: resto, que: top.que };
  }
  if (!m.faltaPendiente && !m.puntos.length) return null;
  const que = m.faltaPendiente ? "Falta de saque" : "Último punto";
  return { m: { ...deshacer(m), actualizadoEn: ahora }, pila: [], que };
}

/* ---------- cierre con cuenta regresiva ---------- */

/** Segundos que el árbitro tiene para deshacer antes de que el resultado se envíe solo a mesa. */
export const SEGUNDOS_CIERRE = 10;

export type Cierre =
  | { tipo: "NORMAL" }
  | { tipo: "RETIRO"; seRetira: Lado }
  | { tipo: "DESCALIFICACION"; descalificado: Lado; marcador: MarcadorVivo }
  | { tipo: "WO"; noVino: Lado };

/** Ganador de un cierre. `ganadorNormal` es el del marcador cuando terminó jugando. */
export function ganadorCierre(c: Cierre, ganadorNormal: Lado | null): Lado | null {
  if (c.tipo === "NORMAL") return ganadorNormal;
  if (c.tipo === "RETIRO") return otroLado(c.seRetira);
  if (c.tipo === "DESCALIFICACION") return otroLado(c.descalificado);
  return otroLado(c.noVino);
}

/** Asegura que cada versión del marcador tenga una hora posterior a la anterior (dos toques en el mismo milisegundo). */
export function sellar(previo: MarcadorVivo, nuevo: MarcadorVivo): MarcadorVivo {
  if (nuevo === previo) return nuevo;
  if (nuevo.actualizadoEn > previo.actualizadoEn) return nuevo;
  return { ...nuevo, actualizadoEn: new Date(new Date(previo.actualizadoEn).getTime() + 1).toISOString() };
}
