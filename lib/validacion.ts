/**
 * Validación estricta de payloads que llegan a la API. Devuelve una lista de
 * errores legibles (vacía = válido). Es TypeScript puro: se puede reutilizar
 * en una Edge Function o en el backend de PadelReserve.
 */
import type { ConfigClub, EventoAmericano } from "@/types/americano";
import { LIMITES_SUMA } from "./categories.ts";
import { LIMITES, validarResultado } from "./scoring.ts";

const RAMAS = ["FEMENINO", "MASCULINO", "MIXTO"];
const NIVELES = ["7MA", "6TA", "5TA", "4TA", "3RA", "2DA", "OPEN"];
const METODOS = ["PUNTOS_TOTALES", "GAMES_PUNTO_ORO", "SETS_CORTOS"];
const ESTADOS = ["BORRADOR", "EN_CURSO", "FINALIZADO"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_JUGADORES = 48;
export const MAX_RONDAS = 30;

const esTexto = (x: unknown, max = 200): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const esEntero = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

export function validarEvento(x: unknown): string[] {
  const errores: string[] = [];
  const err = (m: string) => errores.length < 25 && errores.push(m);
  if (!x || typeof x !== "object") return ["El evento debe ser un objeto."];
  const e = x as Partial<EventoAmericano>;

  if (!esTexto(e.id, 100) || !/^[\w-]+$/.test(e.id)) err("id inválido (solo letras, números, _ y -).");
  if (!esTexto(e.nombre, 120)) err("nombre es obligatorio (máx. 120 caracteres).");
  if (typeof e.fecha !== "string" || !FECHA.test(e.fecha)) err("fecha debe ser YYYY-MM-DD.");
  if (typeof e.horaInicio !== "string" || !HORA.test(e.horaInicio)) err("horaInicio debe ser HH:MM.");
  if (typeof e.horaFin !== "string" || !HORA.test(e.horaFin)) err("horaFin debe ser HH:MM.");
  if (!e.categoria || !RAMAS.includes(e.categoria.rama) || !NIVELES.includes(e.categoria.nivel)) err("categoria inválida.");
  else {
    if (e.categoria.rama === "FEMENINO" && e.categoria.nivel === "2DA") err("En Femenino no existe la categoría 2da.");
    if (e.categoria.suma != null && !esEntero(e.categoria.suma, LIMITES_SUMA.min, LIMITES_SUMA.max)) err(`categoria.suma debe estar entre ${LIMITES_SUMA.min} y ${LIMITES_SUMA.max}.`);
    if (e.categoria.nombre != null && e.categoria.nombre !== "" && !esTexto(e.categoria.nombre, 60)) err("categoria.nombre: máximo 60 caracteres.");
  }
  if (e.cronometro !== undefined && typeof e.cronometro !== "boolean") err("cronometro debe ser true o false.");
  if (e.modalidad !== "INDIVIDUAL_ROTATIVO" && e.modalidad !== "DUPLA_FIJA") err("modalidad inválida.");
  if (!e.puntuacion || !METODOS.includes(e.puntuacion.metodo)) err("puntuacion.metodo inválido.");
  if (e.puntuacion?.criterio && !["PUNTOS_A_FAVOR", "SOLO_GANADOS", "VICTORIAS"].includes(e.puntuacion.criterio)) err("puntuacion.criterio inválido.");
  if (e.puntuacion) {
    const c = e.puntuacion;
    if (c.modo !== undefined && c.modo !== "TOTAL" && c.modo !== "A_GANAR") err("puntuacion.modo debe ser TOTAL o A_GANAR.");
    if (c.puntosPorPartido !== undefined && !esEntero(c.puntosPorPartido, LIMITES.puntos.min, LIMITES.puntos.max)) err(`puntosPorPartido debe estar entre ${LIMITES.puntos.min} y ${LIMITES.puntos.max}.`);
    if (c.gamesPorPartido !== undefined) {
      const l = c.metodo === "SETS_CORTOS" ? LIMITES.gamesSet : LIMITES.games;
      if (!esEntero(c.gamesPorPartido, l.min, l.max)) err(`gamesPorPartido debe estar entre ${l.min} y ${l.max}.`);
    }
    if (c.setsMaximos !== undefined && ![1, 3, 5].includes(c.setsMaximos)) err("setsMaximos debe ser 1, 3 o 5.");
    if (c.puntoDeOro !== undefined && typeof c.puntoDeOro !== "boolean") err("puntoDeOro debe ser true o false.");
    for (const k of ["tieBreak", "superTie"] as const)
      if (c[k] != null && !esEntero(c[k], LIMITES.tie.min, LIMITES.tie.max)) err(`${k} debe estar entre ${LIMITES.tie.min} y ${LIMITES.tie.max} puntos.`);
  }
  if (!esEntero(e.pistas, 1, 6)) err("pistas debe estar entre 1 y 6.");
  if (!esEntero(e.duracionRondaMin, 1, 180)) err("duracionRondaMin fuera de rango.");
  if (!esEntero(e.totalRondas, 1, MAX_RONDAS)) err(`totalRondas debe estar entre 1 y ${MAX_RONDAS}.`);
  if (!esEntero(e.rondaActual, 1, MAX_RONDAS + 1)) err("rondaActual fuera de rango.");
  if (!e.estado || !ESTADOS.includes(e.estado)) err("estado inválido.");
  if (typeof e.actualizadoEn !== "string" || Number.isNaN(Date.parse(e.actualizadoEn))) err("actualizadoEn debe ser una fecha ISO.");
  if (!Array.isArray(e.jugadores)) return [...errores, "jugadores debe ser una lista."];
  if (!Array.isArray(e.rondas)) return [...errores, "rondas debe ser una lista."];
  if (!Array.isArray(e.parejas)) return [...errores, "parejas debe ser una lista."];
  if (e.jugadores.length > MAX_JUGADORES) err(`Máximo ${MAX_JUGADORES} jugadores.`);

  const ids = new Set<string>();
  for (const j of e.jugadores) {
    if (!j || !esTexto(j.id, 100) || !esTexto(j.nombre, 80)) {
      err("Hay un jugador sin id o sin nombre.");
      continue;
    }
    if (ids.has(j.id)) err(`Jugador duplicado: ${j.id}.`);
    ids.add(j.id);
    if (j.genero !== "M" && j.genero !== "F") err(`Género inválido para ${j.nombre}.`);
    if (j.nivel != null && !NIVELES.includes(j.nivel)) err(`Nivel inválido para ${j.nombre}.`);
    else if (j.genero === "F" && j.nivel === "2DA") err(`${j.nombre}: en Femenino no existe la categoría 2da.`);
  }
  for (const p of e.parejas) {
    if (!p || !Array.isArray(p.jugadorIds) || p.jugadorIds.length !== 2 || !p.jugadorIds.every((id) => ids.has(id)))
      err(`Pareja ${p?.id ?? "?"} referencia jugadores inexistentes.`);
  }

  const idsPartido = new Set<string>();
  for (const r of e.rondas) {
    if (!r || !esEntero(r.numero, 1, MAX_RONDAS) || !Array.isArray(r.partidos)) {
      err("Hay una ronda mal formada.");
      continue;
    }
    if (r.partidos.length > 6) err(`Ronda ${r.numero}: más partidos que pistas posibles.`);
    for (const p of r.partidos) {
      if (!p || !esTexto(p.id, 120)) {
        err(`Ronda ${r.numero}: partido sin id.`);
        continue;
      }
      if (idsPartido.has(p.id)) err(`Partido duplicado: ${p.id}.`);
      idsPartido.add(p.id);
      const enCancha = [...(p.parejaA?.jugadorIds ?? []), ...(p.parejaB?.jugadorIds ?? [])];
      if (enCancha.length !== 4 || enCancha.some((id) => !ids.has(id))) err(`Partido ${p.id}: jugadores inexistentes.`);
      if (new Set(enCancha).size !== enCancha.length) err(`Partido ${p.id}: un jugador aparece dos veces.`);
      if (p.resultado && e.puntuacion && METODOS.includes(e.puntuacion.metodo)) {
        const m = validarResultado(e.puntuacion, p.resultado);
        if (m) err(`Partido ${p.id}: ${m}`);
      }
    }
  }
  return errores;
}

export function validarClub(x: unknown): string[] {
  const errores: string[] = [];
  if (!x || typeof x !== "object") return ["El club debe ser un objeto."];
  const c = x as Partial<ConfigClub>;
  if (!Array.isArray(c.dias) || c.dias.length !== 7) errores.push("dias debe tener 7 elementos (domingo a sábado).");
  else
    c.dias.forEach((d, i) => {
      if (!d || typeof d.abierto !== "boolean" || !HORA.test(d.apertura ?? "") || !HORA.test(d.cierre ?? "")) errores.push(`Día ${i}: horario inválido.`);
      else if (d.abierto && d.cierre <= d.apertura) errores.push(`Día ${i}: el cierre debe ser posterior a la apertura.`);
    });
  if (!esEntero(c.minutosEntreRondas, 0, 60)) errores.push("minutosEntreRondas debe estar entre 0 y 60.");
  if (!Array.isArray(c.pistas) || c.pistas.length < 1 || c.pistas.length > 6) errores.push("pistas debe tener entre 1 y 6 elementos.");
  else if (new Set(c.pistas.map((p) => p.numero)).size !== c.pistas.length) errores.push("Números de pista repetidos.");
  if (typeof c.actualizadoEn !== "string" || Number.isNaN(Date.parse(c.actualizadoEn))) errores.push("actualizadoEn debe ser una fecha ISO.");
  return errores;
}
