/**
 * Marcador de tenis según las Reglas del Tenis de la ITF.
 *
 * Todo sale de la lista de puntos (así "deshacer" es quitar el último):
 * - Juego: 0-15-30-40, iguales y ventaja, o sin ventaja (punto decisivo, el que resta elige el lado).
 * - Set: a 6 (4 en sets cortos, 8 en pro set) con diferencia de 2 y tie-break a 7 con los juegos igualados.
 * - Último set: igual, súper tie-break a 10 en su lugar, o set completo con tie-break a 10 en 6-6.
 * - Saque: rota por juego; en el tie-break saca 1 punto el primero y luego 2 cada uno.
 *   Quien sacó primero en el tie-break resta el primer juego del set siguiente.
 * - Cambio de lado: tras los juegos impares de cada set (sin descanso tras el primero, 90 s en los
 *   demás), al terminar el set si sus juegos suman impar (120 s de descanso entre sets),
 *   y cada 6 puntos del tie-break (sin descanso).
 */
import type { FormatoPartidoId, Lado, MarcadorTenis, PuntoTenis, ReglasTenis, SetJugado } from "@/types/tenis";

export const FORMATOS: Record<FormatoPartidoId, { nombre: string; detalle: string; reglas: ReglasTenis }> = {
  CLASICO: {
    nombre: "Clásico",
    detalle: "Mejor de 3 sets a 6, tie-break a 7 en 6-6.",
    reglas: { formato: "CLASICO", mejorDe: 3, juegosSet: 6, tieBreakEn: 6, puntosTieBreak: 7, ventaja: true, decisivo: "IGUAL" },
  },
  SUPER_TB: {
    nombre: "Súper tie-break",
    detalle: "2 sets a 6; si quedan 1-1, súper tie-break a 10. El más usado en torneos de club y en dobles.",
    reglas: { formato: "SUPER_TB", mejorDe: 3, juegosSet: 6, tieBreakEn: 6, puntosTieBreak: 7, ventaja: true, decisivo: "SUPER_TB" },
  },
  SETS_CORTOS: {
    nombre: "Sets cortos",
    detalle: "Mejor de 3 sets a 4, tie-break en 4-4. Ideal para jornadas con muchos partidos.",
    reglas: { formato: "SETS_CORTOS", mejorDe: 3, juegosSet: 4, tieBreakEn: 4, puntosTieBreak: 7, ventaja: false, decisivo: "SUPER_TB" },
  },
  PRO_SET: {
    nombre: "Pro set",
    detalle: "Un solo set a 8 juegos, tie-break en 8-8. Rápido para clasificatorias.",
    reglas: { formato: "PRO_SET", mejorDe: 1, juegosSet: 8, tieBreakEn: 8, puntosTieBreak: 7, ventaja: true, decisivo: "IGUAL" },
  },
  GRAND_SLAM: {
    nombre: "Grand Slam",
    detalle: "Mejor de 5 sets; en el quinto, tie-break a 10 en 6-6.",
    reglas: { formato: "GRAND_SLAM", mejorDe: 5, juegosSet: 6, tieBreakEn: 6, puntosTieBreak: 7, ventaja: true, decisivo: "TB10" },
  },
};

export type Aviso = "PUNTO_DE_PARTIDO" | "PUNTO_DE_SET" | "PUNTO_DE_QUIEBRE" | "PUNTO_DECISIVO";

export interface EstadoTenis {
  /** Sets terminados. */
  sets: SetJugado[];
  /** Juegos del set en curso. */
  juegos: [number, number];
  /** Puntos del juego (o tie-break) en curso. */
  puntos: [number, number];
  enTieBreak: boolean;
  superTieBreak: boolean;
  /** Puntos que hay que llegar en el tie-break en curso (7 o 10). */
  objetivoTieBreak: number;
  setsGanados: [number, number];
  ganador: Lado | null;
  /** Índice en ordenSaque de quien saca ahora. */
  turnoSaque: number;
  equipoSaca: Lado;
  /** Saca desde la derecha (lado de iguales) o la izquierda (lado de ventaja). */
  ladoSaque: "DERECHA" | "IZQUIERDA";
  /** Lado de la cancha donde está ahora el equipo A. */
  ladoA: "IZQ" | "DER";
  /** El último punto terminó en cambio de lado. */
  cambioDeLado: boolean;
  /** Descanso que corresponde tras el último punto (segundos; 0 = sin descanso). */
  descanso: 0 | 90 | 120;
  /** El último punto cerró un juego / un set. */
  finJuego: boolean;
  finSet: boolean;
  /** Juegos jugados en todo el partido (el tie-break cuenta como uno). */
  juegosJugados: number;
}

const otro = (l: Lado): Lado => (l === 0 ? 1 : 0);

export function esSuperTieBreak(r: ReglasTenis, setIndex: number) {
  return r.decisivo === "SUPER_TB" && r.mejorDe > 1 && setIndex === r.mejorDe - 1;
}

function inicial(m: Pick<MarcadorTenis, "ladoInicialA">, r: ReglasTenis, primero: Lado): EstadoTenis {
  const sup = esSuperTieBreak(r, 0);
  return {
    sets: [],
    juegos: [0, 0],
    puntos: [0, 0],
    enTieBreak: sup,
    superTieBreak: sup,
    objetivoTieBreak: sup ? 10 : r.puntosTieBreak,
    setsGanados: [0, 0],
    ganador: null,
    turnoSaque: 0,
    equipoSaca: primero,
    ladoSaque: "DERECHA",
    ladoA: m.ladoInicialA,
    cambioDeLado: false,
    descanso: 0,
    finJuego: false,
    finSet: false,
    juegosJugados: 0,
  };
}

/** Aplica un punto. No muta `e`. */
export function paso(e: EstadoTenis, g: Lado, r: ReglasTenis, orden: string[], primero: Lado): EstadoTenis {
  if (e.ganador !== null) return e;
  const n: EstadoTenis = { ...e, sets: e.sets, juegos: [...e.juegos] as [number, number], puntos: [...e.puntos] as [number, number], setsGanados: [...e.setsGanados] as [number, number], cambioDeLado: false, descanso: 0, finJuego: false, finSet: false };
  n.puntos[g]++;
  const [p0, p1] = n.puntos;
  const dif = Math.abs(p0 - p1);
  let ganoJuego = false;
  if (n.enTieBreak) {
    ganoJuego = n.puntos[g] >= n.objetivoTieBreak && dif >= 2;
  } else if (r.ventaja) {
    ganoJuego = n.puntos[g] >= 4 && dif >= 2;
  } else {
    ganoJuego = n.puntos[g] >= 4;
  }

  const lado = () => (n.ladoA = n.ladoA === "IZQ" ? "DER" : "IZQ");

  if (!ganoJuego) {
    if (n.enTieBreak && (p0 + p1) % 6 === 0) {
      n.cambioDeLado = true;
      lado();
    }
    actualizarSaque(n, orden, primero);
    return n;
  }

  // Ganó el juego (o el tie-break).
  n.finJuego = true;
  const eraTieBreak = n.enTieBreak;
  const eraSuper = n.superTieBreak;
  const tb: [number, number] | null = eraTieBreak ? [p0, p1] : null;
  n.juegos[g]++;
  n.puntos = [0, 0];
  n.juegosJugados++;
  const [j0, j1] = n.juegos;
  const setIndex = n.sets.length;
  const ganoSet = eraSuper || eraTieBreak || (n.juegos[g] >= r.juegosSet && Math.abs(j0 - j1) >= 2);

  if (!ganoSet) {
    const jugados = j0 + j1;
    if (jugados % 2 === 1) {
      n.cambioDeLado = true;
      n.descanso = jugados === 1 ? 0 : 90;
      lado();
    }
    // ¿Empieza un tie-break?
    if (j0 === j1 && j0 === r.tieBreakEn) {
      n.enTieBreak = true;
      n.objetivoTieBreak = r.decisivo === "TB10" && setIndex === r.mejorDe - 1 ? 10 : r.puntosTieBreak;
    }
    actualizarSaque(n, orden, primero);
    return n;
  }

  // Ganó el set.
  n.finSet = true;
  n.sets = [...n.sets, eraSuper ? { a: g === 0 ? 1 : 0, b: g === 1 ? 1 : 0, tb } : { a: j0, b: j1, tb }];
  n.setsGanados[g]++;
  const necesarios = Math.floor(r.mejorDe / 2) + 1;
  if (n.setsGanados[g] >= necesarios) {
    n.ganador = g;
    n.juegos = [0, 0];
    n.enTieBreak = false;
    n.superTieBreak = false;
    return n;
  }
  // Juegos del set terminado: si suman impar se cambia de lado ahora (el tie-break cuenta como juego).
  if ((j0 + j1) % 2 === 1 || eraSuper) {
    n.cambioDeLado = true;
    lado();
  }
  n.descanso = 120;
  n.juegos = [0, 0];
  const sup = esSuperTieBreak(r, n.sets.length);
  n.enTieBreak = sup;
  n.superTieBreak = sup;
  n.objetivoTieBreak = sup ? 10 : r.puntosTieBreak;
  actualizarSaque(n, orden, primero);
  return n;
}

/**
 * Turno de saque: cada juego pasa al siguiente de la rotación. En el tie-break el que abre saca 1 punto
 * y después 2 cada uno; el juego siguiente al tie-break lo abre el siguiente de la rotación.
 */
function actualizarSaque(n: EstadoTenis, orden: string[], primero: Lado) {
  const largo = Math.max(orden.length, 2);
  const k = n.puntos[0] + n.puntos[1];
  const extra = n.enTieBreak ? Math.floor((k + 1) / 2) : 0;
  n.turnoSaque = (n.juegosJugados + extra) % largo;
  n.equipoSaca = ((primero + n.turnoSaque) % 2) as Lado;
  n.ladoSaque = k % 2 === 0 ? "DERECHA" : "IZQUIERDA";
}

export function equipoQueSacaPrimero(m: Pick<MarcadorTenis, "ordenSaque">, idsA: string[]): Lado {
  return idsA.includes(m.ordenSaque[0]) ? 0 : 1;
}

/** Estado del partido a partir de todos sus puntos. */
export function calcular(m: MarcadorTenis, r: ReglasTenis, idsA: string[]): EstadoTenis {
  const primero = equipoQueSacaPrimero(m, idsA);
  let e = inicial(m, r, primero);
  for (const p of m.puntos) e = paso(e, p.g, r, m.ordenSaque, primero);
  return e;
}

/** Aviso para el próximo punto (punto de partido, de set, de quiebre o decisivo) y para quién. */
export function aviso(e: EstadoTenis, m: MarcadorTenis, r: ReglasTenis, idsA: string[]): { tipo: Aviso; para: Lado | null } | null {
  if (e.ganador !== null) return null;
  const primero = equipoQueSacaPrimero(m, idsA);
  for (const tipo of ["PUNTO_DE_PARTIDO", "PUNTO_DE_SET", "PUNTO_DE_QUIEBRE"] as const) {
    for (const g of [e.equipoSaca, otro(e.equipoSaca)] as Lado[]) {
      const s = paso(e, g, r, m.ordenSaque, primero);
      if (tipo === "PUNTO_DE_PARTIDO" && s.ganador === g) return { tipo, para: g };
      if (tipo === "PUNTO_DE_SET" && s.finSet) return { tipo, para: g };
      if (tipo === "PUNTO_DE_QUIEBRE" && s.finJuego && !e.enTieBreak && g !== e.equipoSaca) return { tipo, para: g };
    }
  }
  if (!r.ventaja && !e.enTieBreak && e.puntos[0] === 3 && e.puntos[1] === 3) return { tipo: "PUNTO_DECISIVO", para: null };
  return null;
}

const NOMBRES_PUNTO = ["0", "15", "30", "40"];

/** Lo que se canta: "15", "40", "AD", o los puntos del tie-break. */
export function textoPuntos(e: EstadoTenis, r: ReglasTenis): [string, string] {
  const [a, b] = e.puntos;
  if (e.enTieBreak) return [String(a), String(b)];
  if (a >= 3 && b >= 3 && r.ventaja) {
    if (a === b) return ["40", "40"];
    return a > b ? ["AD", ""] : ["", "AD"];
  }
  return [NOMBRES_PUNTO[Math.min(a, 3)], NOMBRES_PUNTO[Math.min(b, 3)]];
}

/** Lo que dice el árbitro en voz alta: el sacador primero. */
export function canto(e: EstadoTenis, r: ReglasTenis): string {
  const [a, b] = e.puntos;
  if (e.ganador !== null) return "Juego, set y partido";
  if (e.finSet) return "Juego y set";
  if (e.finJuego) return "Juego";
  const s = e.equipoSaca;
  const [ps, pr] = s === 0 ? [a, b] : [b, a];
  if (e.enTieBreak) return ps === pr ? `${ps} iguales` : `${ps}-${pr}`;
  if (ps === 0 && pr === 0) return "";
  if (ps >= 3 && pr >= 3) {
    if (ps === pr) return r.ventaja ? "Iguales" : "Punto decisivo";
    return ps > pr ? "Ventaja al saque" : "Ventaja al resto";
  }
  const t = (x: number) => (x === 0 ? "Cero" : NOMBRES_PUNTO[x]);
  return ps === pr ? `${t(ps)} iguales` : `${t(ps)}-${t(pr).toLowerCase()}`;
}

/* ---------- Estadísticas ---------- */

export interface StatsEquipo {
  puntos: number;
  aces: number;
  doblesFaltas: number;
  /** Puntos de saque jugados, con primer saque adentro, y ganados con 1ro / 2do. */
  puntosSaque: number;
  primerosAdentro: number;
  ganadosPrimero: number;
  segundos: number;
  ganadosSegundo: number;
  /** Puntos de quiebre que tuvo (al resto) y que convirtió. */
  quiebresOportunidad: number;
  quiebresGanados: number;
  /** Juegos de saque jugados y ganados. */
  juegosSaque: number;
  juegosSaqueGanados: number;
  winners: number;
  erroresNoForzados: number;
  rachaMax: number;
}

const vacio = (): StatsEquipo => ({
  puntos: 0,
  aces: 0,
  doblesFaltas: 0,
  puntosSaque: 0,
  primerosAdentro: 0,
  ganadosPrimero: 0,
  segundos: 0,
  ganadosSegundo: 0,
  quiebresOportunidad: 0,
  quiebresGanados: 0,
  juegosSaque: 0,
  juegosSaqueGanados: 0,
  winners: 0,
  erroresNoForzados: 0,
  rachaMax: 0,
});

export interface Analisis {
  stats: [StatsEquipo, StatsEquipo];
  /** Diferencia acumulada de puntos (A − B) tras cada punto: el gráfico de impulso. */
  impulso: number[];
  /** Índices de los puntos que cerraron un set (para marcar el gráfico). */
  cortesSet: number[];
  /** Índices de los puntos que fueron quiebre. */
  quiebres: { i: number; equipo: Lado }[];
}

export function analizar(m: MarcadorTenis, r: ReglasTenis, idsA: string[]): Analisis {
  const primero = equipoQueSacaPrimero(m, idsA);
  const stats: [StatsEquipo, StatsEquipo] = [vacio(), vacio()];
  const impulso: number[] = [];
  const cortesSet: number[] = [];
  const quiebres: { i: number; equipo: Lado }[] = [];
  let e = inicial(m, r, primero);
  let dif = 0;
  const racha: [number, number] = [0, 0];
  m.puntos.forEach((p, i) => {
    const s = e.equipoSaca;
    const rr = otro(s);
    const st = stats[s];
    const er = stats[rr];
    st.puntosSaque++;
    if (p.s === 1) st.primerosAdentro++;
    else st.segundos++;
    if (p.g === s) {
      if (p.s === 1) st.ganadosPrimero++;
      else st.ganadosSegundo++;
    }
    if (p.tipo === "ACE") st.aces++;
    if (p.tipo === "DOBLE_FALTA") st.doblesFaltas++;
    if (p.tipo === "WINNER") stats[p.g].winners++;
    if (p.tipo === "ERROR_NF") stats[otro(p.g)].erroresNoForzados++;
    // ¿Era punto de quiebre?
    if (!e.enTieBreak) {
      const sim = paso(e, rr, r, m.ordenSaque, primero);
      if (sim.finJuego) {
        er.quiebresOportunidad++;
        if (p.g === rr) er.quiebresGanados++;
      }
    }
    stats[p.g].puntos++;
    racha[p.g]++;
    racha[otro(p.g)] = 0;
    stats[p.g].rachaMax = Math.max(stats[p.g].rachaMax, racha[p.g]);
    const antes = e;
    e = paso(e, p.g, r, m.ordenSaque, primero);
    if (e.finJuego && !antes.enTieBreak) {
      st.juegosSaque++;
      if (p.g === s) st.juegosSaqueGanados++;
      else quiebres.push({ i, equipo: rr });
    }
    if (e.finSet) cortesSet.push(i);
    dif += p.g === 0 ? 1 : -1;
    impulso.push(dif);
  });
  return { stats, impulso, cortesSet, quiebres };
}

/** Resultado para guardar en el partido (sets) a partir del marcador. */
export function setsDe(e: EstadoTenis): SetJugado[] {
  const enCurso = e.ganador === null && (e.juegos[0] + e.juegos[1] > 0 || e.puntos[0] + e.puntos[1] > 0);
  return enCurso ? [...e.sets, { a: e.juegos[0], b: e.juegos[1], tb: e.enTieBreak ? [e.puntos[0], e.puntos[1]] : null }] : e.sets;
}

export function nuevoMarcador(ordenSaque: string[], ladoInicialA: "IZQ" | "DER", sorteo: MarcadorTenis["sorteo"], arbitro?: string | null): MarcadorTenis {
  return { ordenSaque, ladoInicialA, sorteo, puntos: [], falta: false, marcas: [], inicio: new Date().toISOString(), fin: null, arbitro: arbitro ?? null };
}

/** Anota un punto. Con `falta` pendiente el punto se juega con segundo saque. */
export function anotar(m: MarcadorTenis, g: Lado, tipo?: PuntoTenis["tipo"], j?: string): MarcadorTenis {
  const p: PuntoTenis = { g, s: m.falta ? 2 : 1, en: new Date().toISOString() };
  if (tipo) p.tipo = tipo;
  if (j) p.j = j;
  return { ...m, falta: false, puntos: [...m.puntos, p] };
}

/** Falta de saque: la primera deja el segundo saque; la segunda es doble falta (punto al resto). */
export function falta(m: MarcadorTenis, sacador: Lado, jugador?: string): MarcadorTenis {
  if (!m.falta) return { ...m, falta: true };
  return anotar(m, otro(sacador), "DOBLE_FALTA", jugador);
}

export function deshacer(m: MarcadorTenis): MarcadorTenis {
  if (m.falta) return { ...m, falta: false };
  const ultimo = m.puntos.at(-1);
  if (!ultimo) return m;
  // Si el último punto fue doble falta, se vuelve al segundo saque.
  return { ...m, puntos: m.puntos.slice(0, -1), falta: ultimo.tipo === "DOBLE_FALTA", marcas: m.marcas.filter((x) => x.punto < m.puntos.length - 1), fin: null };
}

/** Nombre del set: "6-4", "7-6(5)", "[10-8]". */
export function textoSet(s: SetJugado, superTb = false): string {
  if (superTb && s.tb) return `[${s.tb[0]}-${s.tb[1]}]`;
  if (s.tb) return `${s.a}-${s.b}(${Math.min(s.tb[0], s.tb[1])})`;
  return `${s.a}-${s.b}`;
}
