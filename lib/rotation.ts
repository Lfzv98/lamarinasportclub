/**
 * Algoritmo de rotación balanceada de parejas.
 *
 * Individual Rotativo (Americano):
 *   1. Elige quién juega cada ronda priorizando a quien menos ha jugado
 *      (los descansos se reparten de forma equitativa).
 *   2. Arma parejas y cruces con búsqueda local (hill climbing con reinicios)
 *      minimizando un costo:
 *        - repetir compañero      → penalización muy alta
 *        - repetir rival          → penalización media
 *        - desbalance de nivel    → |rating(parejaA) − rating(parejaB)|
 *   En Mixto cada pareja es siempre 1 hombre + 1 mujer.
 *
 * Dupla Fija:
 *   Round robin por método del círculo, empaquetado en rondas según las pistas
 *   disponibles y priorizando a las parejas que menos han jugado.
 *
 * Todo es determinista a partir de `semilla`, así cualquier dispositivo
 * regenera exactamente el mismo cuadro.
 */
import type { Genero, Jugador, Pareja, Partido, Ronda } from "@/types/americano";
import { RATING_NIVEL } from "./categories.ts";

export interface OpcionesRotacion {
  pistas: number;
  rondas: number;
  semilla: number;
  mixto?: boolean;
}

const COSTO_COMPANERO_REPETIDO = 1000;
const COSTO_RIVAL_REPETIDO = 40;
const COSTO_DESBALANCE = 12;

/* ---------- utilidades ---------- */

export function crearRng(semilla: number) {
  let a = semilla >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clave = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function ratingJugador(j: Jugador): number {
  if (typeof j.rating === "number") return j.rating;
  return j.nivel ? RATING_NIVEL[j.nivel] : 3;
}

export function crearParejaRotativa(a: Jugador, b: Jugador): Pareja {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  return { id: `${x.id}+${y.id}`, jugadorIds: [x.id, y.id], nombre: `${x.nombre} / ${y.nombre}` };
}

class Contador {
  private m = new Map<string, number>();
  get(k: string) {
    return this.m.get(k) ?? 0;
  }
  inc(k: string) {
    this.m.set(k, this.get(k) + 1);
  }
}

/* ---------- Individual Rotativo ---------- */

/** Partidos simultáneos posibles para un grupo de jugadores. */
export function partidosPorRonda(jugadores: Jugador[], pistas: number, mixto = false): number {
  if (mixto) {
    const h = jugadores.filter((j) => j.genero === "M").length;
    const m = jugadores.filter((j) => j.genero === "F").length;
    return Math.max(0, Math.min(pistas, Math.floor(h / 2), Math.floor(m / 2)));
  }
  return Math.max(0, Math.min(pistas, Math.floor(jugadores.length / 4)));
}

/** Rondas sugeridas: idealmente cada jugador comparte pareja con todos (N−1), acotado a una tarde razonable. */
export function rondasSugeridas(nJugadoresOParejas: number, modalidad: "INDIVIDUAL_ROTATIVO" | "DUPLA_FIJA", pistas: number): number {
  if (modalidad === "DUPLA_FIJA") {
    const n = nJugadoresOParejas;
    if (n < 2) return 1;
    const total = (n * (n - 1)) / 2;
    const porRonda = Math.max(1, Math.min(pistas, Math.floor(n / 2)));
    return Math.max(1, Math.min(15, Math.ceil(total / porRonda)));
  }
  return Math.max(3, Math.min(8, nJugadoresOParejas - 1));
}

interface Historial {
  companeros: Contador;
  rivales: Contador;
  jugados: Contador;
  descansos: Contador;
}

/** Costo de una disposición: posiciones [a0,a1,b0,b1] por partido. */
function costoDisposicion(disp: Jugador[], h: Historial): number {
  let costo = 0;
  for (let i = 0; i < disp.length; i += 4) {
    const [a0, a1, b0, b1] = disp.slice(i, i + 4);
    costo += COSTO_COMPANERO_REPETIDO * h.companeros.get(clave(a0.id, a1.id));
    costo += COSTO_COMPANERO_REPETIDO * h.companeros.get(clave(b0.id, b1.id));
    for (const x of [a0, a1]) for (const y of [b0, b1]) costo += COSTO_RIVAL_REPETIDO * h.rivales.get(clave(x.id, y.id));
    costo += COSTO_DESBALANCE * Math.abs(ratingJugador(a0) + ratingJugador(a1) - ratingJugador(b0) - ratingJugador(b1));
  }
  return costo;
}

/**
 * Posiciones intercambiables. En mixto, las posiciones pares son hombres y las
 * impares mujeres, así cada pareja (0,1) y (2,3) es siempre mixta.
 */
function disposicionInicial(activos: Jugador[], mixto: boolean, rng: () => number): Jugador[] {
  if (!mixto) return barajar(activos, rng);
  const h = barajar(activos.filter((j) => j.genero === "M"), rng);
  const m = barajar(activos.filter((j) => j.genero === "F"), rng);
  const out: Jugador[] = [];
  for (let i = 0; i < h.length; i++) out.push(h[i], m[i]);
  return out;
}

function mejorDisposicion(activos: Jugador[], h: Historial, mixto: boolean, rng: () => number): Jugador[] {
  const reinicios = 24;
  const iteraciones = 60 * activos.length;
  let mejor: Jugador[] = [];
  let mejorCosto = Infinity;

  for (let r = 0; r < reinicios; r++) {
    const disp = disposicionInicial(activos, mixto, rng);
    let costo = costoDisposicion(disp, h);
    for (let it = 0; it < iteraciones && costo > 0; it++) {
      const i = Math.floor(rng() * disp.length);
      let j = Math.floor(rng() * disp.length);
      if (mixto && i % 2 !== j % 2) j = j % 2 === 0 ? j + 1 : j - 1;
      // Intercambiar dentro de la misma pareja no cambia nada.
      if (Math.floor(i / 2) === Math.floor(j / 2)) continue;
      [disp[i], disp[j]] = [disp[j], disp[i]];
      const nuevo = costoDisposicion(disp, h);
      if (nuevo <= costo) costo = nuevo;
      else [disp[i], disp[j]] = [disp[j], disp[i]];
    }
    if (costo < mejorCosto) {
      mejorCosto = costo;
      mejor = [...disp];
      if (costo === 0) break;
    }
  }
  return mejor;
}

/** Elige quién juega: menos partidos jugados primero; empate → más descansos, luego azar. */
function elegirActivos(pool: Jugador[], cupos: number, h: Historial, rng: () => number): Jugador[] {
  return barajar(pool, rng)
    .sort((a, b) => h.jugados.get(a.id) - h.jugados.get(b.id) || h.descansos.get(b.id) - h.descansos.get(a.id))
    .slice(0, cupos);
}

export function generarRondasIndividual(jugadores: Jugador[], opts: OpcionesRotacion): Ronda[] {
  const rng = crearRng(opts.semilla);
  const mixto = !!opts.mixto;
  const nPartidos = partidosPorRonda(jugadores, opts.pistas, mixto);
  if (nPartidos === 0) return [];

  const h: Historial = { companeros: new Contador(), rivales: new Contador(), jugados: new Contador(), descansos: new Contador() };
  const rondas: Ronda[] = [];

  for (let n = 1; n <= opts.rondas; n++) {
    let activos: Jugador[];
    if (mixto) {
      const porGenero = (g: Genero) => elegirActivos(jugadores.filter((j) => j.genero === g), nPartidos * 2, h, rng);
      activos = [...porGenero("M"), ...porGenero("F")];
    } else {
      activos = elegirActivos(jugadores, nPartidos * 4, h, rng);
    }
    const idsActivos = new Set(activos.map((j) => j.id));
    const descansan = jugadores.filter((j) => !idsActivos.has(j.id));

    const disp = mejorDisposicion(activos, h, mixto, rng);
    const grupos: Jugador[][] = [];
    for (let i = 0; i < disp.length; i += 4) grupos.push(disp.slice(i, i + 4));
    // El partido de mayor nivel va a la pista 1 (pista central).
    grupos.sort((x, y) => x.reduce((s, j) => s + ratingJugador(j), 0) - y.reduce((s, j) => s + ratingJugador(j), 0)).reverse();

    const partidos: Partido[] = grupos.map(([a0, a1, b0, b1], idx) => {
      h.companeros.inc(clave(a0.id, a1.id));
      h.companeros.inc(clave(b0.id, b1.id));
      for (const x of [a0, a1]) for (const y of [b0, b1]) h.rivales.inc(clave(x.id, y.id));
      return {
        id: `r${n}-p${idx + 1}`,
        rondaNumero: n,
        pista: idx + 1,
        parejaA: crearParejaRotativa(a0, a1),
        parejaB: crearParejaRotativa(b0, b1),
        estado: "PENDIENTE",
        resultado: null,
      };
    });
    activos.forEach((j) => h.jugados.inc(j.id));
    descansan.forEach((j) => h.descansos.inc(j.id));

    rondas.push({ numero: n, estado: "PENDIENTE", partidos, descansanIds: descansan.map((j) => j.id), inicioEn: null, segundosAcumulados: 0 });
  }
  return rondas;
}

/* ---------- Dupla Fija ---------- */

/** Método del círculo: devuelve jornadas de enfrentamientos (pares de índices). */
function roundRobin(n: number): [number, number][][] {
  const ids = Array.from({ length: n % 2 === 0 ? n : n + 1 }, (_, i) => i);
  const fantasma = n % 2 === 0 ? -1 : n;
  const jornadas: [number, number][][] = [];
  const m = ids.length;
  for (let r = 0; r < m - 1; r++) {
    const jornada: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i];
      const b = ids[m - 1 - i];
      if (a !== fantasma && b !== fantasma) jornada.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    jornadas.push(jornada);
    ids.splice(1, 0, ids.pop()!);
  }
  return jornadas;
}

export function generarRondasDuplaFija(parejas: Pareja[], opts: OpcionesRotacion): Ronda[] {
  const n = parejas.length;
  if (n < 2) return [];
  const rng = crearRng(opts.semilla);
  const orden = barajar(parejas, rng);
  const porRonda = Math.max(1, Math.min(opts.pistas, Math.floor(n / 2)));
  const jugados = new Contador();

  let cola: [number, number][] = [];
  const recargar = () => {
    cola = cola.concat(roundRobin(n).flat());
  };
  recargar();

  const rondas: Ronda[] = [];
  for (let r = 1; r <= opts.rondas; r++) {
    if (cola.length < porRonda) recargar();
    const enRonda = new Set<number>();
    const elegidos: [number, number][] = [];
    // Prioriza los cruces cuyas parejas han jugado menos (equidad de descansos).
    const candidatos = cola
      .map((m, idx) => ({ m, idx, carga: jugados.get(String(m[0])) + jugados.get(String(m[1])) }))
      .sort((x, y) => x.carga - y.carga || x.idx - y.idx);
    for (const c of candidatos) {
      if (elegidos.length >= porRonda) break;
      if (enRonda.has(c.m[0]) || enRonda.has(c.m[1])) continue;
      elegidos.push(c.m);
      enRonda.add(c.m[0]);
      enRonda.add(c.m[1]);
    }
    const usados = new Set(elegidos);
    cola = cola.filter((m) => !usados.has(m));
    elegidos.forEach(([a, b]) => {
      jugados.inc(String(a));
      jugados.inc(String(b));
    });

    rondas.push({
      numero: r,
      estado: "PENDIENTE",
      partidos: elegidos.map(([a, b], idx) => ({
        id: `r${r}-p${idx + 1}`,
        rondaNumero: r,
        pista: idx + 1,
        parejaA: orden[a],
        parejaB: orden[b],
        estado: "PENDIENTE",
        resultado: null,
      })),
      descansanIds: orden.filter((_, i) => !enRonda.has(i)).map((p) => p.id),
      inicioEn: null,
      segundosAcumulados: 0,
    });
  }
  return rondas;
}

/* ---------- métricas (útiles para tests y para mostrar calidad del cuadro) ---------- */

export function metricasRotacion(rondas: Ronda[]) {
  const companeros = new Contador();
  const rivales = new Contador();
  let companerosRepetidos = 0;
  let rivalesRepetidos = 0;
  const jugados = new Map<string, number>();
  for (const r of rondas)
    for (const p of r.partidos) {
      for (const par of [p.parejaA, p.parejaB]) {
        const k = clave(...par.jugadorIds);
        if (companeros.get(k) > 0) companerosRepetidos++;
        companeros.inc(k);
        par.jugadorIds.forEach((id) => jugados.set(id, (jugados.get(id) ?? 0) + 1));
      }
      for (const x of p.parejaA.jugadorIds)
        for (const y of p.parejaB.jugadorIds) {
          const k = clave(x, y);
          if (rivales.get(k) > 0) rivalesRepetidos++;
          rivales.inc(k);
        }
    }
  const valores = [...jugados.values()];
  return {
    companerosRepetidos,
    rivalesRepetidos,
    minPartidos: Math.min(...valores),
    maxPartidos: Math.max(...valores),
  };
}
