/**
 * Asistente IA del staff: lo que viaja entre el chat (cliente) y /api/asistente.
 *
 * El asistente nunca guarda nada por su cuenta: propone una acción, el staff la
 * toca y la app abre el formulario de siempre ya lleno (setup del americano,
 * Americano Torneo, nuevo torneo o "Pegar lista"), donde se revisa y se confirma
 * con el botón de siempre.
 */
import type { Genero, InicioLlave, MetodoPuntuacion, Modalidad, Nivel, Rama } from "@/types/americano";

export interface MensajeAsistente {
  rol: "staff" | "asistente";
  texto: string;
}

export interface PersonaIA {
  nombre: string;
  apellido: string | null;
  genero: Genero | null;
  nivel: Nivel | null;
}

export interface DuplaIA {
  a: PersonaIA;
  b: PersonaIA;
}

export interface PuntuacionIA {
  metodo: MetodoPuntuacion;
  /** Puntos por partido, games por partido o games por set, según el método. */
  valor: number | null;
  /** Solo sets: 1 o 3. */
  sets: number | null;
}

export interface ArmarAmericano {
  tipo: "armar_americano";
  reemplazar: boolean;
  nombre: string | null;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  rama: Rama | null;
  nivel: Nivel | null;
  suma: number | null;
  modalidad: Modalidad | null;
  puntuacion: PuntuacionIA | null;
  pistas: number[] | null;
  duracionRondaMin: number | null;
  jugadores: PersonaIA[];
  duplas: DuplaIA[];
}

export interface ArmarAmericanoTorneo {
  tipo: "armar_americano_torneo";
  reemplazar: boolean;
  nombre: string | null;
  fecha: string | null;
  hora: string | null;
  rama: Rama | null;
  nivel: Nivel | null;
  modalidad: Modalidad | null;
  grupoA: { duplas: DuplaIA[]; jugadores: PersonaIA[] };
  grupoB: { duplas: DuplaIA[]; jugadores: PersonaIA[] };
  puntuacionGrupos: PuntuacionIA | null;
  inicio: InicioLlave | null;
  tercerPuesto: boolean | null;
  puntuacionLlave: PuntuacionIA | null;
}

export interface JugadorTorneoIA {
  nombre: string;
  apellido: string | null;
  cedula: string | null;
}

export interface DuplaTorneoIA {
  categoriaId: string;
  a: JugadorTorneoIA;
  b: JugadorTorneoIA;
  puntos: number | null;
}

export interface CrearTorneo {
  tipo: "crear_torneo";
  nombre: string;
  fechaInicio: string | null;
  dias: number | null;
  pistas: number[] | null;
  categorias: string[];
  descansoMin: number | null;
  toleranciaWO: number | null;
  duplas: DuplaTorneoIA[];
}

export interface InscribirDuplasTorneo {
  tipo: "inscribir_duplas_torneo";
  torneoId: string;
  duplas: DuplaTorneoIA[];
}

export interface AbrirPantalla {
  tipo: "abrir_pantalla";
  ruta: string;
  titulo: string;
}

export type AccionAsistente = ArmarAmericano | ArmarAmericanoTorneo | CrearTorneo | InscribirDuplasTorneo | AbrirPantalla;

export interface RespuestaAsistente {
  texto: string;
  acciones: AccionAsistente[];
}

/** Lo que la app le cuenta al asistente de lo que está pasando (sin datos personales de más). */
export type ContextoAsistente = Record<string, unknown>;
