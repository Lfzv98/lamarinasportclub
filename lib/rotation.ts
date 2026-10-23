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
  /** Rondas ya jugadas: alimentan el historial al re-sortear (jugador retirado o tardío). */
  previas?: Ronda[];
  /** Número de la primera ronda a generar (por defecto 1). */
  desde?: number;
  /** Sufijo para los ids de partido, evita confundir un re-sorteo con el cuadro anterior. */
  sufijo?: string;
}

const COSTO_COMPANERO_REPETIDO = 1000;
const COSTO_RIVAL_REPETIDO = 40;
const COSTO_DESBALANCE = 12;
const COSTO_PISTA_REPETIDA = 20;

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
  m = new Map<string, number>();
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
export function rondasSugeridas(
  nJugadoresOParejas: number,
  modalidad: "INDIVIDUAL_ROTATIVO" | "DUPLA_FIJA",
  pistas: number,
  genero?: { hombres: number; mujeres: number },
): number {
  if (modalidad === "DUPLA_FIJA") {
    const n = nJugadoresOParejas;
    if (n < 2) return 1;
    const total = (n * (n - 1)) / 2;
    const porRonda = Math.max(1, Math.min(pistas, Math.floor(n / 2)));
    return Math.max(1, Math.min(15, Math.ceil(total / porRonda)));
  }
  return Math.max(3, Math.min(8, nJugadoresOParejas - 1, maxRondasSinRepetirPareja(nJugadoresOParejas, pistas, genero)));
}

/**
 * Máximo de rondas en que nadie repite compañero, por capacidad: cada jugador
 * necesita un compañero nuevo por partido. En mixto solo puede formar pareja con
 * el otro género (4 hombres y 4 mujeres → cada uno tiene solo 4 compañeros posibles).
 */
export function maxRondasSinRepetirPareja(nJugadores: number, pistas: number, genero?: { hombres: number; mujeres: number }): number {
  if (genero) {
    const k = Math.max(0, Math.min(pistas, Math.floor(genero.hombres / 2), Math.floor(genero.mujeres / 2)));
    if (k === 0) return 0;
    // Con descansos el reparto no siempre es perfecto: no pasar de un compañero distinto por persona del otro género.
    return Math.min(Math.floor((genero.hombres * genero.mujeres) / (2 * k)), Math.min(genero.hombres, genero.mujeres));
  }
  const k = Math.max(0, Math.min(pistas, Math.floor(nJugadores / 4)));
  if (k === 0) return 0;
  return Math.floor((nJugadores * (nJugadores - 1)) / (4 * k));
}

interface Historial {
  pistas?: Contador;
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
    // Pista = posición del grupo: suma las veces que cada uno ya jugó en ella (reparte las pistas).
    if (h.pistas && disp.length > 4) for (const j of [a0, a1, b0, b1]) costo += COSTO_PISTA_REPETIDA * h.pistas.get(`${j.id}|${i / 4 + 1}`);
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

/**
 * Reparte los partidos de una ronda entre las pistas para que nadie repita pista
 * de más (ej. que no le toque siempre la pista sin techo). Prueba todas las
 * asignaciones (máx. 6 pistas = 720) y, a igual costo, deja el orden recibido
 * (el partido de mayor nivel en la primera pista).
 */
function asignarPistas<T>(grupos: T[], ids: (g: T) => string[], usoPistas: Contador): T[] {
  const k = grupos.length;
  if (k <= 1) return grupos;
  const costo = (g: T, pista: number) => ids(g).reduce((t, id) => t + usoPistas.get(`${id}|${pista}`) ** 2, 0);
  let mejor: number[] = Array.from({ length: k }, (_, i) => i);
  let mejorCosto = Infinity;
  const perm: number[] = [];
  const usado = new Array<boolean>(k).fill(false);
  const rec = (acum: number) => {
    if (acum >= mejorCosto) return;
    if (perm.length === k) {
      mejorCosto = acum;
      mejor = [...perm];
      return;
    }
    for (let g = 0; g < k; g++) {
      if (usado[g]) continue;
      usado[g] = true;
      perm.push(g);
      rec(acum + costo(grupos[g], perm.length));
      perm.pop();
      usado[g] = false;
    }
  };
  rec(0);
  const out = mejor.map((g) => grupos[g]);
  out.forEach((g, i) => ids(g).forEach((id) => usoPistas.inc(`${id}|${i + 1}`)));
  return out;
}

/**
 * Genera el cuadro individual. Si el cuadro tiene compañeros repetidos que se
 * podrían evitar, lo vuelve a armar con otra semilla (hasta 8 intentos) y se
 * queda con el que menos repite compañeros y luego rivales.
 */
export function generarRondasIndividual(jugadores: Jugador[], opts: OpcionesRotacion): Ronda[] {
  const base = metricasRotacion(opts.previas ?? []);
  let mejor: Ronda[] = [];
  let mejorCosto = Infinity;
  for (let intento = 0; intento < 8; intento++) {
    const rondas = generarIndividualUnaVez(jugadores, { ...opts, semilla: opts.semilla + intento * 104729 });
    const m = metricasRotacion([...(opts.previas ?? []), ...rondas]);
    const costo = (m.companerosRepetidos - base.companerosRepetidos) * 1000 + (m.rivalesRepetidos - base.rivalesRepetidos);
    if (costo < mejorCosto) {
      mejorCosto = costo;
      mejor = rondas;
    }
    if (m.companerosRepetidos === base.companerosRepetidos) break;
  }
  return mejor;
}

function generarIndividualUnaVez(jugadores: Jugador[], opts: OpcionesRotacion): Ronda[] {
  const rng = crearRng(opts.semilla);
  const mixto = !!opts.mixto;
  const nPartidos = partidosPorRonda(jugadores, opts.pistas, mixto);
  if (nPartidos === 0) return [];

  const usoPistas = new Contador();
  const h: Historial = { companeros: new Contador(), rivales: new Contador(), jugados: new Contador(), descansos: new Contador(), pistas: usoPistas };
  for (const r of opts.previas ?? []) {
    for (const p of r.partidos) {
      [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].forEach((id) => usoPistas.inc(`${id}|${p.pista}`));
      h.companeros.inc(clave(...p.parejaA.jugadorIds));
      h.companeros.inc(clave(...p.parejaB.jugadorIds));
      for (const x of p.parejaA.jugadorIds) for (const y of p.parejaB.jugadorIds) h.rivales.inc(clave(x, y));
      [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].forEach((id) => h.jugados.inc(id));
    }
    r.descansanIds.forEach((id) => h.descansos.inc(id));
  }
  // Un jugador que llega tarde arranca con el promedio jugado: no acapara todas las rondas siguientes.
  if (opts.previas?.length) {
    const conHistorial = jugadores.filter((j) => h.jugados.get(j.id) + h.descansos.get(j.id) > 0);
    const prom = conHistorial.length ? Math.floor(conHistorial.reduce((s, j) => s + h.jugados.get(j.id), 0) / conHistorial.length) : 0;
    for (const j of jugadores) if (!conHistorial.includes(j)) for (let i = 0; i < prom; i++) h.jugados.inc(j.id);
  }
  const rondas: Ronda[] = [];
  const desde = opts.desde ?? 1;
  const sufijo = opts.sufijo ? `-${opts.sufijo}` : "";

  for (let n = desde; n < desde + opts.rondas; n++) {
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
    // Orden base: el partido de mayor nivel primero; luego se reparte para que nadie repita pista de más.
    grupos.sort((x, y) => x.reduce((s, j) => s + ratingJugador(j), 0) - y.reduce((s, j) => s + ratingJugador(j), 0)).reverse();
    const enPistas = asignarPistas(grupos, (g) => g.map((j) => j.id), usoPistas);

    const partidos: Partido[] = enPistas.map(([a0, a1, b0, b1], idx) => {
      h.companeros.inc(clave(a0.id, a1.id));
      h.companeros.inc(clave(b0.id, b1.id));
      for (const x of [a0, a1]) for (const y of [b0, b1]) h.rivales.inc(clave(x.id, y.id));
      return {
        id: `r${n}-p${idx + 1}${sufijo}`,
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
  const indice = new Map(orden.map((p, i) => [p.id, i]));

  // Cruces ya disputados (re-sorteo): no se repiten hasta completar la vuelta.
  const yaJugados = new Contador();
  const usoPistas = new Contador();
  for (const r of opts.previas ?? [])
    for (const p of r.partidos) {
      usoPistas.inc(`${p.parejaA.id}|${p.pista}`);
      usoPistas.inc(`${p.parejaB.id}|${p.pista}`);
      const a = indice.get(p.parejaA.id);
      const b = indice.get(p.parejaB.id);
      if (a !== undefined) jugados.inc(String(a));
      if (b !== undefined) jugados.inc(String(b));
      if (a !== undefined && b !== undefined) yaJugados.inc(clave(String(a), String(b)));
    }

  // Cada cruce lleva su número de vuelta: nunca se adelanta uno de la vuelta siguiente
  // mientras quede alguno pendiente de la actual (así no se repiten cruces).
  let cola: [number, number][] = [];
  const vueltaDe = new Map<[number, number], number>();
  let vueltas = 0;
  const recargar = () => {
    vueltas++;
    const vuelta = roundRobin(n).flat();
    const pendientes = vuelta.filter(([a, b]) => {
      const k = clave(String(a), String(b));
      if (yaJugados.get(k) > 0) {
        // consume una ocurrencia
        yaJugados.m.set(k, yaJugados.get(k) - 1);
        return false;
      }
      return true;
    });
    const nuevos = pendientes.length ? pendientes : vuelta;
    nuevos.forEach((m) => vueltaDe.set(m, vueltas));
    cola = cola.concat(nuevos);
  };
  recargar();

  const rondas: Ronda[] = [];
  const desde = opts.desde ?? 1;
  const sufijo = opts.sufijo ? `-${opts.sufijo}` : "";
  for (let r = desde; r < desde + opts.rondas; r++) {
    if (cola.length === 0) recargar();
    const vueltaActual = Math.min(...cola.map((m) => vueltaDe.get(m)!));
    const actuales = cola.filter((m) => vueltaDe.get(m) === vueltaActual);
    // Arma la ronda con la vuelta actual. Prueba varios órdenes y se queda con el que llena más pistas,
    // priorizando a las parejas que han jugado menos (equidad de descansos).
    const armar = (orden: [number, number][]) => {
      const enR = new Set<number>();
      const sel: [number, number][] = [];
      for (const m of orden) {
        if (sel.length >= porRonda) break;
        if (enR.has(m[0]) || enR.has(m[1])) continue;
        sel.push(m);
        enR.add(m[0]);
        enR.add(m[1]);
      }
      return sel;
    };
    const carga = (m: [number, number]) => jugados.get(String(m[0])) + jugados.get(String(m[1]));
    // Grado: cuántos cruces pendientes tiene cada pareja; las más cargadas van primero para no dejarlas al final.
    const grado = new Contador();
    actuales.forEach(([x, y]) => (grado.inc(String(x)), grado.inc(String(y))));
    const presion = (m: [number, number]) => grado.get(String(m[0])) + grado.get(String(m[1]));
    let elegidos = armar([...actuales].sort((x, y) => carga(x) - carga(y) || presion(y) - presion(x)));
    for (let intento = 0; intento < 40 && elegidos.length < Math.min(porRonda, actuales.length); intento++) {
      const prueba = armar(barajar(actuales, rng).sort((x, y) => carga(x) - carga(y)));
      if (prueba.length > elegidos.length) elegidos = prueba;
    }
    // Si la vuelta actual no alcanza para llenar las pistas y ya está por terminar, completa con la siguiente.
    if (elegidos.length < porRonda && actuales.length === cola.length && elegidos.length === actuales.length) {
      recargar();
      const ocupados = new Set(elegidos.flat());
      const extra = armar(cola.filter((m) => vueltaDe.get(m) === vueltas && !ocupados.has(m[0]) && !ocupados.has(m[1])).sort((x, y) => carga(x) - carga(y)));
      elegidos = elegidos.concat(extra.slice(0, porRonda - elegidos.length));
    }
    const enRonda = new Set<number>(elegidos.flat());
    const usados = new Set(elegidos);
    cola = cola.filter((m) => !usados.has(m));
    elegidos.forEach(([a, b]) => {
      jugados.inc(String(a));
      jugados.inc(String(b));
    });

    rondas.push({
      numero: r,
      estado: "PENDIENTE",
      partidos: asignarPistas(elegidos, ([a, b]) => [orden[a].id, orden[b].id], usoPistas).map(([a, b], idx) => ({
        id: `r${r}-p${idx + 1}${sufijo}`,
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
    minPartidos: valores.length ? Math.min(...valores) : 0,
    maxPartidos: valores.length ? Math.max(...valores) : 0,
  };
}
