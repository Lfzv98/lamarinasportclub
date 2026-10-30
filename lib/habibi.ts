/**
 * Americano HABIBI Tournament: dos grupos (A y B) juegan un americano en dupla
 * fija, todos contra todos, y según cómo terminó cada grupo se arma una llave
 * eliminatoria hasta la gran final.
 *
 * Todo se guarda como eventos normales (`EventoAmericano`), así la sincronización,
 * la API y Supabase no cambian:
 * - cada grupo es un americano en dupla fija con `habibi.rol = "GRUPO"`;
 * - la llave es otro evento con `habibi.rol = "LLAVE"`: es la ficha del torneo
 *   (nombre, grupos, en qué ronda arranca la llave) y sus rondas son las fases.
 *
 * Los partidos de la llave tienen id fijo (`ko-<fase>-<n>`), así dos dispositivos
 * cargando a la vez se fusionan igual que en un americano.
 */
import type {
  Categoria,
  ConfigPuntuacion,
  EmparejarLlave,
  EventoAmericano,
  FaseLlave,
  HabibiLlave,
  InicioLlave,
  Jugador,
  Modalidad,
  Pareja,
  Partido,
  PistaClub,
  Resultado,
  Ronda,
} from "@/types/americano";
import { crearEvento, despues, nuevoId } from "./evento.ts";
import { planRondas, rondasSugeridas } from "./rotation.ts";
import { calcularTabla, ganador, normalizarResultado } from "./scoring.ts";

export const NOMBRE_HABIBI = "Americano Torneo";
export const LETRAS = ["A", "B"] as const;
export const MIN_DUPLAS_GRUPO = 2;
export const MAX_DUPLAS_GRUPO = 12;
/** Grupos individuales: jugadores por grupo (la API admite 48 por evento y la llave reúne a los dos grupos). */
export const MIN_JUGADORES_GRUPO = 4;
export const MAX_JUGADORES_GRUPO = 24;

export const EMPAREJAR: { id: EmparejarLlave; label: string; detalle: string }[] = [
  { id: "EQUILIBRADO", label: "Equilibradas", detalle: "El 1º juega con el último clasificado, el 2º con el penúltimo… Duplas parejas entre sí." },
  { id: "POR_ORDEN", label: "Por orden", detalle: "El 1º con el 2º, el 3º con el 4º… Premia al que terminó arriba." },
];

/**
 * Cruces de la primera ronda de la llave, en orden de cuadro: los partidos vecinos
 * (1º con 2º, 3º con 4º…) se cruzan en la ronda siguiente.
 *
 * Octavos es la hoja del creador del formato: arriba 1A-3A, 6B-8B, 2A-4A, 5B-7B y
 * abajo 5A-7A, 2B-4B, 6A-8A, 1B-3B. Los cuartos cruzan siempre un ganador del
 * grupo A con uno del B, y 1A y 1B (y 2A y 2B) quedan en mitades opuestas.
 */
export const CRUCES: Record<InicioLlave, [string, string][]> = {
  OCTAVOS: [
    ["1A", "3A"],
    ["6B", "8B"],
    ["2A", "4A"],
    ["5B", "7B"],
    ["5A", "7A"],
    ["2B", "4B"],
    ["6A", "8A"],
    ["1B", "3B"],
  ],
  CUARTOS: [
    ["1A", "4B"],
    ["2B", "3A"],
    ["1B", "4A"],
    ["2A", "3B"],
  ],
  SEMIS: [
    ["1A", "2B"],
    ["1B", "2A"],
  ],
};

/** Duplas que clasifican de cada grupo según dónde arranca la llave. */
export const CLASIFICAN: Record<InicioLlave, number> = { OCTAVOS: 8, CUARTOS: 4, SEMIS: 2 };

export const NOMBRE_FASE: Record<FaseLlave, string> = {
  OCTAVOS: "Octavos de final",
  CUARTOS: "Cuartos de final",
  SEMIS: "Semifinales",
  TERCER_PUESTO: "3er puesto",
  FINAL: "Gran final",
};

export const CORTO_FASE: Record<FaseLlave, string> = {
  OCTAVOS: "Octavos",
  CUARTOS: "Cuartos",
  SEMIS: "Semis",
  TERCER_PUESTO: "3er puesto",
  FINAL: "Final",
};

export const INICIOS: { id: InicioLlave; label: string; detalle: string }[] = [
  { id: "OCTAVOS", label: "Octavos", detalle: "Pasan las 8 duplas de cada grupo: octavos, cuartos, semis y final." },
  { id: "CUARTOS", label: "Cuartos", detalle: "Pasan las 4 primeras de cada grupo: cuartos, semis y final." },
  { id: "SEMIS", label: "Semis directo", detalle: "Pasan las 2 primeras de cada grupo: semis y final, sin cuartos." },
];

const ORDEN: InicioLlave[] = ["OCTAVOS", "CUARTOS", "SEMIS"];

/** Fases de la llave en orden de juego (el 3er puesto va justo antes de la final). */
export function fasesLlave(inicio: InicioLlave, tercerPuesto: boolean): FaseLlave[] {
  const fases: FaseLlave[] = ORDEN.slice(ORDEN.indexOf(inicio));
  if (tercerPuesto) fases.push("TERCER_PUESTO");
  fases.push("FINAL");
  return fases;
}

/** Partidos de cada fase. */
export function partidosDeFase(inicio: InicioLlave, fase: FaseLlave): number {
  if (fase === "FINAL" || fase === "TERCER_PUESTO") return 1;
  const primera = CRUCES[inicio].length;
  return primera / 2 ** (ORDEN.indexOf(fase) - ORDEN.indexOf(inicio));
}

/** Inicios posibles con esa cantidad de duplas en el grupo más chico. */
export function iniciosPosibles(menorGrupo: number): InicioLlave[] {
  return ORDEN.filter((i) => menorGrupo >= CLASIFICAN[i]);
}

/**
 * Id fijo de cada partido de la llave. Lleva la versión de la llave (cuándo se armó):
 * al rehacerla, los partidos nuevos no se confunden con los viejos de otro
 * dispositivo y un resultado borrado no "resucita" al sincronizar.
 */
export const idPartidoLlave = (fase: FaseLlave, i: number, armadaEn?: string | null) =>
  `ko-${fase.toLowerCase()}-${i + 1}${armadaEn ? `-${Date.parse(armadaEn).toString(36)}` : ""}`;

/* ---------- crear ---------- */

export interface NuevoHabibiInput {
  nombre: string;
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  minutosEntreRondas?: number;
  categoria: Categoria;
  /** Formato de los grupos: individual (cambian de pareja cada ronda) o dupla fija. */
  modalidad: Modalidad;
  /** Grupos individuales: cómo se forman las duplas de la llave. */
  emparejar?: EmparejarLlave;
  /** Duplas (dupla fija) o solo jugadores (individual) de cada grupo, en orden A, B. */
  grupos: { parejas: Pareja[]; jugadores: EventoAmericano["jugadores"]; canchas: PistaClub[] }[];
  puntuacionGrupos: ConfigPuntuacion;
  cronometro: boolean;
  duracionRondaMin: number;
  inicio: InicioLlave;
  tercerPuesto: boolean;
  puntuacionLlave: ConfigPuntuacion;
  /** Reglas propias de la final (y nada más). Null = las mismas de la llave. */
  puntuacionFinal?: ConfigPuntuacion | null;
  /** Pistas para la llave, en orden de prioridad (la primera recibe la final). */
  canchasLlave: PistaClub[];
}

/** Valida lo esencial antes de crear (mensajes para el staff). */
export function erroresHabibi(input: NuevoHabibiInput): string[] {
  const errores: string[] = [];
  const mixto = input.categoria.rama === "MIXTO";
  input.grupos.forEach((g, i) => {
    const letra = LETRAS[i];
    if (input.modalidad === "DUPLA_FIJA") {
      if (g.parejas.length < MIN_DUPLAS_GRUPO) errores.push(`El grupo ${letra} necesita al menos ${MIN_DUPLAS_GRUPO} duplas.`);
      if (g.parejas.length > MAX_DUPLAS_GRUPO) errores.push(`El grupo ${letra} admite hasta ${MAX_DUPLAS_GRUPO} duplas.`);
    } else {
      const h = g.jugadores.filter((j) => j.genero === "M").length;
      const m = g.jugadores.length - h;
      if (g.jugadores.length < MIN_JUGADORES_GRUPO) errores.push(`El grupo ${letra} necesita al menos ${MIN_JUGADORES_GRUPO} jugadores.`);
      else if (mixto && (h < 2 || m < 2)) errores.push(`El grupo ${letra} necesita al menos 2 hombres y 2 mujeres.`);
      if (g.jugadores.length > MAX_JUGADORES_GRUPO) errores.push(`El grupo ${letra} admite hasta ${MAX_JUGADORES_GRUPO} jugadores.`);
    }
    if (!g.canchas.length) errores.push(`Elige al menos una pista para el grupo ${letra}.`);
  });
  const menor = Math.min(...input.grupos.map((g) => duplasPosibles({ modalidad: input.modalidad, ...g }, mixto)));
  const n = CLASIFICAN[input.inicio];
  if (menor < n)
    errores.push(
      input.modalidad === "DUPLA_FIJA"
        ? `Para arrancar en ${NOMBRE_FASE[input.inicio].toLowerCase()} cada grupo necesita ${n} duplas.`
        : `Para arrancar en ${NOMBRE_FASE[input.inicio].toLowerCase()} cada grupo necesita ${mixto ? `${n} hombres y ${n} mujeres` : `${n * 2} jugadores`}.`,
    );
  if (!input.canchasLlave.length) errores.push("Elige al menos una pista para la llave.");
  return errores;
}

/**
 * Duplas que puede aportar un grupo a la llave: en dupla fija, sus duplas activas;
 * en individual, las que se pueden formar con sus jugadores (en mixto, hombre + mujer).
 */
export function duplasPosibles(g: { modalidad: Modalidad; parejas: Pareja[]; jugadores: Jugador[] }, mixto: boolean): number {
  if (g.modalidad === "DUPLA_FIJA") return g.parejas.filter((p) => !p.retirada).length;
  const activos = g.jugadores.filter((j) => !j.retirado);
  if (!mixto) return Math.floor(activos.length / 2);
  const h = activos.filter((j) => j.genero === "M").length;
  return Math.min(h, activos.length - h);
}

/**
 * Grupo individual: forma las n duplas de la llave con su ranking, de la mejor sembrada
 * a la peor. En mixto se ordena a hombres y mujeres por separado y cada dupla es hombre + mujer.
 */
export function duplasDeGrupo(g: EventoAmericano, n: number, emparejar: EmparejarLlave = "EQUILIBRADO"): Pareja[] {
  const letra = g.habibi?.rol === "GRUPO" ? g.habibi.letra : "?";
  const porId = new Map(g.jugadores.map((j) => [j.id, j]));
  const orden = calcularTabla(g)
    .filas.filter((f) => !f.retirado)
    .map((f) => porId.get(f.entidadId))
    .filter((j): j is Jugador => !!j);
  let pares: [Jugador, Jugador][];
  if (g.categoria.rama === "MIXTO") {
    const h = orden.filter((j) => j.genero === "M").slice(0, n);
    const m = orden.filter((j) => j.genero === "F").slice(0, n);
    if (h.length < n || m.length < n) return [];
    pares = h.map((x, i) => [x, emparejar === "POR_ORDEN" ? m[i] : m[n - 1 - i]]);
  } else {
    const top = orden.slice(0, n * 2);
    if (top.length < n * 2) return [];
    pares = Array.from({ length: n }, (_, i) => (emparejar === "POR_ORDEN" ? [top[2 * i], top[2 * i + 1]] : [top[i], top[2 * n - 1 - i]]));
  }
  return pares.map(([a, b], i) => ({ id: `hp-${letra}${i + 1}-${a.id}`, jugadorIds: [a.id, b.id], nombre: `${a.nombre} / ${b.nombre}` }));
}

/** Crea los grupos y la llave. Devuelve primero la llave (es la ficha del torneo). */
export function crearHabibi(input: NuevoHabibiInput): { llave: EventoAmericano; grupos: EventoAmericano[] } {
  const llaveId = nuevoId("hab_");
  const nombre = input.nombre.trim() || NOMBRE_HABIBI;
  const grupos = input.grupos.map((g, i) => {
    const letra = LETRAS[i];
    const pistas = Math.min(6, Math.max(1, g.canchas.length));
    const mixto = input.categoria.rama === "MIXTO";
    const hombres = g.jugadores.filter((j) => j.genero === "M").length;
    const rondas =
      input.modalidad === "DUPLA_FIJA"
        ? planRondas(g.parejas.length, "DUPLA_FIJA", pistas).rondas
        : rondasSugeridas(g.jugadores.length, "INDIVIDUAL_ROTATIVO", pistas, mixto ? { hombres, mujeres: g.jugadores.length - hombres } : undefined);
    const e = crearEvento({
      nombre: `${nombre} · Grupo ${letra}`,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      minutosEntreRondas: input.minutosEntreRondas,
      categoria: input.categoria,
      modalidad: input.modalidad,
      puntuacion: input.puntuacionGrupos,
      pistas,
      canchas: g.canchas,
      duracionRondaMin: input.duracionRondaMin,
      cronometro: input.cronometro,
      totalRondas: rondas,
      jugadores: g.jugadores,
      parejas: input.modalidad === "DUPLA_FIJA" ? g.parejas : [],
    });
    return { ...e, habibi: { rol: "GRUPO" as const, torneoId: llaveId, letra } };
  });

  const fases = fasesLlave(input.inicio, input.tercerPuesto);
  const ahora = new Date().toISOString();
  const canchas = input.canchasLlave.slice(0, 6);
  const llave: EventoAmericano = {
    id: llaveId,
    nombre,
    club: "La Marina Sport Club",
    fecha: input.fecha ?? ahora.slice(0, 10),
    horaInicio: input.horaInicio ?? "19:00",
    horaFin: input.horaFin ?? "23:00",
    minutosEntreRondas: input.minutosEntreRondas ?? 3,
    categoria: input.categoria,
    modalidad: "DUPLA_FIJA",
    puntuacion: input.puntuacionLlave,
    pistas: Math.max(1, canchas.length),
    canchas,
    duracionRondaMin: input.duracionRondaMin,
    cronometro: false,
    totalRondas: fases.length,
    rondaActual: 1,
    estado: "BORRADOR",
    jugadores: grupos.flatMap((g) => g.jugadores),
    parejas: grupos.flatMap((g) => g.parejas),
    rondas: fases.map((fase, i) => ({
      numero: i + 1,
      estado: "PENDIENTE",
      partidos: [],
      descansanIds: [],
      fase,
      ...(fase === "FINAL" && input.puntuacionFinal ? { puntuacion: input.puntuacionFinal } : {}),
    })),
    semilla: Math.floor(Math.random() * 2 ** 31),
    creadoEn: ahora,
    actualizadoEn: ahora,
    habibi: {
      rol: "LLAVE",
      grupos: grupos.map((g) => ({ letra: (g.habibi as { letra: string }).letra, eventoId: g.id })),
      inicio: input.inicio,
      tercerPuesto: input.tercerPuesto,
      ...(input.modalidad === "INDIVIDUAL_ROTATIVO" ? { emparejar: input.emparejar ?? "EQUILIBRADO" } : {}),
      siembra: {},
      armadaEn: null,
    },
  };
  return { llave, grupos };
}

/* ---------- consultar ---------- */

export function infoLlave(e: EventoAmericano): HabibiLlave | null {
  return e.habibi?.rol === "LLAVE" ? e.habibi : null;
}

export const configRonda = (e: EventoAmericano, r?: Ronda) => r?.puntuacion ?? e.puntuacion;

/** Ganador y perdedor de un partido terminado (null si falta el resultado o quedó empatado). */
export function definir(p: Partido | undefined, cfg: ConfigPuntuacion): { ganador: Pareja; perdedor: Pareja } | null {
  if (!p || p.estado !== "FINALIZADO" || !p.resultado) return null;
  const g = ganador(cfg, p.resultado);
  if (g === 0) return null;
  return g > 0 ? { ganador: p.parejaA, perdedor: p.parejaB } : { ganador: p.parejaB, perdedor: p.parejaA };
}

/**
 * Clasificados de cada grupo en orden ("1A", "2A"…) y las duplas que van a la llave.
 * En dupla fija son sus duplas; en individual se forman con el ranking del grupo.
 */
export function clasificados(grupos: EventoAmericano[], inicio: InicioLlave, emparejar?: EmparejarLlave): { siembra: Record<string, string>; parejas: Pareja[] } {
  const siembra: Record<string, string> = {};
  const parejas: Pareja[] = [];
  for (const g of grupos) {
    const letra = g.habibi?.rol === "GRUPO" ? g.habibi.letra : "?";
    if (g.modalidad === "DUPLA_FIJA") {
      const porId = new Map(g.parejas.map((p) => [p.id, p]));
      calcularTabla(g)
        .filas.filter((f) => !f.retirado)
        .forEach((f, i) => {
          siembra[`${i + 1}${letra}`] = f.entidadId;
          const p = porId.get(f.entidadId);
          if (p) parejas.push(p);
        });
    } else {
      duplasDeGrupo(g, CLASIFICAN[inicio], emparejar).forEach((p, i) => {
        siembra[`${i + 1}${letra}`] = p.id;
        parejas.push(p);
      });
    }
  }
  return { siembra, parejas };
}

/** Ids (duplas o jugadores) de cada grupo que hoy pasarían a la llave, para marcarlos en la tabla. */
export function idsQueClasifican(g: EventoAmericano, inicio: InicioLlave, emparejar?: EmparejarLlave): Set<string> {
  const n = CLASIFICAN[inicio];
  if (g.modalidad === "DUPLA_FIJA")
    return new Set(
      calcularTabla(g)
        .filas.filter((f) => !f.retirado)
        .slice(0, n)
        .map((f) => f.entidadId),
    );
  return new Set(duplasDeGrupo(g, n, emparejar).flatMap((p) => p.jugadorIds));
}

/** Partidos de grupos que faltan por jugar. */
export function pendientesGrupos(grupos: EventoAmericano[]): number {
  return grupos.reduce((n, g) => n + g.rondas.flatMap((r) => r.partidos).filter((p) => p.estado !== "FINALIZADO").length, 0);
}

/** Por qué todavía no se puede armar la llave (null = se puede). */
export function bloqueoArmar(llave: EventoAmericano, grupos: EventoAmericano[]): string | null {
  const info = infoLlave(llave);
  if (!info) return "Este evento no es un Americano Torneo.";
  if (grupos.length !== info.grupos.length) return "Faltan grupos: espera a que se sincronicen.";
  const n = CLASIFICAN[info.inicio];
  for (const g of grupos) {
    const posibles = duplasPosibles(g, g.categoria.rama === "MIXTO");
    const letra = g.habibi?.rol === "GRUPO" ? g.habibi.letra : "?";
    if (posibles < n)
      return g.modalidad === "DUPLA_FIJA"
        ? `El grupo ${letra} tiene ${posibles} duplas activas y la llave necesita ${n}.`
        : `Con los jugadores activos del grupo ${letra} salen ${posibles} duplas y la llave necesita ${n}.`;
  }
  return null;
}

/**
 * Arma (o rearma) la llave con las posiciones finales de los grupos. Trae las
 * duplas y jugadores de los grupos (con sus fotos) y borra lo cargado en la llave.
 */
export function armarLlave(llave: EventoAmericano, grupos: EventoAmericano[]): EventoAmericano {
  const info = infoLlave(llave);
  if (!info) return llave;
  const { siembra, parejas: todas } = clasificados(grupos, info.inicio, info.emparejar);
  const usados = new Set(CRUCES[info.inicio].flat().map((s) => siembra[s]));
  const parejas = todas.filter((p) => usados.has(p.id));
  const ids = new Set(parejas.flatMap((p) => p.jugadorIds));
  const base: EventoAmericano = {
    ...llave,
    jugadores: grupos.flatMap((g) => g.jugadores).filter((j) => ids.has(j.id)),
    parejas,
    rondas: llave.rondas.map((r) => ({ ...r, partidos: [], estado: "PENDIENTE" })),
    habibi: { ...info, siembra: Object.fromEntries(Object.entries(siembra).filter(([, id]) => usados.has(id))), armadaEn: new Date().toISOString() },
    actualizadoEn: despues(llave.actualizadoEn),
  };
  return propagar(base);
}

/** Vuelve a la fase de grupos (deshace la llave armada). */
export function desarmarLlave(llave: EventoAmericano): EventoAmericano {
  const info = infoLlave(llave);
  if (!info) return llave;
  return {
    ...llave,
    estado: "BORRADOR",
    rondaActual: 1,
    rondas: llave.rondas.map((r) => ({ ...r, partidos: [], estado: "PENDIENTE" })),
    habibi: { ...info, siembra: {}, armadaEn: null },
    actualizadoEn: despues(llave.actualizadoEn),
  };
}

/** Un cruce de la llave: las dos duplas (si ya se saben) y de dónde salen. */
export interface CruceLlave {
  id: string;
  fase: FaseLlave;
  indice: number;
  /** Etiqueta de cada lado: "1A" en la primera ronda, "Ganador Cuartos 2" después. */
  origenA: string;
  origenB: string;
  parejaA: Pareja | null;
  parejaB: Pareja | null;
  partido: Partido | null;
}

/**
 * Calcula todos los cruces de la llave a partir de la siembra y los resultados.
 * Es la única fuente de verdad del cuadro: `propagar` la usa para escribir los
 * partidos y la pantalla para dibujar los que aún no tienen duplas.
 */
export function cruces(llave: EventoAmericano): CruceLlave[] {
  const info = infoLlave(llave);
  if (!info) return [];
  const siembra = info.siembra ?? {};
  const porPareja = new Map(llave.parejas.map((p) => [p.id, p]));
  const porPartido = new Map(llave.rondas.flatMap((r) => r.partidos.map((p) => [p.id, { p, r }] as const)));
  const out: CruceLlave[] = [];
  const resultadoDe = (c: CruceLlave) => {
    const x = porPartido.get(c.id);
    if (!x || !c.parejaA || !c.parejaB) return null;
    // Solo cuenta si el partido guardado es entre estas mismas duplas.
    if (x.p.parejaA.id !== c.parejaA.id || x.p.parejaB.id !== c.parejaB.id) return null;
    return definir(x.p, configRonda(llave, x.r));
  };
  let previa: CruceLlave[] = [];
  let semis: CruceLlave[] = [];
  for (const fase of fasesLlave(info.inicio, info.tercerPuesto)) {
    const actual: CruceLlave[] = [];
    const n = partidosDeFase(info.inicio, fase);
    for (let i = 0; i < n; i++) {
      let origenA: string, origenB: string, a: Pareja | null, b: Pareja | null;
      if (fase === info.inicio) {
        [origenA, origenB] = CRUCES[info.inicio][i];
        a = porPareja.get(siembra[origenA]) ?? null;
        b = porPareja.get(siembra[origenB]) ?? null;
      } else if (fase === "TERCER_PUESTO") {
        origenA = `Perdedor ${CORTO_FASE.SEMIS} 1`;
        origenB = `Perdedor ${CORTO_FASE.SEMIS} 2`;
        a = resultadoDe(semis[0])?.perdedor ?? null;
        b = resultadoDe(semis[1])?.perdedor ?? null;
      } else {
        const [x, y] = [previa[2 * i], previa[2 * i + 1]];
        origenA = `Ganador ${CORTO_FASE[x.fase]} ${x.indice + 1}`;
        origenB = `Ganador ${CORTO_FASE[y.fase]} ${y.indice + 1}`;
        a = resultadoDe(x)?.ganador ?? null;
        b = resultadoDe(y)?.ganador ?? null;
      }
      const id = idPartidoLlave(fase, i, info.armadaEn);
      const guardado = porPartido.get(id)?.p ?? null;
      const mismo = !!guardado && !!a && !!b && guardado.parejaA.id === a.id && guardado.parejaB.id === b.id;
      actual.push({ id, fase, indice: i, origenA, origenB, parejaA: a, parejaB: b, partido: mismo ? guardado : null });
    }
    out.push(...actual);
    if (fase === "SEMIS") semis = actual;
    if (fase !== "TERCER_PUESTO") previa = actual;
  }
  return out;
}

/**
 * Escribe en las rondas los partidos que ya tienen sus dos duplas, conserva los
 * resultados que siguen valiendo y descarta los que quedaron sin sentido (si se
 * corrigió un marcador anterior y cambió quién avanzó). Asigna pistas y estados.
 */
export function propagar(llave: EventoAmericano): EventoAmericano {
  const info = infoLlave(llave);
  if (!info) return llave;
  const lista = cruces(llave);
  const canchas = llave.canchas?.length ? llave.canchas.map((c) => c.numero) : Array.from({ length: llave.pistas }, (_, i) => i + 1);
  const rondas = llave.rondas.map((r) => {
    const deFase = lista.filter((c) => c.fase === r.fase);
    const partidos: Partido[] = deFase
      .filter((c) => c.parejaA && c.parejaB)
      .map((c) => {
        const pista = c.fase === "FINAL" || c.fase === "TERCER_PUESTO" ? canchas[c.fase === "FINAL" ? 0 : Math.min(1, canchas.length - 1)] : canchas[c.indice % canchas.length];
        if (c.partido) return { ...c.partido, rondaNumero: r.numero, pista: c.partido.pista ?? pista };
        return { id: c.id, rondaNumero: r.numero, pista, parejaA: c.parejaA!, parejaB: c.parejaB!, estado: "PENDIENTE" as const, resultado: null };
      });
    const completa = deFase.length > 0 && partidos.length === deFase.length && partidos.every((p) => p.estado === "FINALIZADO");
    const empezada = partidos.some((p) => p.estado !== "PENDIENTE");
    return { ...r, partidos, estado: completa ? ("FINALIZADA" as const) : empezada ? ("EN_JUEGO" as const) : ("PENDIENTE" as const) };
  });
  const armada = !!info.armadaEn;
  const final = rondas.find((r) => r.fase === "FINAL");
  const terminado = armada && rondas.every((r) => r.estado === "FINALIZADA") && !!final?.partidos.length;
  const actual = rondas.find((r) => r.estado !== "FINALIZADA")?.numero ?? rondas.length;
  return { ...llave, rondas, rondaActual: actual, estado: terminado ? "FINALIZADO" : armada ? "EN_CURSO" : "BORRADOR" };
}

/**
 * Tras fusionar dos versiones de la llave (dos celulares cargando a la vez), vuelve a
 * hacer avanzar a los ganadores: cada versión solo había propagado su propio resultado.
 */
export function fusionarLlave(e: EventoAmericano): EventoAmericano {
  return e.habibi?.rol === "LLAVE" && e.habibi.armadaEn ? propagar(e) : e;
}

/** Carga el marcador de un partido de la llave y hace avanzar al ganador. */
export function cargarResultadoLlave(llave: EventoAmericano, partidoId: string, r: Resultado): EventoAmericano {
  // Por si el partido aún no estaba escrito (ej. dos celulares cargaron a la vez la ronda anterior).
  const rondas = propagar(llave).rondas.map((ronda) => ({
    ...ronda,
    partidos: ronda.partidos.map((p) =>
      p.id === partidoId
        ? { ...p, estado: "FINALIZADO" as const, resultado: normalizarResultado(configRonda(llave, ronda), r), actualizadoEn: despues(p.actualizadoEn ?? llave.actualizadoEn) }
        : p,
    ),
  }));
  return propagar({ ...llave, rondas, actualizadoEn: despues(llave.actualizadoEn) });
}

export function borrarResultadoLlave(llave: EventoAmericano, partidoId: string): EventoAmericano {
  const rondas = llave.rondas.map((ronda) => ({
    ...ronda,
    partidos: ronda.partidos.map((p) =>
      p.id === partidoId ? { ...p, estado: "PENDIENTE" as const, resultado: null, actualizadoEn: despues(p.actualizadoEn ?? llave.actualizadoEn) } : p,
    ),
  }));
  return propagar({ ...llave, rondas, actualizadoEn: despues(llave.actualizadoEn) });
}

/** Marca un partido de la llave como "en juego" (o lo devuelve a pendiente). */
export function marcarEnJuego(llave: EventoAmericano, partidoId: string, enJuego: boolean): EventoAmericano {
  const rondas = llave.rondas.map((ronda) => ({
    ...ronda,
    partidos: ronda.partidos.map((p) => (p.id === partidoId && p.estado !== "FINALIZADO" ? { ...p, estado: enJuego ? ("EN_JUEGO" as const) : ("PENDIENTE" as const) } : p)),
  }));
  return propagar({ ...llave, rondas, actualizadoEn: despues(llave.actualizadoEn) });
}

/** Cambia la pista de un partido de la llave. */
export function cambiarPista(llave: EventoAmericano, partidoId: string, pista: number): EventoAmericano {
  return {
    ...llave,
    rondas: llave.rondas.map((r) => ({ ...r, partidos: r.partidos.map((p) => (p.id === partidoId ? { ...p, pista } : p)) })),
    actualizadoEn: despues(llave.actualizadoEn),
  };
}

/** Podio final: campeón, subcampeón y 3er puesto (o los dos semifinalistas si no se jugó). */
export function podio(llave: EventoAmericano): { lugar: number; pareja: Pareja }[] {
  const lista = cruces(llave);
  const cfgDe = (fase: FaseLlave) => configRonda(llave, llave.rondas.find((r) => r.fase === fase));
  const final = definir(lista.find((c) => c.fase === "FINAL")?.partido ?? undefined, cfgDe("FINAL"));
  if (!final) return [];
  const out = [
    { lugar: 1, pareja: final.ganador },
    { lugar: 2, pareja: final.perdedor },
  ];
  const tercero = lista.find((c) => c.fase === "TERCER_PUESTO");
  if (tercero) {
    const d = definir(tercero.partido ?? undefined, cfgDe("TERCER_PUESTO"));
    if (d) out.push({ lugar: 3, pareja: d.ganador });
  } else {
    for (const s of lista.filter((c) => c.fase === "SEMIS")) {
      const d = definir(s.partido ?? undefined, cfgDe("SEMIS"));
      if (d) out.push({ lugar: 3, pareja: d.perdedor });
    }
  }
  return out;
}

/** Semilla ("1A") de una dupla en la llave, si clasificó. */
export function semillaDe(llave: EventoAmericano, parejaId: string): string | null {
  const s = infoLlave(llave)?.siembra ?? {};
  return Object.keys(s).find((k) => s[k] === parejaId) ?? null;
}
