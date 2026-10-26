/**
 * Tenis: modelos de la sección de tenis (cancha dura y arcilla).
 * Va aparte de pádel (types/torneo.ts): otras reglas (ITF), singles o dobles y otra superficie.
 */

/** DURA = hard court (cemento/acrílico). ARCILLA = clay court (polvo de ladrillo). */
export type Superficie = "DURA" | "ARCILLA";
export type Modalidad = "SINGLES" | "DOBLES";
export type Rama = "MASCULINO" | "FEMENINO" | "MIXTO";
/** 0 = equipo A, 1 = equipo B. */
export type Lado = 0 | 1;

export type FormatoPartidoId = "CLASICO" | "SUPER_TB" | "SETS_CORTOS" | "PRO_SET" | "GRAND_SLAM";

/** Reglas de un partido según el reglamento ITF (Rules of Tennis, apéndice de formatos). */
export interface ReglasTenis {
  formato: FormatoPartidoId;
  mejorDe: 1 | 3 | 5;
  /** Juegos para ganar un set (6; 4 en sets cortos; 8 en pro set). */
  juegosSet: number;
  /** Con los juegos igualados en este número se juega tie-break. */
  tieBreakEn: number;
  /** Puntos del tie-break normal (7). */
  puntosTieBreak: number;
  /** false = sin ventaja (punto decisivo en iguales, el que resta elige el lado). */
  ventaja: boolean;
  /**
   * Cómo se define el último set: IGUAL (como los demás), SUPER_TB (match tie-break a 10 en lugar del set)
   * o TB10 (set completo, y en 6-6 tie-break a 10, como los Grand Slam).
   */
  decisivo: "IGUAL" | "SUPER_TB" | "TB10";
}

export interface JugadorTenis {
  id: string;
  nombre: string;
  fotoUrl?: string | null;
}

/** Un inscrito: un jugador en singles, una pareja en dobles. */
export interface InscritoTenis {
  id: string;
  jugadores: JugadorTenis[];
  /** Cabeza de serie (1 = primer favorito). */
  siembra?: number | null;
}

export type TipoPunto = "ACE" | "DOBLE_FALTA" | "WINNER" | "ERROR_NF" | "ERROR_F";

export interface PuntoTenis {
  /** Quién ganó el punto. */
  g: Lado;
  /** Con qué saque se jugó (2 = hubo falta en el primero). */
  s: 1 | 2;
  tipo?: TipoPunto;
  /** Jugador que hizo el ace, el winner o el error (opcional). */
  j?: string;
  en: string;
}

/** Revisión de marca en arcilla (solo en canchas de arcilla, ITF). */
export interface MarcaRevisada {
  en: string;
  /** Punto (índice en `puntos`) en que se revisó. */
  punto: number;
  /** BUENA = la pelota tocó la línea. */
  resultado: "BUENA" | "MALA";
}

export interface MarcadorTenis {
  /** Orden de saque: jugadores en rotación (singles [A, B]; dobles [A1, B1, A2, B2]). */
  ordenSaque: string[];
  /** Lado de la cancha donde empieza el equipo A (para la pantalla y el anotador). */
  ladoInicialA: "IZQ" | "DER";
  /** Quién ganó el sorteo y qué eligió (se muestra en el relato). */
  sorteo?: { gano: Lado; eligio: "SACAR" | "RESTAR" | "LADO" } | null;
  puntos: PuntoTenis[];
  /** Hubo falta en el primer saque del punto en juego. */
  falta: boolean;
  marcas: MarcaRevisada[];
  inicio: string;
  fin?: string | null;
  arbitro?: string | null;
}

export interface SetJugado {
  a: number;
  b: number;
  /** Puntos del tie-break (o del súper tie-break) si se jugó. */
  tb?: [number, number] | null;
}

export type EstadoPartidoTenis = "PENDIENTE" | "LLAMADO" | "EN_JUEGO" | "FINALIZADO";

export interface PartidoTenis {
  id: string;
  /** 1 = primera ronda. En liga, la jornada. */
  ronda: number;
  /** Posición dentro de la ronda (para avanzar en el cuadro). */
  orden: number;
  a: string | null;
  b: string | null;
  estado: EstadoPartidoTenis;
  cancha?: number | null;
  marcador?: MarcadorTenis | null;
  resultado?: { ganador: Lado; sets: SetJugado[]; tipo: "NORMAL" | "WO" | "RETIRO" | "BYE" } | null;
  actualizadoEn: string;
}

export type FormatoCuadro = "ELIMINACION" | "LIGA" | "PARTIDO";

export interface TorneoTenis {
  id: string;
  nombre: string;
  superficie: Superficie;
  modalidad: Modalidad;
  rama: Rama;
  /** Categoría libre: Open, 1ra, 2da, Junior 14, +45… */
  categoria: string;
  reglas: ReglasTenis;
  formato: FormatoCuadro;
  fecha: string;
  canchas: number;
  inscritos: InscritoTenis[];
  partidos: PartidoTenis[];
  estado: "INSCRIPCION" | "EN_JUEGO" | "FINALIZADO";
  creadoEn: string;
  actualizadoEn: string;
  eliminado?: boolean;
}

export interface ApiTenisRespuesta {
  modo: "DEMO" | "SUPABASE";
  torneos: TorneoTenis[];
}
