/**
 * Modelos de dominio de Americanos & Torneos (PadelReserve · La Marina Sport Club).
 *
 * Estas interfaces son el contrato entre el frontend y los endpoints de
 * `/app/api/americanos`. El backend (Supabase) solo necesita mapear sus tablas
 * a estas formas; ver `lib/server/repository.ts`.
 */

export type Genero = "M" | "F";

export type Rama = "FEMENINO" | "MASCULINO" | "MIXTO";

export type Nivel = "7MA" | "6TA" | "5TA" | "4TA" | "3RA" | "OPEN";

export interface Categoria {
  rama: Rama;
  nivel: Nivel;
}

/** Individual Rotativo = Americano tradicional (cambias de pareja cada ronda). */
export type Modalidad = "INDIVIDUAL_ROTATIVO" | "DUPLA_FIJA";

export type MetodoPuntuacion =
  /** Se juega un total fijo de puntos por partido (ej. 24). Cuenta cada punto. */
  | "PUNTOS_TOTALES"
  /** Partido a N games con punto de oro en 40-40. */
  | "GAMES_PUNTO_ORO"
  /** Sets cortos a N games (al mejor de X sets). */
  | "SETS_CORTOS";

export type EstadoEvento = "BORRADOR" | "EN_CURSO" | "FINALIZADO";
export type EstadoRonda = "PENDIENTE" | "EN_JUEGO" | "PAUSADA" | "FINALIZADA";
export type EstadoPartido = "PENDIENTE" | "EN_JUEGO" | "FINALIZADO";

export interface Jugador {
  id: string;
  nombre: string;
  apellido?: string;
  /** URL de foto (opcional). Si falta, la UI muestra iniciales. */
  fotoUrl?: string | null;
  genero: Genero;
  /** Nivel declarado. Usado para balancear parejas. */
  nivel?: Nivel;
  /** Rating numérico opcional (1-10). Si falta se deriva de `nivel`. */
  rating?: number;
  /** id del usuario en PadelReserve, si existe. */
  usuarioId?: string | null;
}

export interface Pareja {
  id: string;
  jugadorIds: [string, string];
  /** Nombre visible, ej. "Ana / Lucía". */
  nombre?: string;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface Resultado {
  /** Puntos / games totales de la pareja A. */
  puntosA: number;
  /** Puntos / games totales de la pareja B. */
  puntosB: number;
  /** Solo en SETS_CORTOS. */
  sets?: SetScore[];
}

export interface Partido {
  id: string;
  rondaNumero: number;
  /** Número de la pista física (ver EventoAmericano.canchas). */
  pista: number;
  parejaA: Pareja;
  parejaB: Pareja;
  estado: EstadoPartido;
  resultado?: Resultado | null;
  actualizadoEn?: string;
}

export interface Ronda {
  numero: number;
  estado: EstadoRonda;
  partidos: Partido[];
  /** Jugadores (o parejas en dupla fija) que descansan esta ronda. */
  descansanIds: string[];
  /** ISO de inicio del cronómetro (se reinicia al reanudar). */
  inicioEn?: string | null;
  /** Segundos ya consumidos antes de la última pausa. */
  segundosAcumulados?: number;
}

export interface ConfigPuntuacion {
  metodo: MetodoPuntuacion;
  /** PUNTOS_TOTALES: puntos por partido (ej. 24, 32). */
  puntosPorPartido?: number;
  /** GAMES_PUNTO_ORO: games por partido (ej. 6). SETS_CORTOS: games por set (ej. 4). */
  gamesPorPartido?: number;
  /** SETS_CORTOS: cantidad máxima de sets (ej. 3 = al mejor de 3). */
  setsMaximos?: number;
}

export interface FilaPosicion {
  /** jugadorId (individual) o parejaId (dupla fija). */
  entidadId: string;
  nombre: string;
  fotoUrls: (string | null | undefined)[];
  posicion: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  puntosAFavor: number;
  puntosEnContra: number;
  diferencia: number;
  /** Puntos de clasificación (ver lib/scoring.ts). */
  puntos: number;
}

export interface TablaPosiciones {
  eventoId: string;
  tipo: "JUGADOR" | "PAREJA";
  filas: FilaPosicion[];
  generadaEn: string;
}

/** Horario de un día. Horas en formato "HH:MM" (24 h). */
export interface HorarioDia {
  abierto: boolean;
  apertura: string;
  cierre: string;
}

/** Pista física del club. */
export interface PistaClub {
  numero: number;
  nombre: string;
  /** true = techada; false = al aire libre (se puede excluir si llueve). */
  techada: boolean;
  /** Pista habilitada para eventos (mantenimiento, etc.). */
  activa: boolean;
}

/** Datos de contacto y marca del club (se muestran en la app y en el Modo TV). */
export interface ContactoClub {
  instagram?: string;
  whatsapp?: string;
  direccion?: string;
  web?: string;
}

/** Configuración del club. `dias` va indexado como Date#getDay(): 0 = domingo … 6 = sábado. */
export interface ConfigClub {
  nombre: string;
  dias: HorarioDia[];
  /** Minutos de cambio de pista entre rondas. */
  minutosEntreRondas: number;
  pistas: PistaClub[];
  contacto: ContactoClub;
  actualizadoEn: string;
}

export interface EventoAmericano {
  id: string;
  nombre: string;
  club: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** Franja reservada para el evento, "HH:MM". */
  horaInicio: string;
  horaFin: string;
  /** Minutos de cambio entre rondas (se suma a duracionRondaMin para el horario). */
  minutosEntreRondas: number;
  /** Ids de reservas de PadelReserve que bloquean las pistas (los completa el backend). */
  reservaIds?: string[];
  categoria: Categoria;
  modalidad: Modalidad;
  puntuacion: ConfigPuntuacion;
  /** Número de pistas en uso (1 a 6). */
  pistas: number;
  /** Pistas físicas asignadas, en orden de prioridad (la primera recibe el partido de mayor nivel). */
  canchas?: PistaClub[];
  /** Duración de cada ronda en minutos (cronómetro). */
  duracionRondaMin: number;
  totalRondas: number;
  rondaActual: number;
  estado: EstadoEvento;
  jugadores: Jugador[];
  /** Solo en DUPLA_FIJA. */
  parejas: Pareja[];
  rondas: Ronda[];
  /** Semilla del generador de rotaciones (reproducible). */
  semilla: number;
  creadoEn: string;
  actualizadoEn: string;
}

/** Payload del POST /api/americanos */
export type GuardarEventoPayload = { evento: EventoAmericano };

export interface ApiListaRespuesta {
  modo: "DEMO" | "SUPABASE";
  eventos: EventoAmericano[];
}
