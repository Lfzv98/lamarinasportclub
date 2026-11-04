/**
 * Estadísticas del partido por dupla, como las de la transmisión de Premier Padel:
 * puntos ganados, winners, errores no forzados, remates ganadores, saque, breaks, puntos de oro…
 * Lógica pura: la usan la consola del árbitro, la página del partido, la TV de la pista y los tests.
 */
import type { Golpe, MarcadorVivo } from "@/types/torneo";
import { pct, statsPartido, type Lado, type StatsJugador } from "./marcador.ts";

/** Golpes que cuentan como remate en la transmisión: smash, por 3 y por 4. */
const REMATES: Golpe[] = ["REMATE", "X3", "X4"];

/** Totales por dupla: lo individual se suma, lo de la dupla se toma una vez. */
export function porDupla(stats: StatsJugador[], l: Lado) {
  const xs = stats.filter((s) => s.lado === l);
  const suma = (k: keyof StatsJugador) => xs.reduce((n, s) => n + (s[k] as number), 0);
  const uno = xs[0];
  return {
    puntos: uno?.puntosGanados ?? 0,
    jugados: uno?.puntosJugados ?? 0,
    alSaque: suma("ganadosAlSaque"),
    alSaqueDe: suma("puntosAlSaque"),
    alResto: uno?.ganadosAlResto ?? 0,
    alRestoDe: uno?.puntosAlResto ?? 0,
    primeros: suma("primerosDentro"),
    saques: suma("saques"),
    aces: suma("aces"),
    df: suma("doblesFaltas"),
    winners: suma("winners"),
    enf: suma("erroresNoForzados"),
    ef: suma("erroresForzados"),
    remates: xs.reduce((n, s) => n + REMATES.reduce((k, g) => k + (s.golpes[g]?.winners ?? 0), 0), 0),
    bp: uno?.breakPoints ?? 0,
    bpG: uno?.breaksConvertidos ?? 0,
    oro: uno?.puntosDeOro ?? 0,
    oroG: uno?.puntosDeOroGanados ?? 0,
    racha: uno?.rachaMax ?? 0,
  };
}

export interface FilaStat {
  t: string;
  /** Valor para comparar (barra y quién va mejor). */
  a: number;
  b: number;
  /** Texto a mostrar, si no es el número tal cual ("62%", "2/5"). */
  ta?: string;
  tb?: string;
  menosEsMejor?: boolean;
}

/**
 * Filas de la comparativa, en el orden de la transmisión. `corta` deja las 6 que caben en la
 * TV de la pista sin tapar el marcador.
 */
export function filasComparativa(m: MarcadorVivo, corta = false): FilaStat[] {
  const stats = statsPartido(m);
  const A = porDupla(stats, "A");
  const B = porDupla(stats, "B");
  const p = (x: number, de: number) => pct(x, de) ?? 0;
  const filas: (FilaStat & { corta?: boolean })[] = [
    { t: "Puntos ganados", a: A.puntos, b: B.puntos, corta: true },
    { t: "Winners", a: A.winners, b: B.winners, corta: true },
    { t: "Errores no forzados", a: A.enf, b: B.enf, menosEsMejor: true, corta: true },
    { t: "Errores forzados", a: A.ef, b: B.ef, menosEsMejor: true },
    { t: "Remates ganadores", a: A.remates, b: B.remates, corta: true },
    { t: "1er saque dentro", a: p(A.primeros, A.saques), b: p(B.primeros, B.saques), ta: `${p(A.primeros, A.saques)}%`, tb: `${p(B.primeros, B.saques)}%` },
    { t: "Ganados al saque", a: p(A.alSaque, A.alSaqueDe), b: p(B.alSaque, B.alSaqueDe), ta: `${p(A.alSaque, A.alSaqueDe)}%`, tb: `${p(B.alSaque, B.alSaqueDe)}%` },
    { t: "Ganados al resto", a: p(A.alResto, A.alRestoDe), b: p(B.alResto, B.alRestoDe), ta: `${p(A.alResto, A.alRestoDe)}%`, tb: `${p(B.alResto, B.alRestoDe)}%` },
    { t: "Breaks", a: A.bpG, b: B.bpG, ta: `${A.bpG}/${A.bp}`, tb: `${B.bpG}/${B.bp}`, corta: true },
    { t: "Puntos de oro", a: A.oroG, b: B.oroG, ta: `${A.oroG}/${A.oro}`, tb: `${B.oroG}/${B.oro}`, corta: true },
    { t: "Aces", a: A.aces, b: B.aces },
    { t: "Dobles faltas", a: A.df, b: B.df, menosEsMejor: true },
    { t: "Racha máxima", a: A.racha, b: B.racha },
  ];
  return filas.filter((f) => !corta || f.corta).map(({ corta: _c, ...f }) => f);
}
