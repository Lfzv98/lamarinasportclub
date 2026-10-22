/** Horarios del club y franja horaria de los eventos. */
import type { ConfigClub, EventoAmericano, HorarioDia, PistaClub } from "@/types/americano";

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Orden de visualización: lunes primero. */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

const semana: HorarioDia = { abierto: true, apertura: "07:00", cierre: "23:00" };
const finde: HorarioDia = { abierto: true, apertura: "08:00", cierre: "22:00" };

export const CLUB_POR_DEFECTO: ConfigClub = {
  nombre: "La Marina Sport Club",
  dias: [finde, semana, semana, semana, semana, semana, finde],
  minutosEntreRondas: 3,
  // La Marina: 4 pistas techadas + 1 al aire libre.
  pistas: [
    { numero: 1, nombre: "Pista 1", techada: true, activa: true },
    { numero: 2, nombre: "Pista 2", techada: true, activa: true },
    { numero: 3, nombre: "Pista 3", techada: true, activa: true },
    { numero: 4, nombre: "Pista 4", techada: true, activa: true },
    { numero: 5, nombre: "Pista 5", techada: false, activa: true },
  ],
  contacto: {},
  actualizadoEn: "2026-01-01T00:00:00.000Z",
};

export const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const aHora = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Día de la semana de una fecha "YYYY-MM-DD" sin desfases de zona horaria. */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function horarioDelDia(club: ConfigClub, fecha: string): HorarioDia {
  return club.dias[diaSemana(fecha)] ?? semana;
}

/** Cuántas rondas caben en la franja [inicio, fin]. La última ronda no necesita cambio de pista. */
export function rondasQueCaben(inicio: string, fin: string, duracionMin: number, entreRondasMin: number): number {
  const ventana = aMinutos(fin) - aMinutos(inicio);
  if (ventana < duracionMin) return 0;
  return Math.floor((ventana + entreRondasMin) / (duracionMin + entreRondasMin));
}

/** Hora prevista de inicio de la ronda `n` (1-based). */
export function horaRonda(e: Pick<EventoAmericano, "horaInicio" | "duracionRondaMin" | "minutosEntreRondas">, n: number): string {
  return aHora(aMinutos(e.horaInicio) + (n - 1) * (e.duracionRondaMin + (e.minutosEntreRondas ?? 0)));
}

/** Hora prevista de término según rondas configuradas. */
export function horaFinPrevista(e: Pick<EventoAmericano, "horaInicio" | "duracionRondaMin" | "minutosEntreRondas" | "totalRondas">): string {
  return aHora(aMinutos(horaRonda(e, e.totalRondas)) + e.duracionRondaMin);
}

/** Franjas de 30 min disponibles dentro del horario del día. */
export function franjas(h: HorarioDia, paso = 30): string[] {
  if (!h.abierto) return [];
  const out: string[] = [];
  for (let m = aMinutos(h.apertura); m <= aMinutos(h.cierre); m += paso) out.push(aHora(m));
  return out;
}

export function validarFranja(h: HorarioDia, inicio: string, fin: string): string | null {
  if (!h.abierto) return "El club está cerrado ese día.";
  if (aMinutos(inicio) < aMinutos(h.apertura)) return `El club abre a las ${h.apertura}.`;
  if (aMinutos(fin) > aMinutos(h.cierre)) return `El club cierra a las ${h.cierre}.`;
  if (aMinutos(fin) <= aMinutos(inicio)) return "La hora de fin debe ser posterior al inicio.";
  return null;
}

/** Completa configs guardadas antes de que existieran pistas/contacto. */
export function normalizarClub(c: Partial<ConfigClub> | undefined): ConfigClub {
  return {
    ...CLUB_POR_DEFECTO,
    ...c,
    pistas: c?.pistas?.length ? c.pistas : CLUB_POR_DEFECTO.pistas,
    contacto: { ...CLUB_POR_DEFECTO.contacto, ...c?.contacto },
    dias: c?.dias?.length === 7 ? c.dias : CLUB_POR_DEFECTO.dias,
  };
}

/** Nombre visible de una pista del evento, ej. "Pista 5 · Exterior". */
export function nombrePista(e: Pick<EventoAmericano, "canchas">, numero: number): string {
  const c = e.canchas?.find((x) => x.numero === numero);
  return c?.nombre ?? `Pista ${numero}`;
}

export function pistaInfo(e: Pick<EventoAmericano, "canchas">, numero: number): PistaClub | undefined {
  return e.canchas?.find((x) => x.numero === numero);
}
