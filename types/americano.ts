/**
 * Modelos de dominio de Americanos & Torneos (PadelReserve · La Marina Sport Club).
 *
 * Estas interfaces son el contrato entre el frontend y los endpoints de
 * `/app/api/americanos`. El backend (Supabase) solo necesita mapear sus tablas
 * a estas formas; ver `lib/server/repository.ts`.
 */

export type Genero = "M" | "F";

export type Rama = "FEMENINO" | "MASCULINO" | "MIXTO";

export type Nivel = "7MA" | "6TA" | "5TA" | "4TA" | "3RA" | "2DA" | "OPEN";

export interface Categoria {
  rama: Rama;
  /** Nivel de la categoría. En "Suma" es el nivel por defecto de los jugadores nuevos. */
  nivel: Nivel;
  /**
   * Categoría por suma: la suma de las categorías de la pareja no puede ser menor
   * que este número (ej. Suma 9 → 4ta + 5ta, 3ra + 6ta). Open cuenta como 1.
   */
  suma?: number | null;
  /** Nombre personalizado (ej. "Copa Aniversario"). Si existe, reemplaza la etiqueta. */
  nombre?: string | null;
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
  /** Se retiró a mitad del evento: conserva sus puntos pero no entra en nuevas rondas. */
  retirado?: boolean;
}

export interface Pareja {
  id: string;
  jugadorIds: [string, string];
  /** Nombre visible, ej. "Ana / Lucía". */
  nombre?: string;
  /** Dupla fija retirada a mitad del evento. */
  retirada?: boolean;
  /** Foto de la dupla (opcional, solo dupla fija). Si falta, la UI muestra la de cada jugador. */
  fotoUrl?: string | null;
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
  /** Puntos del tie-break que definió un partido a games (opcional, solo informativo). */
  tieBreak?: SetScore | null;
  /** Solo en llaves eliminatorias: quién ganó el punto de oro de desempate si el marcador quedó igualado. */
  desempate?: "A" | "B";
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
  /**
   * Partido cortado por una pista suspendida (lluvia, falla de luz…): queda en espera y se
   * termina en otra pista, primero en la ronda siguiente. `marcador`: cómo iban, ej. "8-6".
   */
  suspendido?: PartidoSuspendido | null;
}

export interface PartidoSuspendido {
  /** ISO de cuándo se suspendió. */
  en: string;
  motivo: string;
  /** Pista donde se estaba jugando. */
  pista: number;
  /** Ronda en la que empezó. */
  ronda: number;
  marcador?: string | null;
}

/** Pista suspendida durante el evento: no recibe partidos hasta que el staff la reactive. */
export interface PistaSuspendida {
  numero: number;
  motivo: string;
  /** ISO */
  desde: string;
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
  /** Solo en la llave del Americano HABIBI: fase eliminatoria de esta ronda. */
  fase?: FaseLlave;
  /** Reglas propias de esta ronda (ej. la final a mejor de 3 sets). Si falta, rige la del evento. */
  puntuacion?: ConfigPuntuacion;
}

/* ---------- Americano HABIBI Tournament: grupos + llave eliminatoria ---------- */

export type FaseLlave = "OCTAVOS" | "CUARTOS" | "SEMIS" | "TERCER_PUESTO" | "FINAL";

/** Ronda en que arranca la llave: define cuántas duplas de cada grupo clasifican (8, 4 o 2). */
export type InicioLlave = "OCTAVOS" | "CUARTOS" | "SEMIS";

export type EmparejarLlave = "EQUILIBRADO" | "POR_ORDEN";

/** Lo lleva el evento "llave", que es además la ficha del torneo HABIBI. */
export interface HabibiLlave {
  rol: "LLAVE";
  /** Los grupos (americanos en dupla fija) en orden: A, B. */
  grupos: { letra: string; eventoId: string }[];
  inicio: InicioLlave;
  /** Se juega el partido por el 3er puesto entre los que pierden las semis. */
  tercerPuesto: boolean;
  /**
   * Grupos individuales: cómo se forman las duplas de la llave con el ranking de cada grupo.
   * EQUILIBRADO: 1º con el último clasificado, 2º con el penúltimo… POR_ORDEN: 1º con 2º, 3º con 4º…
   */
  emparejar?: EmparejarLlave;
  /** Clasificados al armar la llave: "1A" → id de la dupla. Vacío mientras se juegan los grupos. */
  siembra?: Record<string, string>;
  armadaEn?: string | null;
}

/** Lo lleva cada grupo para saber a qué torneo HABIBI pertenece. */
export interface HabibiGrupo {
  rol: "GRUPO";
  torneoId: string;
  letra: string;
}

export interface ConfigPuntuacion {
  metodo: MetodoPuntuacion;
  /** PUNTOS_TOTALES: puntos por partido (ej. 24, 32). */
  puntosPorPartido?: number;
  /** GAMES_PUNTO_ORO: games por partido (ej. 6). SETS_CORTOS: games por set (ej. 4). */
  gamesPorPartido?: number;
  /** SETS_CORTOS: cantidad máxima de sets (ej. 3 = al mejor de 3). */
  setsMaximos?: number;
  /**
   * TOTAL: se juegan N puntos/games entre las dos parejas (ej. 24 puntos → 13-11; 5 games → 3-2).
   * A_GANAR: gana la primera pareja que llega a N (ej. a 13 puntos → 13-9; a 6 games → 6-4).
   * Por defecto: TOTAL en puntos, A_GANAR en games.
   */
  modo?: ModoConteo;
  /** Games y sets: 40-40 se define con un punto (true, por defecto) o con ventaja (false). */
  puntoDeOro?: boolean;
  /** Games: si empatan (ej. 2-2 jugando 5 games), el último game es un tie-break a estos puntos. */
  tieBreak?: number | null;
  /** Sets: el set decisivo se reemplaza por un super tie-break a estos puntos (ej. 10). */
  superTie?: number | null;
  /** Tie-break y super tie: hay que ganar por 2 de diferencia (true, por defecto) o gana el primero en llegar (false, ej. 7-6). */
  tieConDiferencia?: boolean;
  /** Cómo se ordena el ranking. Por defecto: PUNTOS_A_FAVOR en puntos totales, VICTORIAS en games/sets. */
  criterio?: CriterioRanking;
}

/**
 * - PUNTOS_A_FAVOR: cada jugador suma los puntos/games de su pareja en TODOS sus partidos (americano clásico).
 * - SOLO_GANADOS: solo suma los puntos/games de los partidos que ganó.
 * - VICTORIAS: 3 por partido ganado, 1 por empate.
 */
export type ModoConteo = "TOTAL" | "A_GANAR";

export type CriterioRanking = "PUNTOS_A_FAVOR" | "SOLO_GANADOS" | "VICTORIAS";

export interface FilaPosicion {
  /** jugadorId (individual) o parejaId (dupla fija). */
  entidadId: string;
  nombre: string;
  fotoUrls: (string | null | undefined)[];
  /** Foto de la dupla (dupla fija): reemplaza a las de cada jugador. */
  fotoDupla?: string | null;
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
  /** Se retiró del evento (sigue en la tabla con lo que sumó). */
  retirado?: boolean;
  /** Comparte la posición con otra fila (empate en todos los criterios). */
  empatado?: boolean;
}

/** Por qué una fila quedó delante de otra con los mismos puntos. */
export interface NotaDesempate {
  arriba: string;
  abajo: string;
  puntos: number;
  motivo: string;
  /** Empate total: todas las filas que comparten posición. */
  empatados?: string[];
}

export interface TablaPosiciones {
  eventoId: string;
  tipo: "JUGADOR" | "PAREJA";
  filas: FilaPosicion[];
  /** Desempates aplicados entre filas con los mismos puntos (para mostrar y verificar). */
  desempates?: NotaDesempate[];
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

/** Valla publicitaria del Modo TV de americanos (como las vallas LED de un estadio). */
export interface Valla {
  id: string;
  /** Marca (se muestra si no hay imagen). */
  nombre: string;
  /** URL de la imagen subida en Ajustes (/api/club/vallas/:id?v=). */
  img?: string | null;
  /** La imagen es una pieza de 1700 × 500 (3,4 : 1): cubre su tramo de la banda de borde a borde. */
  pieza?: boolean;
}

/** Configuración del club. `dias` va indexado como Date#getDay(): 0 = domingo … 6 = sábado. */
export interface ConfigClub {
  nombre: string;
  dias: HorarioDia[];
  /** Minutos de cambio de pista entre rondas. */
  minutosEntreRondas: number;
  pistas: PistaClub[];
  contacto: ContactoClub;
  /** Hasta 30 marcas en la banda publicitaria del Modo TV de americanos. */
  vallas?: Valla[];
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
  /** false = sin cronómetro: la ronda dura lo que tarden en cargarse los marcadores. Por defecto true. */
  cronometro?: boolean;
  totalRondas: number;
  rondaActual: number;
  estado: EstadoEvento;
  jugadores: Jugador[];
  /** Solo en DUPLA_FIJA. */
  parejas: Pareja[];
  rondas: Ronda[];
  /** Pistas suspendidas ahora (lluvia…): el cuadro se reacomoda en las que quedan. */
  pistasSuspendidas?: PistaSuspendida[];
  /** Semilla del generador de rotaciones (reproducible). */
  semilla: number;
  creadoEn: string;
  actualizadoEn: string;
  /** Borrado lógico: se sincroniza a todos los dispositivos. */
  eliminado?: boolean;
  /** Parte de un Americano HABIBI Tournament (grupo o llave). Los americanos normales no lo llevan. */
  habibi?: HabibiLlave | HabibiGrupo;
}

/** Payload del POST /api/americanos */
export type GuardarEventoPayload = { evento: EventoAmericano };

export interface ApiListaRespuesta {
  modo: "DEMO" | "SUPABASE";
  eventos: EventoAmericano[];
}
