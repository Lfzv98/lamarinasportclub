/**
 * Operaciones puras sobre un EventoAmericano. La UI y la API comparten estas
 * funciones, así que la lógica de juego vive en un solo lugar.
 */
import type {
  Categoria,
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
  const opts = { pistas: e.pistas, rondas: e.totalRondas, semilla: e.semilla, mixto: e.categoria.rama === "MIXTO" };
  const rondas = e.modalidad === "DUPLA_FIJA" ? generarRondasDuplaFija(e.parejas, opts) : generarRondasIndividual(e.jugadores, opts);
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

const tocar = (e: EventoAmericano): EventoAmericano => ({ ...e, actualizadoEn: new Date().toISOString() });

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
  const ahora = new Date().toISOString();
  return tocar({
    ...e,
    estado: e.estado === "BORRADOR" ? "EN_CURSO" : e.estado,
    rondas: e.rondas.map((r) => ({
      ...r,
      partidos: r.partidos.map((p) =>
        p.id === partidoId ? { ...p, estado: "FINALIZADO", resultado: normalizarResultado(e.puntuacion, resultado), actualizadoEn: ahora } : p,
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
        p.id === partidoId ? { ...p, estado: r.estado === "PENDIENTE" ? "PENDIENTE" : "EN_JUEGO", resultado: null } : p,
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
