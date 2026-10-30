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
import { crearParejaRotativa, generarRondasDuplaFija, generarRondasIndividual } from "./rotation.ts";
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

export function generarRondas(e: BaseCuadro): Ronda[] {
  return generarRondasDesde(e, 1, []);
}

type BaseCuadro = Pick<EventoAmericano, "modalidad" | "jugadores" | "parejas" | "pistas" | "totalRondas" | "semilla" | "categoria" | "canchas" | "pistasSuspendidas">;

/** Pistas físicas del evento, en orden de prioridad. */
export function canchasDelEvento(e: Pick<EventoAmericano, "pistas" | "canchas">): number[] {
  return e.canchas?.length ? e.canchas.slice(0, e.pistas).map((c) => c.numero) : Array.from({ length: e.pistas }, (_, i) => i + 1);
}

/** Pistas que se pueden usar ahora (sin las suspendidas por lluvia u otro motivo). */
export function canchasActivas(e: Pick<EventoAmericano, "pistas" | "canchas" | "pistasSuspendidas">): number[] {
  const fuera = new Set((e.pistasSuspendidas ?? []).map((s) => s.numero));
  return canchasDelEvento(e).filter((n) => !fuera.has(n));
}

/** Ids que juegan un partido: jugadores en individual, duplas en dupla fija. */
const idsDe = (e: Pick<EventoAmericano, "modalidad">, p: Partido) =>
  e.modalidad === "DUPLA_FIJA" ? [p.parejaA.id, p.parejaB.id] : [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds];

function generarRondasDesde(e: BaseCuadro, desde: number, previas: Ronda[], sufijo?: string, enEspera: Partido[] = []): Ronda[] {
  const canchas = canchasActivas(e);
  const generar = (pistas: number, rondas: number, n: number, historial: Ronda[], fuera = new Set<string>()) => {
    const opts = {
      pistas,
      rondas,
      semilla: e.semilla + n * 7919,
      mixto: e.categoria.rama === "MIXTO",
      suma: e.categoria.suma ?? undefined,
      previas: historial,
      desde: n,
      sufijo,
    };
    return e.modalidad === "DUPLA_FIJA"
      ? generarRondasDuplaFija(e.parejas.filter((p) => !p.retirada && !fuera.has(p.id)), opts)
      : generarRondasIndividual(e.jugadores.filter((j) => !j.retirado && !fuera.has(j.id)), opts);
  };
  // El generador numera 1..N; se traduce a la pista física (sin las suspendidas).
  const aCancha = (r: Ronda, offset = 0): Ronda => ({ ...r, partidos: r.partidos.map((p) => ({ ...p, pista: canchas[offset + p.pista - 1] ?? p.pista })) });

  // Partidos suspendidos: van primero, en las primeras pistas libres de las rondas siguientes.
  const out: Ronda[] = [];
  const historial = [...previas];
  const cola = [...enEspera];
  let n = desde;
  while (cola.length && canchas.length) {
    const fijos = cola.splice(0, canchas.length).map((p, i): Partido => ({ ...p, rondaNumero: n, pista: canchas[i], estado: "PENDIENTE", resultado: null }));
    const fuera = new Set(fijos.flatMap((p) => idsDe(e, p)));
    // Una ronda agregada solo para terminar suspendidos no suma partidos nuevos.
    const libres = n <= e.totalRondas ? canchas.length - fijos.length : 0;
    // El partido suspendido cuenta como jugado: así nadie lo repite ni repite compañero con él.
    const conFijos: Ronda = { numero: n, estado: "PENDIENTE", partidos: fijos, descansanIds: [] };
    const resto = libres > 0 ? generar(libres, 1, n, [...historial, conFijos], fuera)[0] : undefined;
    const activos = e.modalidad === "DUPLA_FIJA" ? e.parejas.filter((p) => !p.retirada).map((p) => p.id) : e.jugadores.filter((j) => !j.retirado).map((j) => j.id);
    const ronda: Ronda = {
      numero: n,
      estado: "PENDIENTE",
      partidos: [...fijos, ...(resto ? aCancha(resto, fijos.length).partidos : [])],
      descansanIds: resto ? resto.descansanIds : activos.filter((id) => !fuera.has(id)),
      inicioEn: null,
      segundosAcumulados: 0,
    };
    out.push(ronda);
    historial.push(ronda);
    n++;
  }
  const quedan = Math.max(0, e.totalRondas - n + 1);
  if (!quedan) return out;
  return [...out, ...generar(canchas.length, quedan, n, historial).map((r) => aCancha(r))];
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

/** Partido cortado por una pista suspendida que espera volver a pista (si ya se reanudó, está EN_JUEGO). */
export const enEsperaPorPista = (p: Partido) => !!p.suspendido && p.estado === "PENDIENTE";

/**
 * Vuelve a sortear las rondas que aún no empiezan, teniendo en cuenta lo ya jugado.
 * Los partidos suspendidos (lluvia) se sacan de su ronda y entran primero en la siguiente;
 * si ya no quedan rondas se agrega una. Con todas las pistas suspendidas no se mueve nada.
 */
export function reSortear(e: EventoAmericano): EventoAmericano {
  if (!canchasActivas(e).length) return tocar(e);
  const desde = primeraRondaEditable(e);
  const activos = new Set(e.modalidad === "DUPLA_FIJA" ? e.parejas.filter((p) => !p.retirada).map((p) => p.id) : e.jugadores.filter((j) => !j.retirado).map((j) => j.id));
  const suspendidos = e.rondas.flatMap((r) => r.partidos).filter(enEsperaPorPista);
  // Si alguien del partido suspendido se retiró, ese partido ya no se termina.
  const enEspera = suspendidos.filter((p) => idsDe(e, p).every((id) => activos.has(id)));
  if (desde > e.totalRondas && !enEspera.length) return tocar(e);
  const fuera = new Set(suspendidos.map((p) => p.id));
  const previas = e.rondas.filter((r) => r.numero < desde).map((r) => (r.partidos.some((p) => fuera.has(p.id)) ? { ...r, partidos: r.partidos.filter((p) => !fuera.has(p.id)) } : r));
  const nuevas = generarRondasDesde(e, desde, previas, Date.now().toString(36), enEspera);
  const totalRondas = Math.max(e.totalRondas, nuevas.at(-1)?.numero ?? 0);
  return tocar({ ...e, totalRondas, rondas: [...previas, ...nuevas] });
}

/* ---------- pistas suspendidas (lluvia, falla de luz…) ---------- */

export interface OpcionesSuspension {
  motivo?: string;
  /** Cómo iba el partido de esa pista, ej. "8-6" (opcional). */
  marcador?: string | null;
  ahora?: number;
}

/**
 * Suspende una pista en pleno evento: el partido que se jugaba ahí queda en espera con su
 * marcador y entra primero en la ronda siguiente, en otra pista; las rondas que faltan se
 * vuelven a sortear con las pistas que quedan, sin repetir cruces. El resto sigue jugando.
 */
export function suspenderPista(e: EventoAmericano, numero: number, opts: OpcionesSuspension = {}): EventoAmericano {
  if (!canchasDelEvento(e).includes(numero) || e.pistasSuspendidas?.some((s) => s.numero === numero)) return e;
  const en = new Date(opts.ahora ?? Date.now()).toISOString();
  const motivo = opts.motivo?.trim() || "Lluvia";
  const marcador = opts.marcador?.trim() || null;
  let out: EventoAmericano = {
    ...e,
    pistasSuspendidas: [...(e.pistasSuspendidas ?? []), { numero, motivo, desde: en }],
    rondas: e.rondas.map((r) => ({
      ...r,
      partidos: r.partidos.map((p) =>
        p.pista === numero && p.estado === "EN_JUEGO"
          ? { ...p, estado: "PENDIENTE" as const, suspendido: { en, motivo, pista: numero, ronda: p.suspendido?.ronda ?? r.numero, marcador: marcador ?? p.suspendido?.marcador ?? null }, actualizadoEn: despues(p.actualizadoEn ?? e.actualizadoEn) }
          : p,
      ),
    })),
  };
  // Sin pistas para jugar: la ronda se pausa y todo espera a que se reactive alguna.
  if (!canchasActivas(out).length) out = pausarRonda(out);
  return reSortear(out);
}

/** Reactiva una pista suspendida: lo que falta se vuelve a repartir contando con ella. */
export function reactivarPista(e: EventoAmericano, numero: number): EventoAmericano {
  if (!e.pistasSuspendidas?.some((s) => s.numero === numero)) return e;
  const resto = e.pistasSuspendidas.filter((s) => s.numero !== numero);
  return reSortear({ ...e, pistasSuspendidas: resto.length ? resto : undefined });
}

/** Partidos suspendidos que esperan terminarse, con la ronda y la pista donde siguen. */
export function partidosEnEspera(e: EventoAmericano): Partido[] {
  return e.rondas.flatMap((r) => r.partidos).filter(enEsperaPorPista);
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

const normalizarNombre = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * ¿Ya hay un jugador inscrito (y no retirado) con ese mismo nombre completo? Evita inscribir dos
 * veces a la misma persona o la misma dupla. `excluir`: ids que no cuentan (la dupla que se cambia).
 */
export function jugadorYaInscrito(jugadores: Jugador[], nombre: string, excluir: string[] = []): Jugador | undefined {
  const n = normalizarNombre(nombre);
  return jugadores.find((j) => !j.retirado && !excluir.includes(j.id) && normalizarNombre(`${j.nombre} ${j.apellido ?? ""}`) === n);
}

/** Mensaje de error si la dupla nueva repite a alguien (o es la misma persona dos veces); null si está bien. */
export function duplaRepetida(jugadores: Jugador[], a: string, b: string, excluir: string[] = []): string | null {
  if (normalizarNombre(a) === normalizarNombre(b)) return "Los dos jugadores de la dupla tienen el mismo nombre.";
  for (const n of [a, b]) {
    const ya = jugadorYaInscrito(jugadores, n, excluir);
    if (ya) return `${n.trim()} ya está inscrito en este americano. Si es otra persona, agrega su apellido.`;
  }
  return null;
}

/** La dupla aún no tiene ningún marcador cargado (ni terminado ni a medias). */
export function parejaSinJugar(e: EventoAmericano, parejaId: string): boolean {
  return !e.rondas.some((r) => r.partidos.some((p) => (p.parejaA.id === parejaId || p.parejaB.id === parejaId) && (p.estado === "FINALIZADO" || !!p.resultado)));
}

/** La dupla está en pista en la ronda que ya empezó (no se puede quitar sin dejar un hueco). */
export function parejaEnPistaAhora(e: EventoAmericano, parejaId: string): boolean {
  const desde = primeraRondaEditable(e);
  return e.rondas.some((r) => r.numero < desde && r.partidos.some((p) => p.parejaA.id === parejaId || p.parejaB.id === parejaId));
}

/** Quita jugadores que ya no están en ninguna dupla. */
const sinHuerfanos = (e: EventoAmericano, ids: string[]) => {
  const usados = new Set(e.parejas.flatMap((p) => p.jugadorIds));
  return e.jugadores.filter((j) => !ids.includes(j.id) || usados.has(j.id));
};

/**
 * Cambia los jugadores de una dupla que aún no jugó (no vino, la reemplazan): entra en su
 * mismo lugar de todas las rondas, sin perder ni sumar nada. Si estaba retirada, vuelve.
 */
export function cambiarPareja(e: EventoAmericano, parejaId: string, a: Jugador, b: Jugador): EventoAmericano {
  const vieja = e.parejas.find((p) => p.id === parejaId);
  if (!vieja) return e;
  const nueva: Pareja = { id: vieja.id, jugadorIds: [a.id, b.id], nombre: `${a.nombre} / ${b.nombre}`, fotoUrl: null };
  const ahora = new Date().toISOString();
  const parejas = e.parejas.map((p) => (p.id === parejaId ? nueva : p));
  const out: EventoAmericano = {
    ...e,
    parejas,
    jugadores: [...e.jugadores, a, b],
    rondas: e.rondas.map((r) => ({
      ...r,
      partidos: r.partidos.map((p) =>
        p.parejaA.id === parejaId ? { ...p, parejaA: nueva, actualizadoEn: ahora } : p.parejaB.id === parejaId ? { ...p, parejaB: nueva, actualizadoEn: ahora } : p,
      ),
    })),
  };
  const limpio = { ...out, jugadores: sinHuerfanos(out, vieja.jugadorIds) };
  return vieja.retirada ? reSortear(limpio) : tocar(limpio);
}

/** Borra una dupla que aún no jugó ni está en pista: como si nunca se hubiera inscrito. */
export function quitarPareja(e: EventoAmericano, parejaId: string): EventoAmericano {
  const vieja = e.parejas.find((p) => p.id === parejaId);
  if (!vieja) return e;
  const out: EventoAmericano = {
    ...e,
    parejas: e.parejas.filter((p) => p.id !== parejaId),
    rondas: e.rondas.map((r) => ({ ...r, descansanIds: r.descansanIds.filter((id) => id !== parejaId) })),
  };
  return reSortear({ ...out, jugadores: sinHuerfanos(out, vieja.jugadorIds) });
}

/* ---------- americano individual y mixto: cambiar o quitar a un jugador que aún no jugó ---------- */

const juegaEn = (p: Partido, jugadorId: string) => p.parejaA.jugadorIds.includes(jugadorId) || p.parejaB.jugadorIds.includes(jugadorId);

/** El jugador aún no tiene ningún marcador cargado (ni terminado ni a medias). */
export function jugadorSinJugar(e: EventoAmericano, jugadorId: string): boolean {
  return !e.rondas.some((r) => r.partidos.some((p) => juegaEn(p, jugadorId) && (p.estado === "FINALIZADO" || !!p.resultado)));
}

/** El jugador está en pista en la ronda que ya empezó. */
export function jugadorEnPistaAhora(e: EventoAmericano, jugadorId: string): boolean {
  const desde = primeraRondaEditable(e);
  return e.rondas.some((r) => r.numero < desde && r.partidos.some((p) => juegaEn(p, jugadorId)));
}

/**
 * Cambia a un jugador que aún no jugó (no vino, entra otro): el nuevo ocupa su mismo lugar en
 * todas las rondas, con los mismos compañeros y rivales, sin sumar ni perder nada. Si estaba retirado, vuelve.
 */
export function cambiarJugador(e: EventoAmericano, jugadorId: string, nuevo: Jugador): EventoAmericano {
  const viejo = e.jugadores.find((j) => j.id === jugadorId);
  if (!viejo) return e;
  const jugadores = e.jugadores.map((j) => (j.id === jugadorId ? nuevo : j));
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const ahora = new Date().toISOString();
  const rehacer = (par: Pareja): Pareja => {
    const [x, y] = par.jugadorIds.map((id) => porId.get(id === jugadorId ? nuevo.id : id));
    return x && y ? crearParejaRotativa(x, y) : par;
  };
  const out: EventoAmericano = {
    ...e,
    jugadores,
    rondas: e.rondas.map((r) => ({
      ...r,
      descansanIds: r.descansanIds.map((id) => (id === jugadorId ? nuevo.id : id)),
      partidos: r.partidos.map((p) => (juegaEn(p, jugadorId) ? { ...p, parejaA: rehacer(p.parejaA), parejaB: rehacer(p.parejaB), actualizadoEn: ahora } : p)),
    })),
  };
  return viejo.retirado ? reSortear(out) : tocar(out);
}

/** Borra a un jugador que aún no jugó ni está en pista: como si nunca se hubiera inscrito. */
export function quitarJugador(e: EventoAmericano, jugadorId: string): EventoAmericano {
  return reSortear({
    ...e,
    jugadores: e.jugadores.filter((j) => j.id !== jugadorId),
    rondas: e.rondas.map((r) => ({ ...r, descansanIds: r.descansanIds.filter((id) => id !== jugadorId) })),
  });
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
