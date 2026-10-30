"use client";

/**
 * Convierte la propuesta del asistente en el formulario de siempre ya lleno.
 * Nada se crea ni se inscribe acá: el staff confirma en la pantalla que se abre.
 */
import { categoriaLabel, nivelesPara, nivelParaSuma } from "@/lib/categories";
import { nuevoId } from "@/lib/evento";
import { horarioDelDia, validarFranja } from "@/lib/horarios";
import { configPorDefecto } from "@/lib/scoring";
import { useAmericanos } from "@/lib/store";
import { useTorneos } from "@/lib/torneosStore";
import type { ConfigPuntuacion, Genero, Jugador, Modalidad, Nivel, Pareja, Rama } from "@/types/americano";
import { dejarPrefill } from "./prefill";
import type { AccionAsistente, ArmarAmericano, ArmarAmericanoTorneo, DuplaIA, DuplaTorneoIA, PersonaIA, PuntuacionIA } from "./tipos";

const CLAVE_BORRADOR = "lamarina-setup-borrador";
const RAMAS: Rama[] = ["FEMENINO", "MASCULINO", "MIXTO"];
const MODALIDADES: Modalidad[] = ["INDIVIDUAL_ROTATIVO", "DUPLA_FIJA"];

const capital = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

const rama = (r: unknown, previa?: unknown): Rama => (RAMAS.includes(r as Rama) ? (r as Rama) : RAMAS.includes(previa as Rama) ? (previa as Rama) : "MIXTO");
const modalidad = (m: unknown, previa: unknown, hayDuplas: boolean): Modalidad =>
  MODALIDADES.includes(m as Modalidad) ? (m as Modalidad) : MODALIDADES.includes(previa as Modalidad) ? (previa as Modalidad) : hayDuplas ? "DUPLA_FIJA" : "INDIVIDUAL_ROTATIVO";

function nivelValido(n: unknown, r: Rama, porDefecto: Nivel): Nivel {
  const validos = nivelesPara(r);
  if (validos.includes(n as Nivel)) return n as Nivel;
  return n === "2DA" ? "3RA" : porDefecto;
}

function aJugador(p: PersonaIA, r: Rama, nivel: Nivel, generoPorDefecto: Genero): Jugador {
  const genero: Genero = r === "FEMENINO" ? "F" : r === "MASCULINO" ? "M" : p.genero === "F" || p.genero === "M" ? p.genero : generoPorDefecto;
  return {
    id: nuevoId("jug_"),
    nombre: capital(p.nombre || "Jugador"),
    apellido: p.apellido?.trim() ? capital(p.apellido) : undefined,
    genero,
    nivel: nivelValido(p.nivel, r, nivel),
    fotoUrl: null,
  };
}

function aDupla(d: DuplaIA, r: Rama, nivel: Nivel): { pareja: Pareja; jugadores: [Jugador, Jugador] } {
  const a = aJugador(d.a, r, nivel, "M");
  const b = aJugador(d.b, r, nivel, r === "MIXTO" && a.genero === "M" ? "F" : "M");
  return { pareja: { id: nuevoId("par_"), jugadorIds: [a.id, b.id], nombre: `${a.nombre} / ${b.nombre}` }, jugadores: [a, b] };
}

export function aPuntuacion(p: PuntuacionIA | null | undefined): ConfigPuntuacion | null {
  if (!p) return null;
  const base = configPorDefecto(p.metodo);
  if (!base) return null;
  const v = typeof p.valor === "number" && p.valor > 0 ? Math.round(p.valor) : null;
  if (p.metodo === "PUNTOS_TOTALES") return v ? { ...base, puntosPorPartido: Math.min(99, Math.max(4, v)) } : base;
  if (p.metodo === "GAMES_PUNTO_ORO") return v ? { ...base, gamesPorPartido: Math.min(15, Math.max(1, v)) } : base;
  return { ...base, ...(v ? { gamesPorPartido: Math.min(9, Math.max(2, v)) } : {}), ...(p.sets === 1 || p.sets === 3 ? { setsMaximos: p.sets } : {}) };
}

const fechaOk = (f: unknown): f is string => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const horaOk = (h: unknown): h is string => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

function pistasDelClub(pistas: number[] | null | undefined): number[] | null {
  if (!pistas?.length) return null;
  const activas = useAmericanos.getState().club.pistas.filter((p) => p.activa).map((p) => p.numero);
  const ok = [...new Set(pistas)].filter((n) => activas.includes(n));
  return ok.length ? ok : null;
}

/* ---------- americano ---------- */

function leerBorrador(): Record<string, unknown> {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "{}") as Record<string, unknown>;
    return typeof b._t === "number" && Date.now() - b._t < 12 * 3600_000 ? b : {};
  } catch {
    return {};
  }
}

const AVISO_SETUP = "lamarina-asistente-setup";

/** El setup se abre porque lo llenó el asistente (para avisar eso y no "Recuperamos…"). */
export function tomarAvisoAsistente(): boolean {
  try {
    const si = sessionStorage.getItem(AVISO_SETUP) === "1";
    sessionStorage.removeItem(AVISO_SETUP);
    return si;
  } catch {
    return false;
  }
}

/** Escribe el borrador del setup y devuelve a qué paso abrirlo. */
export function prepararAmericano(a: ArmarAmericano): string {
  const previo = leerBorrador();
  const r = rama(a.rama, previo.rama);
  const suma = typeof a.suma === "number" && a.suma > 0 ? a.suma : a.rama || a.nivel ? null : ((previo.suma as number | null) ?? null);
  const nivel = suma ? nivelParaSuma(suma) : nivelValido(a.nivel ?? previo.nivel, r, "5TA");
  const m = modalidad(a.modalidad, previo.modalidad, a.duplas.length > 0);
  const dupla = m === "DUPLA_FIJA";

  const nuevasDuplas = a.duplas.map((d) => aDupla(d, r, nivel));
  // En individual, una dupla dicha son dos jugadores sueltos; en dupla fija, los sueltos se juntan de a dos.
  const sueltos = a.jugadores.map((p, i) => aJugador(p, r, nivel, r === "MIXTO" && i % 2 ? "F" : "M"));
  if (dupla) for (let i = 0; i + 1 < sueltos.length; i += 2) nuevasDuplas.push({ pareja: { id: nuevoId("par_"), jugadorIds: [sueltos[i].id, sueltos[i + 1].id], nombre: `${sueltos[i].nombre} / ${sueltos[i + 1].nombre}` }, jugadores: [sueltos[i], sueltos[i + 1]] });
  const nuevosJugadores = dupla ? nuevasDuplas.flatMap((d) => d.jugadores) : [...sueltos, ...nuevasDuplas.flatMap((d) => d.jugadores)];

  const jugadoresPrevios = a.reemplazar ? [] : ((previo.jugadores as Jugador[] | undefined) ?? []);
  const parejasPrevias = a.reemplazar || !dupla ? [] : ((previo.parejas as Pareja[] | undefined) ?? []);
  const jugadores = [...jugadoresPrevios, ...nuevosJugadores].map((j) => ({
    ...j,
    genero: r === "FEMENINO" ? "F" : r === "MASCULINO" ? "M" : j.genero,
    nivel: nivelValido(j.nivel, r, nivel),
  }));
  const parejas = [...parejasPrevias, ...(dupla ? nuevasDuplas.map((d) => d.pareja) : [])];

  const borrador: Record<string, unknown> = {
    ...previo,
    rama: r,
    nivel,
    suma,
    modalidad: m,
    jugadores,
    parejas,
    _t: Date.now(),
  };
  if (a.nombre?.trim()) borrador.nombre = a.nombre.trim();
  if (fechaOk(a.fecha)) borrador.fecha = a.fecha;
  if (horaOk(a.horaInicio)) borrador.horaInicio = a.horaInicio;
  if (horaOk(a.horaFin)) borrador.horaFin = a.horaFin;
  const punt = aPuntuacion(a.puntuacion);
  if (punt) borrador.puntuacion = punt;
  const pistas = pistasDelClub(a.pistas);
  if (pistas) borrador.seleccion = pistas;
  if (typeof a.duracionRondaMin === "number" && a.duracionRondaMin >= 5 && a.duracionRondaMin <= 90) borrador.duracion = Math.round(a.duracionRondaMin);
  // Cambió el formato o la cantidad: las rondas vuelven a automático.
  borrador.rondas = null;

  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
    sessionStorage.setItem(AVISO_SETUP, "1");
  } catch {
    /* almacenamiento lleno */
  }

  const club = useAmericanos.getState().club;
  const fecha = (borrador.fecha as string) ?? new Date().toISOString().slice(0, 10);
  const franjaMal = horaOk(borrador.horaInicio) && horaOk(borrador.horaFin) && validarFranja(horarioDelDia(club, fecha), borrador.horaInicio, borrador.horaFin);
  return franjaMal ? "/setup?paso=3" : "/setup?paso=4";
}

/* ---------- Americano Torneo ---------- */

export interface PrefillHabibi {
  reemplazar: boolean;
  nombre: string | null;
  fecha: string | null;
  hora: string | null;
  rama: Rama;
  nivel: Nivel;
  modalidad: Modalidad;
  grupos: { pareja: Pareja; jugadores: [Jugador, Jugador] }[][];
  sueltos: Jugador[][];
  puntuacionGrupos: ConfigPuntuacion | null;
  inicio: ArmarAmericanoTorneo["inicio"];
  tercerPuesto: boolean | null;
  puntuacionLlave: ConfigPuntuacion | null;
}

export function prepararHabibi(a: ArmarAmericanoTorneo): string {
  const r = rama(a.rama);
  const nivel = nivelValido(a.nivel, r, "5TA");
  const grupos = [a.grupoA, a.grupoB];
  const hayDuplas = grupos.some((g) => g.duplas.length > 0);
  const m = modalidad(a.modalidad, null, hayDuplas || !grupos.some((g) => g.jugadores.length));
  const dupla = m === "DUPLA_FIJA";
  const datos: PrefillHabibi = {
    reemplazar: a.reemplazar !== false,
    nombre: a.nombre?.trim() || null,
    fecha: fechaOk(a.fecha) ? a.fecha : null,
    hora: horaOk(a.hora) ? a.hora : null,
    rama: r,
    nivel,
    modalidad: m,
    grupos: dupla ? grupos.map((g) => g.duplas.map((d) => aDupla(d, r, nivel))) : [[], []],
    sueltos: dupla
      ? [[], []]
      : grupos.map((g) => [
          ...g.jugadores.map((p, i) => aJugador(p, r, nivel, r === "MIXTO" && i % 2 ? "F" : "M")),
          ...g.duplas.flatMap((d) => aDupla(d, r, nivel).jugadores),
        ]),
    puntuacionGrupos: aPuntuacion(a.puntuacionGrupos),
    inicio: a.inicio,
    tercerPuesto: a.tercerPuesto,
    puntuacionLlave: aPuntuacion(a.puntuacionLlave),
  };
  dejarPrefill("habibi", datos);
  return "/habibi/nuevo";
}

/* ---------- torneos ---------- */

export interface LoteDuplas {
  categoriaId: string;
  texto: string;
}

export interface PrefillTorneoNuevo {
  nombre: string;
  inicio: string | null;
  dias: number | null;
  pistas: number[] | null;
  categorias: string[];
  descansoMin: number | null;
  toleranciaWO: number | null;
  lotes: LoteDuplas[];
}

const lineaJugador = (j: DuplaTorneoIA["a"]) => [capital(j.nombre), j.apellido ? capital(j.apellido) : "", j.cedula?.trim() ?? ""].filter(Boolean).join(" ");

/** Agrupa las duplas por categoría en el formato de "Pegar lista": "Nombre Apellido V-123 / Nombre Apellido V-456 850". */
export function lotesDeDuplas(duplas: DuplaTorneoIA[], categoriasValidas?: string[]): LoteDuplas[] {
  const porCat = new Map<string, string[]>();
  for (const d of duplas) {
    const id = d.categoriaId?.trim().toUpperCase();
    if (!id || (categoriasValidas && !categoriasValidas.includes(id))) continue;
    const linea = `${lineaJugador(d.a)} / ${lineaJugador(d.b)}${typeof d.puntos === "number" && d.puntos > 0 ? ` ${Math.round(d.puntos)}` : ""}`;
    porCat.set(id, [...(porCat.get(id) ?? []), linea]);
  }
  return [...porCat].map(([categoriaId, lineas]) => ({ categoriaId, texto: lineas.join("\n") }));
}

export interface PrefillDuplasTorneo {
  torneoId: string;
  lotes: LoteDuplas[];
}

/* ---------- despacho ---------- */

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const personas = (x: unknown) => arr<PersonaIA>(x).filter((p) => p && typeof p.nombre === "string" && p.nombre.trim());
const duplas = (x: unknown) => arr<DuplaIA>(x).filter((d) => d && d.a?.nombre?.trim() && d.b?.nombre?.trim());
const duplasTorneo = (x: unknown) => arr<DuplaTorneoIA>(x).filter((d) => d && typeof d.categoriaId === "string" && d.a?.nombre?.trim() && d.b?.nombre?.trim());
const grupo = (g: unknown) => ({ duplas: duplas((g as { duplas?: unknown })?.duplas), jugadores: personas((g as { jugadores?: unknown })?.jugadores) });

/** La IA puede omitir campos: listas vacías en vez de undefined y nombres sin vacíos. */
export function normalizar(a: AccionAsistente): AccionAsistente {
  switch (a.tipo) {
    case "armar_americano":
      return { ...a, reemplazar: a.reemplazar === true, jugadores: personas(a.jugadores), duplas: duplas(a.duplas) };
    case "armar_americano_torneo":
      return { ...a, reemplazar: a.reemplazar !== false, grupoA: grupo(a.grupoA), grupoB: grupo(a.grupoB) };
    case "crear_torneo":
      return { ...a, nombre: typeof a.nombre === "string" ? a.nombre : "", categorias: arr<string>(a.categorias).filter((c) => typeof c === "string"), duplas: duplasTorneo(a.duplas) };
    case "inscribir_duplas_torneo":
      return { ...a, duplas: duplasTorneo(a.duplas) };
    default:
      return a;
  }
}

/** Ruta interna segura (nada de otros sitios). */
export const rutaInterna = (r: string) => typeof r === "string" && r.startsWith("/") && !r.startsWith("//") && !r.includes("\\") && r.length < 200;

/** Prepara la acción y devuelve la ruta a abrir (o un error para mostrar). */
export function prepararAccion(entrada: AccionAsistente): { ruta: string } | { error: string } {
  const a = normalizar(entrada);
  switch (a.tipo) {
    case "armar_americano":
      return { ruta: prepararAmericano(a) };
    case "armar_americano_torneo":
      return { ruta: prepararHabibi(a) };
    case "crear_torneo": {
      const datos: PrefillTorneoNuevo = {
        nombre: a.nombre?.trim() ?? "",
        inicio: fechaOk(a.fechaInicio) ? a.fechaInicio : null,
        dias: typeof a.dias === "number" ? Math.min(10, Math.max(1, Math.round(a.dias))) : null,
        pistas: pistasDelClub(a.pistas),
        categorias: a.categorias.map((c) => c.trim().toUpperCase()),
        descansoMin: typeof a.descansoMin === "number" ? a.descansoMin : null,
        toleranciaWO: typeof a.toleranciaWO === "number" ? a.toleranciaWO : null,
        lotes: lotesDeDuplas(a.duplas),
      };
      dejarPrefill("torneo-nuevo", datos);
      return { ruta: "/torneos/nuevo" };
    }
    case "inscribir_duplas_torneo": {
      const t = useTorneos.getState().torneos[a.torneoId];
      if (!t || t.eliminado) return { error: "No encuentro ese torneo en este dispositivo." };
      const lotes = lotesDeDuplas(a.duplas, t.categorias.map((c) => c.categoria.id));
      if (!lotes.length) return { error: "Ninguna dupla coincide con las categorías de ese torneo." };
      dejarPrefill("torneo-duplas", { torneoId: t.id, lotes } satisfies PrefillDuplasTorneo);
      return { ruta: `/torneos/${t.id}/categorias` };
    }
    case "abrir_pantalla":
      return rutaInterna(a.ruta) ? { ruta: a.ruta } : { error: "Esa pantalla no es de la app." };
  }
}

const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

/** Título y detalle de la tarjeta de la propuesta en el chat. */
export function resumenAccion(entrada: AccionAsistente): { titulo: string; detalle: string; boton: string } {
  const a = normalizar(entrada);
  switch (a.tipo) {
    case "armar_americano": {
      const r = a.rama ?? "MIXTO";
      const cat = a.rama || a.nivel || a.suma ? categoriaLabel({ rama: r, nivel: a.nivel ?? "5TA", suma: a.suma }) : null;
      const n = a.duplas.length ? plural(a.duplas.length, "dupla") : plural(a.jugadores.length, "jugador", "jugadores");
      return {
        titulo: a.nombre?.trim() || "Americano",
        detalle: [cat, a.modalidad === "DUPLA_FIJA" ? "Dupla fija" : a.modalidad ? "Individual" : null, `${a.reemplazar ? "" : "+"}${n}`].filter(Boolean).join(" · "),
        boton: "Abrir y revisar",
      };
    }
    case "armar_americano_torneo": {
      const cuenta = (g: ArmarAmericanoTorneo["grupoA"]) => (g.duplas.length ? plural(g.duplas.length, "dupla") : plural(g.jugadores.length, "jugador", "jugadores"));
      return { titulo: a.nombre?.trim() || "Americano Torneo", detalle: `Grupo A: ${cuenta(a.grupoA)} · Grupo B: ${cuenta(a.grupoB)}`, boton: "Abrir y revisar" };
    }
    case "crear_torneo":
      return { titulo: a.nombre || "Torneo", detalle: [plural(a.categorias.length, "categoría"), a.duplas.length ? plural(a.duplas.length, "dupla") : null].filter(Boolean).join(" · "), boton: "Abrir y revisar" };
    case "inscribir_duplas_torneo": {
      const t = useTorneos.getState().torneos[a.torneoId];
      return { titulo: t?.nombre ?? "Torneo", detalle: `Inscribir ${plural(a.duplas.length, "dupla")}`, boton: "Abrir y revisar" };
    }
    case "abrir_pantalla":
      return { titulo: a.titulo || a.ruta, detalle: a.ruta, boton: "Ir" };
  }
}
