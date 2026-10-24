/**
 * Operaciones puras sobre un EventoAmericano. La UI y la API comparten estas
 * funciones, así que la lógica de juego vive en un solo lugar.
 */
import type {
  Categoria,
  Partido,
  ConfigPuntuacion,
  EventoAmericano,
  Jugador,
  Modalidad,
  Pareja,
  PistaClub,
  Resultado,
  Ronda,
} from "@/types/americano";
import { generarRondasDuplaFija, generarRondasIndividual } from "./rotation.ts";
import { normalizarResultado } from "./scoring.ts";

export interface NuevoEventoInput {
  nombre: string;
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  minutosEntreRondas?: number;
  categoria: Categoria;
  modalidad: Modalidad;
  puntuacion: ConfigPuntuacion;
  pistas: number;
  canchas?: PistaClub[];
  duracionRondaMin: number;
  /** false = sin cronómetro. Por defecto true. */
  cronometro?: boolean;
  totalRondas: number;
  jugadores: Jugador[];
  parejas?: Pareja[];
  semilla?: number;
}

export const nuevoId = (prefijo = "") =>
  prefijo + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export function generarRondas(
  e: Pick<EventoAmericano, "modalidad" | "jugadores" | "parejas" | "pistas" | "totalRondas" | "semilla" | "categoria" | "canchas">,
): Ronda[] {
  return generarRondasDesde(e, 1, []);
}

function generarRondasDesde(
  e: Pick<EventoAmericano, "modalidad" | "jugadores" | "parejas" | "pistas" | "totalRondas" | "semilla" | "categoria" | "canchas">,
  desde: number,
  previas: Ronda[],
  sufijo?: string,
): Ronda[] {
  const opts = {
    pistas: e.pistas,
    rondas: Math.max(0, e.totalRondas - desde + 1),
    semilla: e.semilla + desde * 7919,
    mixto: e.categoria.rama === "MIXTO",
    suma: e.categoria.suma ?? undefined,
    previas,
    desde,
    sufijo,
  };
  const rondas =
    e.modalidad === "DUPLA_FIJA"
      ? generarRondasDuplaFija(e.parejas.filter((p) => !p.retirada), opts)
      : generarRondasIndividual(e.jugadores.filter((j) => !j.retirado), opts);
  if (!e.canchas?.length) return rondas;
  // El generador numera 1..N; se traduce a la pista física asignada.
  return rondas.map((r) => ({ ...r, partidos: r.partidos.map((p) => ({ ...p, pista: e.canchas![p.pista - 1]?.numero ?? p.pista })) }));
}

export function crearEvento(input: NuevoEventoInput): EventoAmericano {
  const ahora = new Date().toISOString();
  const base = {
    id: nuevoId("evt_"),
    nombre: input.nombre.trim() || "Americano La Marina",
    club: "La Marina Sport Club",
    fecha: input.fecha ?? ahora.slice(0, 10),
    horaInicio: input.horaInicio ?? "19:00",
    horaFin: input.horaFin ?? "22:00",
    minutosEntreRondas: input.minutosEntreRondas ?? 3,
    categoria: input.categoria,
    modalidad: input.modalidad,
    puntuacion: input.puntuacion,
    pistas: Math.min(6, Math.max(1, input.canchas?.length || input.pistas)),
    canchas: input.canchas,
    duracionRondaMin: input.duracionRondaMin,
    ...(input.cronometro === false ? { cronometro: false } : {}),
    totalRondas: input.totalRondas,
    rondaActual: 1,
    estado: "BORRADOR" as const,
    jugadores: input.jugadores,
    parejas: input.modalidad === "DUPLA_FIJA" ? input.parejas ?? [] : [],
    semilla: input.semilla ?? Math.floor(Math.random() * 2 ** 31),
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  return { ...base, rondas: generarRondas(base) };
}

/**
 * Marca de tiempo siempre posterior a `previa`, aunque el reloj del dispositivo
 * esté atrasado: así cada edición gana a la versión sobre la que se hizo.
 */
export function despues(previa?: string | null): string {
  const ahora = Date.now();
  const antes = previa ? Date.parse(previa) : NaN;
  return new Date(Number.isNaN(antes) ? ahora : Math.max(ahora, antes + 1)).toISOString();
}

const tocar = (e: EventoAmericano): EventoAmericano => ({ ...e, actualizadoEn: despues(e.actualizadoEn) });

function mapRonda(e: EventoAmericano, numero: number, fn: (r: Ronda) => Ronda): EventoAmericano {
  return tocar({ ...e, rondas: e.rondas.map((r) => (r.numero === numero ? fn(r) : r)) });
}

/** Segundos transcurridos del cronómetro de la ronda. */
export function segundosTranscurridos(r: Ronda, ahora = Date.now()): number {
  const base = r.segundosAcumulados ?? 0;
  if (r.estado !== "EN_JUEGO" || !r.inicioEn) return base;
  return base + Math.max(0, Math.floor((ahora - new Date(r.inicioEn).getTime()) / 1000));
}

export function iniciarRonda(e: EventoAmericano, numero = e.rondaActual): EventoAmericano {
  const ev = mapRonda(e, numero, (r) => ({
    ...r,
    estado: "EN_JUEGO",
    inicioEn: new Date().toISOString(),
    partidos: r.partidos.map((p) => (p.estado === "PENDIENTE" ? { ...p, estado: "EN_JUEGO" } : p)),
  }));
  return { ...ev, estado: "EN_CURSO", rondaActual: numero };
}

export function pausarRonda(e: EventoAmericano, numero = e.rondaActual): EventoAmericano {
  return mapRonda(e, numero, (r) =>
    r.estado !== "EN_JUEGO" ? r : { ...r, estado: "PAUSADA", segundosAcumulados: segundosTranscurridos(r), inicioEn: null },
  );
}

export function reiniciarCronometro(e: EventoAmericano, numero = e.rondaActual): EventoAmericano {
  return mapRonda(e, numero, (r) => ({
    ...r,
    segundosAcumulados: 0,
    inicioEn: r.estado === "EN_JUEGO" ? new Date().toISOString() : null,
  }));
}

export function cargarResultado(e: EventoAmericano, partidoId: string, resultado: Resultado): EventoAmericano {
  return tocar({
    ...e,
    estado: e.estado === "BORRADOR" ? "EN_CURSO" : e.estado,
    rondas: e.rondas.map((r) => ({
      ...r,
      partidos: r.partidos.map((p) =>
        p.id === partidoId ? { ...p, estado: "FINALIZADO", resultado: normalizarResultado(e.puntuacion, resultado), actualizadoEn: despues(p.actualizadoEn ?? e.actualizadoEn) } : p,
      ),
    })),
  });
}

export function borrarResultado(e: EventoAmericano, partidoId: string): EventoAmericano {
  return tocar({
    ...e,
    rondas: e.rondas.map((r) => ({
      ...r,
      partidos: r.partidos.map((p) =>
        p.id === partidoId
          ? { ...p, estado: r.estado === "PENDIENTE" ? "PENDIENTE" : "EN_JUEGO", resultado: null, actualizadoEn: despues(p.actualizadoEn ?? e.actualizadoEn) }
          : p,
      ),
    })),
  });
}

export function rondaCompleta(r?: Ronda): boolean {
  return !!r && r.partidos.length > 0 && r.partidos.every((p) => p.estado === "FINALIZADO");
}

/** Cierra la ronda actual y avanza (o finaliza el evento si era la última). */
export function avanzarRonda(e: EventoAmericano): EventoAmericano {
  const cerrado = mapRonda(e, e.rondaActual, (r) => ({
    ...r,
    estado: "FINALIZADA",
    segundosAcumulados: segundosTranscurridos(r),
    inicioEn: null,
  }));
  if (e.rondaActual >= e.totalRondas) return { ...cerrado, estado: "FINALIZADO" };
  return { ...cerrado, rondaActual: e.rondaActual + 1 };
}

export function volverARonda(e: EventoAmericano, numero: number): EventoAmericano {
  return tocar({ ...e, rondaActual: Math.min(Math.max(1, numero), e.totalRondas), estado: e.estado === "FINALIZADO" ? "EN_CURSO" : e.estado });
}

export function progresoEvento(e: EventoAmericano) {
  const todos = e.rondas.flatMap((r) => r.partidos);
  const jugados = todos.filter((p) => p.estado === "FINALIZADO").length;
  return { jugados, total: todos.length, pct: todos.length ? Math.round((jugados / todos.length) * 100) : 0 };
}

/* ---------- cambios de plantel a mitad del evento ---------- */

/** Primera ronda que se puede re-sortear: la actual si aún no empezó, si no la siguiente. */
export function primeraRondaEditable(e: EventoAmericano): number {
  const actual = e.rondas.find((r) => r.numero === e.rondaActual);
  const empezada = !!actual && (actual.estado !== "PENDIENTE" || actual.partidos.some((p) => p.estado === "FINALIZADO"));
  return empezada ? e.rondaActual + 1 : e.rondaActual;
}

/** Vuelve a sortear las rondas que aún no empiezan, teniendo en cuenta lo ya jugado. */
export function reSortear(e: EventoAmericano): EventoAmericano {
  const desde = primeraRondaEditable(e);
  if (desde > e.totalRondas) return tocar(e);
  const previas = e.rondas.filter((r) => r.numero < desde);
  const nuevas = generarRondasDesde(e, desde, previas, Date.now().toString(36));
  return tocar({ ...e, rondas: [...previas, ...nuevas] });
}

export function retirarJugador(e: EventoAmericano, jugadorId: string): EventoAmericano {
  return reSortear({ ...e, jugadores: e.jugadores.map((j) => (j.id === jugadorId ? { ...j, retirado: true } : j)) });
}

export function reincorporarJugador(e: EventoAmericano, jugadorId: string): EventoAmericano {
  return reSortear({ ...e, jugadores: e.jugadores.map((j) => (j.id === jugadorId ? { ...j, retirado: false } : j)) });
}

export function agregarJugador(e: EventoAmericano, j: Jugador): EventoAmericano {
  return reSortear({ ...e, jugadores: [...e.jugadores, j] });
}

export function retirarPareja(e: EventoAmericano, parejaId: string): EventoAmericano {
  return reSortear({ ...e, parejas: e.parejas.map((p) => (p.id === parejaId ? { ...p, retirada: true } : p)) });
}

export function agregarPareja(e: EventoAmericano, a: Jugador, b: Jugador): EventoAmericano {
  const pareja: Pareja = { id: nuevoId("par_"), jugadorIds: [a.id, b.id], nombre: `${a.nombre} / ${b.nombre}` };
  return reSortear({ ...e, jugadores: [...e.jugadores, a, b], parejas: [...e.parejas, pareja] });
}

/** Cuántos pueden jugar ahora (sin retirados). */
export function activosEnEvento(e: EventoAmericano): number {
  return e.modalidad === "DUPLA_FIJA" ? e.parejas.filter((p) => !p.retirada).length : e.jugadores.filter((j) => !j.retirado).length;
}

export function eliminarEvento(e: EventoAmericano): EventoAmericano {
  return tocar({ ...e, eliminado: true });
}

/* ---------- fusión entre dispositivos ---------- */

const mismoCruce = (a: Partido, b: Partido) => a.id === b.id && a.parejaA.id === b.parejaA.id && a.parejaB.id === b.parejaB.id;
const ts = (x?: string | null) => x ?? "";

/**
 * Une dos versiones del mismo evento editadas en dispositivos distintos.
 * La estructura (rondas, ronda actual, cronómetro, plantel) la manda la versión
 * más reciente; cada marcador conserva la carga más reciente de cualquiera de
 * las dos. Así dos personas pueden cargar pistas distintas a la vez sin pisarse.
 */
export function fusionarEventos(a: EventoAmericano, b: EventoAmericano): EventoAmericano {
  if (a.id !== b.id) return b;
  const [vieja, nueva] = ts(a.actualizadoEn) <= ts(b.actualizadoEn) ? [a, b] : [b, a];
  const partidosViejos = new Map(vieja.rondas.flatMap((r) => r.partidos).map((p) => [p.id, p]));
  let cambio = false;
  const rondas = nueva.rondas.map((r) => ({
    ...r,
    partidos: r.partidos.map((p) => {
      const otro = partidosViejos.get(p.id);
      if (otro && mismoCruce(p, otro) && ts(otro.actualizadoEn) > ts(p.actualizadoEn)) {
        cambio = true;
        return { ...otro, estado: otro.resultado ? "FINALIZADO" : p.estado };
      }
      return p;
    }),
  }));
  // Un borrado nunca se deshace por una copia vieja de otro dispositivo.
  const eliminado = !!(a.eliminado || b.eliminado);
  if (!cambio && eliminado === !!nueva.eliminado) return nueva;
  return { ...nueva, rondas: cambio ? rondas : nueva.rondas, ...(eliminado ? { eliminado } : {}) };
}
