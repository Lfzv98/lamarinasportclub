/**
 * Motor del marcador punto a punto (pádel).
 *
 * El marcador guarda solo la lista de puntos; todo lo demás (games, sets, quién
 * saca, cambio de lado, punto de oro, tie-break, break/set/match point y
 * estadísticas) se calcula re-jugando esa lista. Así "Deshacer" es quitar el
 * último punto y nunca queda un estado inconsistente.
 */
import type { FinPunto, Golpe, MarcadorVivo, PuntoRegistrado, ReglasPartido } from "@/types/torneo";
import type { SetScore } from "@/types/americano";

export type Lado = "A" | "B";
const otro = (l: Lado): Lado => (l === "A" ? "B" : "A");
const k = (l: Lado) => (l === "A" ? "a" : "b");

export type EventoPunto = "GAME" | "SET" | "PARTIDO" | null;

export interface PuntoJugado extends PuntoRegistrado {
  n: number;
  sacador: string;
  equipoSaca: Lado;
  /** Marcador antes del punto, desde A: "30-40", "5-4" en tie. */
  antes: string;
  /** Se jugó a punto de oro (40-40 con punto de oro). */
  oro: boolean;
  /** Antes del punto, la dupla que resta tenía break point. */
  breakPoint: boolean;
  enTie: boolean;
  evento: EventoPunto;
  /** Games del set tras el punto, ej. {a: 4, b: 3}. */
  games: SetScore;
  setIndex: number;
}

export interface EstadoMarcador {
  /** Sets cerrados + el set en curso (si no terminó el partido). */
  sets: SetScore[];
  setActual: number;
  games: SetScore;
  /** Puntos del game (o del tie) en curso. */
  puntos: SetScore;
  enTie: boolean;
  enSuperTie: boolean;
  sacador: string;
  equipoSaca: Lado;
  setsGanados: SetScore;
  terminado: boolean;
  ganador: Lado | null;
  /** 40-40 con punto de oro: el próximo punto define el game. */
  puntoDeOro: boolean;
  breakPoint: Lado | null;
  setPoint: Lado | null;
  matchPoint: Lado | null;
  /** Tras el último punto, los jugadores cambian de lado. */
  cambioDeLado: boolean;
  /** Texto de los puntos: ["40", "AD"] o ["5", "4"] en tie. */
  texto: [string, string];
  jugados: PuntoJugado[];
  /** Puntos seguidos de la dupla que ganó el último. */
  racha: { lado: Lado | null; puntos: number };
}

const ETIQUETA = ["0", "15", "30", "40"];

export const setsNecesarios = (r: ReglasPartido) => (r.sets === 3 ? 2 : 1);

/** ¿El set `i` se juega como súper tie-break? */
export const esSuperTie = (r: ReglasPartido, i: number) => r.sets === 3 && r.superTie && i === 2;

function textoGame(p: SetScore, oro: boolean): [string, string] {
  if (p.a >= 3 && p.b >= 3) {
    if (oro || p.a === p.b) return ["40", "40"];
    return p.a > p.b ? ["AD", "40"] : ["40", "AD"];
  }
  return [ETIQUETA[Math.min(p.a, 3)], ETIQUETA[Math.min(p.b, 3)]];
}

/** ¿Este punto, si lo gana `l`, cierra el game/tie? */
function cierraGame(r: ReglasPartido, p: SetScore, l: Lado, enTie: boolean, superTie: boolean): boolean {
  const mio = p[k(l)] + 1;
  const suyo = p[k(otro(l))];
  if (enTie) {
    const meta = superTie ? 10 : 7;
    return mio >= meta && mio - suyo >= 2;
  }
  if (r.puntoDeOro && p.a === 3 && p.b === 3) return true;
  return mio >= 4 && mio - suyo >= 2;
}

function cierraSet(r: ReglasPartido, g: SetScore, l: Lado, enTie: boolean): boolean {
  if (enTie) return true;
  const mio = g[k(l)] + 1;
  const suyo = g[k(otro(l))];
  return mio >= r.games && mio - suyo >= 2;
}

function entraEnTie(r: ReglasPartido, g: SetScore): boolean {
  return r.tieBreakEn !== null && g.a === r.tieBreakEn && g.b === r.tieBreakEn;
}

export function calcularMarcador(m: Pick<MarcadorVivo, "reglas" | "ordenSaque" | "puntos" | "jugadoresA">): EstadoMarcador {
  const r = m.reglas;
  const orden = m.ordenSaque;
  const equipoDe = (id: string): Lado => (m.jugadoresA.includes(id) ? "A" : "B");

  const sets: SetScore[] = [{ a: 0, b: 0 }];
  let setActual = 0;
  let games: SetScore = { a: 0, b: 0 };
  let puntos: SetScore = { a: 0, b: 0 };
  let enTie = esSuperTie(r, 0);
  let numGame = 0; // games jugados en todo el partido (para el orden de saque)
  let puntosEnTie = 0;
  const setsG: SetScore = { a: 0, b: 0 };
  let terminado = false;
  let ganador: Lado | null = null;
  let cambioDeLado = false;
  const jugados: PuntoJugado[] = [];
  let racha = { lado: null as Lado | null, puntos: 0 };

  const sacadorActual = () => (enTie ? orden[(numGame + Math.floor((puntosEnTie + 1) / 2)) % 4] : orden[numGame % 4]);

  m.puntos.forEach((pt, n) => {
    if (terminado) return;
    const sacador = sacadorActual();
    const equipoSaca = equipoDe(sacador);
    const superT = esSuperTie(r, setActual);
    const oro = !enTie && r.puntoDeOro && puntos.a === 3 && puntos.b === 3;
    const resta = otro(equipoSaca);
    const breakPoint = !enTie && cierraGame(r, puntos, resta, false, false);
    const antes = enTie ? `${puntos.a}-${puntos.b}` : textoGame(puntos, r.puntoDeOro).join("-");
    const tieAntes = enTie;
    const setAntes = setActual;
    const l = pt.gana;
    let evento: EventoPunto = null;
    cambioDeLado = false;

    racha = racha.lado === l ? { lado: l, puntos: racha.puntos + 1 } : { lado: l, puntos: 1 };

    if (cierraGame(r, puntos, l, enTie, superT)) {
      evento = "GAME";
      const setCerrado = cierraSet(r, games, l, enTie);
      games = { ...games, [k(l)]: games[k(l)] + 1 };
      numGame++;
      puntos = { a: 0, b: 0 };
      puntosEnTie = 0;
      if (setCerrado) {
        evento = "SET";
        sets[setActual] = { ...games };
        setsG[k(l)]++;
        const totalSet = games.a + games.b;
        if (setsG[k(l)] >= setsNecesarios(r)) {
          terminado = true;
          ganador = l;
          evento = "PARTIDO";
        } else {
          setActual++;
          sets.push({ a: 0, b: 0 });
          games = { a: 0, b: 0 };
          enTie = esSuperTie(r, setActual);
          // Tras un set con número impar de games se cambia de lado (el tie-break cuenta como un game).
          cambioDeLado = totalSet % 2 === 1;
        }
      } else {
        sets[setActual] = { ...games };
        enTie = entraEnTie(r, games);
        cambioDeLado = (games.a + games.b) % 2 === 1;
      }
    } else {
      puntos = { ...puntos, [k(l)]: puntos[k(l)] + 1 };
      if (enTie) {
        puntosEnTie++;
        cambioDeLado = puntosEnTie % 6 === 0;
      }
    }

    jugados.push({ ...pt, n: n + 1, sacador, equipoSaca, antes, oro, breakPoint, enTie: tieAntes, evento, games: { ...sets[setAntes] }, setIndex: setAntes });
  });

  const sacador = sacadorActual();
  const equipoSaca = equipoDe(sacador);
  const superT = esSuperTie(r, setActual);
  const resta = otro(equipoSaca);
  const puntoDeOro = !terminado && !enTie && r.puntoDeOro && puntos.a === 3 && puntos.b === 3;
  const breakPoint = !terminado && !enTie && cierraGame(r, puntos, resta, false, false) ? resta : null;
  const amenaza = (l: Lado) => !terminado && cierraGame(r, puntos, l, enTie, superT) && cierraSet(r, games, l, enTie);
  const setPoint = amenaza("A") ? "A" : amenaza("B") ? "B" : null;
  const matchPoint = setPoint && setsG[k(setPoint)] + 1 >= setsNecesarios(r) ? setPoint : null;
  const texto: [string, string] = enTie ? [String(puntos.a), String(puntos.b)] : textoGame(puntos, r.puntoDeOro);

  return {
    sets,
    setActual,
    games,
    puntos,
    enTie,
    enSuperTie: enTie && superT,
    sacador,
    equipoSaca,
    setsGanados: setsG,
    terminado,
    ganador,
    puntoDeOro,
    breakPoint,
    setPoint,
    matchPoint,
    cambioDeLado,
    texto,
    jugados,
    racha,
  };
}

/** Sets para guardar como resultado del partido (sin el set vacío final). */
export function setsFinales(e: EstadoMarcador): SetScore[] {
  return e.sets.filter((s, i) => i < e.setActual || s.a + s.b > 0 || e.terminado);
}

/* ---------- registrar ---------- */

export function anotarPunto(m: MarcadorVivo, gana: Lado, detalle: Partial<Pick<PuntoRegistrado, "fin" | "jugadorId" | "golpe">> = {}): MarcadorVivo {
  if (calcularMarcador(m).terminado) return m;
  const punto: PuntoRegistrado = {
    gana,
    fin: detalle.fin ?? null,
    jugadorId: detalle.jugadorId ?? null,
    golpe: detalle.golpe ?? null,
    primerSaqueFalla: m.faltaPendiente || undefined,
    t: new Date().toISOString(),
  };
  return { ...m, puntos: [...m.puntos, punto], faltaPendiente: false, actualizadoEn: new Date().toISOString() };
}

/** Completa el detalle del último punto (toques 2 y 3 del anotador). */
export function detallarUltimo(m: MarcadorVivo, detalle: Partial<Pick<PuntoRegistrado, "fin" | "jugadorId" | "golpe">>): MarcadorVivo {
  if (!m.puntos.length) return m;
  const puntos = [...m.puntos];
  puntos[puntos.length - 1] = { ...puntos[puntos.length - 1], ...detalle };
  return { ...m, puntos, actualizadoEn: new Date().toISOString() };
}

/** Falta de saque: la primera queda pendiente; la segunda es doble falta (punto para quien resta). */
export function faltaSaque(m: MarcadorVivo): MarcadorVivo {
  const e = calcularMarcador(m);
  if (e.terminado) return m;
  if (!m.faltaPendiente) return { ...m, faltaPendiente: true, actualizadoEn: new Date().toISOString() };
  return anotarPunto(m, otro(e.equipoSaca), { fin: "DOBLE_FALTA", jugadorId: e.sacador, golpe: "SAQUE" });
}

export function ace(m: MarcadorVivo): MarcadorVivo {
  const e = calcularMarcador(m);
  return anotarPunto(m, e.equipoSaca, { fin: "ACE", jugadorId: e.sacador, golpe: "SAQUE" });
}

export function deshacer(m: MarcadorVivo): MarcadorVivo {
  if (m.faltaPendiente) return { ...m, faltaPendiente: false, actualizadoEn: new Date().toISOString() };
  if (!m.puntos.length) return m;
  return { ...m, puntos: m.puntos.slice(0, -1), actualizadoEn: new Date().toISOString() };
}

/* ---------- relato ---------- */

export const NOMBRE_FIN: Record<FinPunto, string> = {
  WINNER: "Winner",
  ERROR_NO_FORZADO: "Error no forzado",
  ERROR_FORZADO: "Error forzado",
  ACE: "Ace",
  DOBLE_FALTA: "Doble falta",
};

export const NOMBRE_GOLPE: Record<Golpe, string> = {
  REMATE: "remate",
  X3: "x3",
  X4: "x4",
  VIBORA: "víbora",
  BANDEJA: "bandeja",
  VOLEA: "volea",
  GLOBO: "globo",
  CHIQUITA: "chiquita",
  BAJADA: "bajada de pared",
  DRIVE: "drive",
  REVES: "revés",
  SAQUE: "saque",
};

export function relatoPunto(p: PuntoJugado, nombreJugador: (id: string) => string, nombreLado: (l: Lado) => string): string {
  const quien = p.jugadorId ? nombreJugador(p.jugadorId) : null;
  let base = `Punto para ${nombreLado(p.gana)}`;
  if (p.fin === "ACE") base = `${quien}, ace. ${base}`;
  else if (p.fin === "DOBLE_FALTA") base = `${quien}, doble falta. ${base}`;
  else if (p.fin) {
    const golpe = p.golpe && p.golpe !== "SAQUE" ? ` de ${NOMBRE_GOLPE[p.golpe]}` : "";
    base = `${quien ? `${quien}, ` : ""}${NOMBRE_FIN[p.fin].toLowerCase()}${golpe}. ${base}`;
  }
  base = base.charAt(0).toUpperCase() + base.slice(1);
  if (p.oro) base += " · punto de oro";
  if (p.breakPoint && p.gana !== p.equipoSaca) base += " · break";
  return base;
}

/* ---------- estadísticas ---------- */

export interface StatsJugador {
  jugadorId: string;
  lado: Lado;
  puntosJugados: number;
  puntosGanados: number;
  winners: number;
  erroresNoForzados: number;
  erroresForzados: number;
  aces: number;
  doblesFaltas: number;
  saques: number;
  primerosDentro: number;
  puntosAlSaque: number;
  ganadosAlSaque: number;
  puntosAlResto: number;
  ganadosAlResto: number;
  puntosDeOro: number;
  puntosDeOroGanados: number;
  breakPoints: number;
  breaksConvertidos: number;
  rachaMax: number;
  /** Golpes que cerraron puntos: winners (a favor) y errores (en contra). */
  golpes: Partial<Record<Golpe, { winners: number; errores: number }>>;
}

export function statsVacias(jugadorId: string, lado: Lado): StatsJugador {
  return {
    jugadorId,
    lado,
    puntosJugados: 0,
    puntosGanados: 0,
    winners: 0,
    erroresNoForzados: 0,
    erroresForzados: 0,
    aces: 0,
    doblesFaltas: 0,
    saques: 0,
    primerosDentro: 0,
    puntosAlSaque: 0,
    ganadosAlSaque: 0,
    puntosAlResto: 0,
    ganadosAlResto: 0,
    puntosDeOro: 0,
    puntosDeOroGanados: 0,
    breakPoints: 0,
    breaksConvertidos: 0,
    rachaMax: 0,
    golpes: {},
  };
}

export function statsPartido(m: MarcadorVivo): StatsJugador[] {
  const e = calcularMarcador(m);
  const ladoDe = (id: string): Lado => (m.jugadoresA.includes(id) ? "A" : "B");
  const stats = new Map<string, StatsJugador>([...m.jugadoresA, ...m.jugadoresB].map((id) => [id, statsVacias(id, ladoDe(id))]));
  const rachas: Record<Lado, number> = { A: 0, B: 0 };
  let ultimo: Lado | null = null;
  let actual = 0;
  for (const p of e.jugados) {
    actual = ultimo === p.gana ? actual + 1 : 1;
    ultimo = p.gana;
    rachas[p.gana] = Math.max(rachas[p.gana], actual);
    for (const s of stats.values()) {
      s.puntosJugados++;
      const gano = s.lado === p.gana;
      if (gano) s.puntosGanados++;
      if (p.oro) {
        s.puntosDeOro++;
        if (gano) s.puntosDeOroGanados++;
      }
      if (s.lado === p.equipoSaca) {
        if (p.sacador === s.jugadorId) {
          s.puntosAlSaque++;
          if (gano) s.ganadosAlSaque++;
        }
      } else {
        s.puntosAlResto++;
        if (gano) s.ganadosAlResto++;
        if (p.breakPoint) {
          s.breakPoints++;
          if (gano) s.breaksConvertidos++;
        }
      }
    }
    const sac = stats.get(p.sacador);
    if (sac) {
      sac.saques++;
      if (!p.primerSaqueFalla) sac.primerosDentro++;
    }
    const prot = p.jugadorId ? stats.get(p.jugadorId) : undefined;
    if (prot && p.fin) {
      if (p.fin === "WINNER") prot.winners++;
      if (p.fin === "ACE") {
        prot.aces++;
        prot.winners++;
      }
      if (p.fin === "ERROR_NO_FORZADO") prot.erroresNoForzados++;
      if (p.fin === "ERROR_FORZADO") prot.erroresForzados++;
      if (p.fin === "DOBLE_FALTA") prot.doblesFaltas++;
      if (p.golpe) {
        const g = (prot.golpes[p.golpe] ??= { winners: 0, errores: 0 });
        if (p.fin === "WINNER" || p.fin === "ACE") g.winners++;
        else g.errores++;
      }
    }
  }
  for (const s of stats.values()) s.rachaMax = rachas[s.lado];
  return [...stats.values()];
}

/** Suma estadísticas de varios partidos (ej. todo el torneo de un jugador). */
export function sumarStats(lista: StatsJugador[]): StatsJugador | null {
  if (!lista.length) return null;
  const out = statsVacias(lista[0].jugadorId, lista[0].lado);
  for (const s of lista) {
    for (const key of Object.keys(out) as (keyof StatsJugador)[]) {
      if (typeof out[key] === "number" && key !== "rachaMax") (out[key] as number) += s[key] as number;
    }
    out.rachaMax = Math.max(out.rachaMax, s.rachaMax);
    for (const [g, v] of Object.entries(s.golpes) as [Golpe, { winners: number; errores: number }][]) {
      const t = (out.golpes[g] ??= { winners: 0, errores: 0 });
      t.winners += v.winners;
      t.errores += v.errores;
    }
  }
  return out;
}

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export function nuevoMarcador(input: {
  partidoId: string;
  torneoId: string;
  categoriaId: string;
  reglas: ReglasPartido;
  jugadoresA: [string, string];
  jugadoresB: [string, string];
  /** Quién saca primero en cada dupla y qué dupla empieza. */
  sacaPrimero: Lado;
  primerA: string;
  primerB: string;
  pista?: number | null;
  anotador?: string;
}): MarcadorVivo {
  const segA = input.jugadoresA.find((j) => j !== input.primerA)!;
  const segB = input.jugadoresB.find((j) => j !== input.primerB)!;
  const ordenSaque: [string, string, string, string] =
    input.sacaPrimero === "A" ? [input.primerA, input.primerB, segA, segB] : [input.primerB, input.primerA, segB, segA];
  const ahora = new Date().toISOString();
  return {
    id: input.partidoId,
    torneoId: input.torneoId,
    categoriaId: input.categoriaId,
    reglas: input.reglas,
    ordenSaque,
    jugadoresA: input.jugadoresA,
    jugadoresB: input.jugadoresB,
    puntos: [],
    pista: input.pista ?? null,
    anotador: input.anotador,
    iniciadoEn: ahora,
    finalizado: false,
    actualizadoEn: ahora,
  };
}
