/**
 * Torneos de tenis: cuadro de eliminación con cabezas de serie y byes, liga (todos contra todos)
 * o partido único; avance automático de ganadores y fusión entre dispositivos.
 */
import type { FormatoCuadro, InscritoTenis, Lado, Modalidad, PartidoTenis, Rama, ReglasTenis, SetJugado, Superficie, TorneoTenis } from "@/types/tenis";
import { FORMATOS, calcular, setsDe } from "./marcador.ts";

export const SUPERFICIES: Record<Superficie, { nombre: string; ingles: string; lema: string; color: string; claro: string; oscuro: string; datos: { titulo: string; valor: string }[] }> = {
  DURA: {
    nombre: "Cancha dura",
    ingles: "Hard court",
    lema: "Rápida, pareja y sin excusas.",
    color: "#2f7ff0",
    claro: "#6fb1ff",
    oscuro: "#0d3a8c",
    datos: [
      { titulo: "Velocidad", valor: "Media-rápida" },
      { titulo: "Bote", valor: "Alto y predecible" },
      { titulo: "Premia", valor: "Saque y primer golpe" },
    ],
  },
  ARCILLA: {
    nombre: "Arcilla",
    ingles: "Clay court",
    lema: "Paciencia, deslizarse y ganar el punto largo.",
    color: "#d9653b",
    claro: "#f4a27c",
    oscuro: "#7a2c12",
    datos: [
      { titulo: "Velocidad", valor: "Lenta" },
      { titulo: "Bote", valor: "Alto, con mucho efecto" },
      { titulo: "Premia", valor: "Resistencia y top spin" },
    ],
  },
};

export const CATEGORIAS_TENIS = ["Open", "1ra", "2da", "3ra", "4ta", "5ta", "Principiantes", "Junior 12", "Junior 14", "Junior 16", "Junior 18", "Senior +35", "Senior +45", "Senior +55", "Senior +65"];

export const RAMAS: Record<Rama, string> = { MASCULINO: "Masculino", FEMENINO: "Femenino", MIXTO: "Mixto" };

export const id = (p = "") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Generador pseudoaleatorio con semilla (el mismo sorteo en todos los dispositivos). */
export function aleatorio(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function nombreInscrito(t: Pick<TorneoTenis, "inscritos">, iid: string | null | undefined, corto = false): string {
  const i = t.inscritos.find((x) => x.id === iid);
  if (!i) return "Por definir";
  const n = i.jugadores.map((j) => (corto ? apellidoDe(j.nombre) : j.nombre));
  return n.join(" / ");
}

export function apellidoDe(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return partes.length > 1 ? partes.slice(1).join(" ") : partes[0];
}

export function inscrito(t: Pick<TorneoTenis, "inscritos">, iid: string | null | undefined): InscritoTenis | undefined {
  return t.inscritos.find((x) => x.id === iid);
}

/** Lee la lista pegada: un inscrito por línea; en dobles "Nombre / Nombre". "(1)" al principio = cabeza de serie 1. */
export function leerLista(texto: string, modalidad: Modalidad): { inscritos: InscritoTenis[]; errores: string[] } {
  const errores: string[] = [];
  const inscritos: InscritoTenis[] = [];
  texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linea, n) => {
      let resto = linea.replace(/^\d+[.)-]\s+/, "");
      let siembra: number | null = null;
      const m = resto.match(/^\[?\((\d{1,2})\)\]?\s*/) ?? resto.match(/^\[(\d{1,2})\]\s*/);
      if (m) {
        siembra = Number(m[1]);
        resto = resto.slice(m[0].length);
      }
      const nombres = resto
        .split(/\s*[/+&]\s*|\s+y\s+/i)
        .map((x) => x.trim())
        .filter(Boolean);
      const esperados = modalidad === "DOBLES" ? 2 : 1;
      if (nombres.length !== esperados) {
        errores.push(`Línea ${n + 1}: ${modalidad === "DOBLES" ? "escribe la pareja así: Nombre Apellido / Nombre Apellido" : "un jugador por línea"}.`);
        return;
      }
      inscritos.push({ id: id("i"), siembra, jugadores: nombres.map((nombre) => ({ id: id("j"), nombre })) });
    });
  return { inscritos, errores };
}

/** Orden de las líneas del cuadro según las cabezas de serie (1 y 2 en extremos opuestos, etc.). */
export function lineasSiembra(tam: number): number[] {
  let lineas = [1];
  while (lineas.length < tam) {
    const n = lineas.length * 2;
    lineas = lineas.flatMap((s) => [s, n + 1 - s]);
  }
  return lineas;
}

export const nombreRonda = (ronda: number, total: number) => {
  const faltan = total - ronda;
  if (faltan === 0) return "Final";
  if (faltan === 1) return "Semifinal";
  if (faltan === 2) return "Cuartos";
  if (faltan === 3) return "Octavos";
  return `Ronda de ${2 ** (faltan + 1)}`;
};

export const rondasDe = (t: TorneoTenis) => Math.max(0, ...t.partidos.map((p) => p.ronda));

interface DatosNuevo {
  nombre: string;
  superficie: Superficie;
  modalidad: Modalidad;
  rama: Rama;
  categoria: string;
  reglas: ReglasTenis;
  formato: FormatoCuadro;
  fecha: string;
  canchas: number;
  inscritos: InscritoTenis[];
  semilla?: number;
}

export function crearTorneoTenis(d: DatosNuevo): TorneoTenis {
  const ahora = new Date().toISOString();
  const t: TorneoTenis = {
    id: id("tn-"),
    nombre: d.nombre.trim() || "Torneo de tenis",
    superficie: d.superficie,
    modalidad: d.modalidad,
    rama: d.rama,
    categoria: d.categoria,
    reglas: d.reglas,
    formato: d.formato,
    fecha: d.fecha,
    canchas: d.canchas,
    inscritos: d.inscritos,
    partidos: [],
    estado: "INSCRIPCION",
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  return sortear(t, d.semilla ?? Date.now());
}

/** Arma los partidos según el formato. Se puede volver a sortear mientras nadie haya jugado. */
export function sortear(t: TorneoTenis, semilla: number): TorneoTenis {
  const ahora = new Date().toISOString();
  const rnd = aleatorio(semilla);
  const mezclados = [...t.inscritos].map((x) => ({ x, r: rnd() })).sort((a, b) => a.r - b.r).map((y) => y.x);
  let partidos: PartidoTenis[] = [];
  const base = (ronda: number, orden: number, a: string | null, b: string | null): PartidoTenis => ({ id: `${t.id}-r${ronda}-${orden}`, ronda, orden, a, b, estado: "PENDIENTE", actualizadoEn: ahora });

  if (t.formato === "PARTIDO") {
    partidos = [base(1, 0, t.inscritos[0]?.id ?? null, t.inscritos[1]?.id ?? null)];
  } else if (t.formato === "LIGA") {
    // Método del círculo: cada jornada todos juegan (o uno descansa si son impares).
    const ids: (string | null)[] = mezclados.map((x) => x.id);
    if (ids.length % 2) ids.push(null);
    const n = ids.length;
    for (let j = 0; j < n - 1; j++) {
      let orden = 0;
      for (let k = 0; k < n / 2; k++) {
        const a = ids[k];
        const b = ids[n - 1 - k];
        if (a && b) partidos.push(base(j + 1, orden++, j % 2 ? b : a, j % 2 ? a : b));
      }
      ids.splice(1, 0, ids.pop()!);
    }
  } else {
    // Eliminación: los sembrados por su número, el resto al azar; los byes van a los mejores.
    const sembrados = mezclados.filter((x) => x.siembra).sort((a, b) => a.siembra! - b.siembra!);
    const resto = mezclados.filter((x) => !x.siembra);
    const orden = [...sembrados, ...resto];
    let tam = 2;
    while (tam < orden.length) tam *= 2;
    const lineas = lineasSiembra(tam);
    const rondas = Math.log2(tam);
    for (let i = 0; i < tam / 2; i++) {
      const a = orden[lineas[2 * i] - 1]?.id ?? null;
      const b = orden[lineas[2 * i + 1] - 1]?.id ?? null;
      partidos.push(base(1, i, a, b));
    }
    for (let r = 2; r <= rondas; r++) for (let i = 0; i < tam / 2 ** r; i++) partidos.push(base(r, i, null, null));
  }
  return resolver({ ...t, partidos, estado: "INSCRIPCION", actualizadoEn: ahora });
}

export const ganadorDe = (p: PartidoTenis): string | null => (p.resultado ? (p.resultado.ganador === 0 ? p.a : p.b) : null);
export const perdedorDe = (p: PartidoTenis): string | null => (p.resultado ? (p.resultado.ganador === 0 ? p.b : p.a) : null);

/** Pasa los byes y lleva a cada ganador a su lugar en la ronda siguiente. Recalcula el estado del torneo. */
export function resolver(t: TorneoTenis): TorneoTenis {
  if (t.formato !== "ELIMINACION") return { ...t, estado: estadoDe(t.partidos, t.formato) };
  const partidos = t.partidos.map((p) => ({ ...p }));
  const de = (r: number, o: number) => partidos.find((p) => p.ronda === r && p.orden === o);
  const rondas = Math.max(...partidos.map((p) => p.ronda));
  for (let r = 1; r <= rondas; r++) {
    for (const p of partidos.filter((x) => x.ronda === r)) {
      if (r > 1 && p.estado === "PENDIENTE") {
        const pa = de(r - 1, p.orden * 2);
        const pb = de(r - 1, p.orden * 2 + 1);
        p.a = pa ? ganadorDe(pa) : null;
        p.b = pb ? ganadorDe(pb) : null;
        // Ninguno de los dos partidos anteriores tiene a nadie: también es un bye vacío.
        const vacioA = pa && !pa.a && !pa.b;
        const vacioB = pb && !pb.a && !pb.b;
        if (p.resultado?.tipo === "BYE") p.resultado = null;
        if ((p.a && !p.b && vacioB) || (p.b && !p.a && vacioA)) p.resultado = { ganador: p.a ? 0 : 1, sets: [], tipo: "BYE" };
      }
      if (r === 1 && !p.marcador && ((p.a && !p.b) || (!p.a && p.b))) {
        p.resultado = { ganador: p.a ? 0 : 1, sets: [], tipo: "BYE" };
      }
    }
  }
  return { ...t, partidos, estado: estadoDe(partidos, t.formato) };
}

function estadoDe(partidos: PartidoTenis[], formato: FormatoCuadro): TorneoTenis["estado"] {
  if (!partidos.length) return "INSCRIPCION";
  const final = partidos.reduce((m, p) => (p.ronda > m.ronda ? p : m), partidos[0]);
  const terminado = formato === "ELIMINACION" ? !!final.resultado : partidos.every((p) => p.resultado);
  if (terminado) return "FINALIZADO";
  if (partidos.some((p) => p.resultado?.tipo !== "BYE" && (p.resultado || p.estado !== "PENDIENTE"))) return "EN_JUEGO";
  return "INSCRIPCION";
}

/** ¿Se puede jugar? Los dos lados definidos y sin resultado. */
export const jugable = (p: PartidoTenis) => !!p.a && !!p.b && !p.resultado;

export function idsDe(t: TorneoTenis, iid: string | null): string[] {
  return inscrito(t, iid)?.jugadores.map((j) => j.id) ?? [];
}

/** Cambia un partido (marcador, cancha, estado) y propaga el ganador si terminó. */
export function actualizarPartido(t: TorneoTenis, pid: string, fn: (p: PartidoTenis) => PartidoTenis): TorneoTenis {
  const ahora = new Date().toISOString();
  const partidos = t.partidos.map((p) => {
    if (p.id !== pid) return p;
    const n = fn(p);
    // Con marcador, el resultado sale del marcador.
    if (n.marcador && n.resultado?.tipo !== "WO" && n.resultado?.tipo !== "RETIRO") {
      const e = calcular(n.marcador, t.reglas, idsDe(t, n.a));
      if (e.ganador !== null) {
        n.resultado = { ganador: e.ganador, sets: setsDe(e), tipo: "NORMAL" };
        n.estado = "FINALIZADO";
        n.marcador = { ...n.marcador, fin: n.marcador.fin ?? ahora };
      } else {
        n.resultado = null;
        if (n.estado === "FINALIZADO") n.estado = "EN_JUEGO";
      }
    }
    return { ...n, actualizadoEn: ahora };
  });
  return resolver({ ...t, partidos, actualizadoEn: ahora });
}

/** W.O. o retiro: gana `ganador`; en retiro se conserva el marcador jugado. */
export function cerrarPartido(t: TorneoTenis, pid: string, ganador: Lado, tipo: "WO" | "RETIRO"): TorneoTenis {
  return actualizarPartido(t, pid, (p) => {
    const sets: SetJugado[] = p.marcador ? setsDe(calcular(p.marcador, t.reglas, idsDe(t, p.a))) : [];
    return { ...p, estado: "FINALIZADO", resultado: { ganador, sets, tipo } };
  });
}

/** Deshace un W.O./retiro mientras la ronda siguiente no haya empezado. */
export function reabrirPartido(t: TorneoTenis, pid: string): TorneoTenis {
  return actualizarPartido(t, pid, (p) => ({ ...p, resultado: null, estado: p.marcador ? "EN_JUEGO" : "PENDIENTE" }));
}

/* ---------- Tabla de la liga ---------- */

export interface FilaLiga {
  id: string;
  pj: number;
  pg: number;
  pp: number;
  setsF: number;
  setsC: number;
  juegosF: number;
  juegosC: number;
}

export function tablaLiga(t: TorneoTenis): FilaLiga[] {
  const filas = new Map<string, FilaLiga>(t.inscritos.map((i) => [i.id, { id: i.id, pj: 0, pg: 0, pp: 0, setsF: 0, setsC: 0, juegosF: 0, juegosC: 0 }]));
  for (const p of t.partidos) {
    if (!p.resultado || !p.a || !p.b) continue;
    const fa = filas.get(p.a);
    const fb = filas.get(p.b);
    if (!fa || !fb) continue;
    fa.pj++;
    fb.pj++;
    if (p.resultado.ganador === 0) {
      fa.pg++;
      fb.pp++;
    } else {
      fb.pg++;
      fa.pp++;
    }
    for (const s of p.resultado.sets) {
      const ga = s.a > s.b ? 1 : 0;
      fa.setsF += ga;
      fa.setsC += 1 - ga;
      fb.setsF += 1 - ga;
      fb.setsC += ga;
      fa.juegosF += s.a;
      fa.juegosC += s.b;
      fb.juegosF += s.b;
      fb.juegosC += s.a;
    }
  }
  const lista = [...filas.values()];
  const entre = (x: string, y: string) => {
    const p = t.partidos.find((q) => q.resultado && ((q.a === x && q.b === y) || (q.a === y && q.b === x)));
    if (!p) return 0;
    return ganadorDe(p) === x ? -1 : 1;
  };
  return lista.sort((x, y) => {
    if (y.pg !== x.pg) return y.pg - x.pg;
    // Dos empatados: manda el partido entre ellos.
    const empatados = lista.filter((f) => f.pg === x.pg);
    if (empatados.length === 2) {
      const h = entre(x.id, y.id);
      if (h) return h;
    }
    const ds = y.setsF - y.setsC - (x.setsF - x.setsC);
    if (ds) return ds;
    return y.juegosF - y.juegosC - (x.juegosF - x.juegosC);
  });
}

/** Campeón (eliminación o partido) o líder de la liga terminada. */
export function campeon(t: TorneoTenis): string | null {
  if (t.estado !== "FINALIZADO") return null;
  if (t.formato === "LIGA") return tablaLiga(t)[0]?.id ?? null;
  const final = t.partidos.reduce<PartidoTenis | null>((m, p) => (!m || p.ronda > m.ronda ? p : m), null);
  return final ? ganadorDe(final) : null;
}

export function progreso(t: TorneoTenis) {
  const reales = t.partidos.filter((p) => p.resultado?.tipo !== "BYE" && !(p.ronda === 1 && (!p.a || !p.b)));
  return { jugados: reales.filter((p) => p.resultado).length, total: reales.length, enJuego: t.partidos.filter((p) => p.estado === "EN_JUEGO").length };
}

/* ---------- Fusión entre dispositivos ---------- */

/**
 * Une dos versiones: cada partido se queda con su versión más nueva (dos árbitros en dos canchas
 * no se pisan) y el resto del torneo con la versión más nueva del torneo.
 */
export function fusionarTenis(a: TorneoTenis, b: TorneoTenis): TorneoTenis {
  const [viejo, nuevo] = a.actualizadoEn > b.actualizadoEn ? [b, a] : [a, b];
  if (nuevo.eliminado) return nuevo;
  const mapaViejo = new Map(viejo.partidos.map((p) => [p.id, p]));
  // Si el más nuevo se re-sorteó (otros ids), manda el más nuevo entero.
  const mismoCuadro = nuevo.partidos.every((p) => mapaViejo.has(p.id)) && nuevo.partidos.length === viejo.partidos.length;
  if (!mismoCuadro) return nuevo;
  const partidos = nuevo.partidos.map((p) => {
    const v = mapaViejo.get(p.id)!;
    const masPuntos = (v.marcador?.puntos.length ?? 0) > (p.marcador?.puntos.length ?? 0) || (!!v.resultado && !p.resultado);
    return v.actualizadoEn > p.actualizadoEn || (v.actualizadoEn === p.actualizadoEn && masPuntos) ? v : p;
  });
  return resolver({ ...nuevo, partidos });
}

export function formatoNombre(t: Pick<TorneoTenis, "reglas">) {
  return FORMATOS[t.reglas.formato]?.nombre ?? "Clásico";
}

export function reglasCon(formato: keyof typeof FORMATOS, ventaja: boolean): ReglasTenis {
  return { ...FORMATOS[formato].reglas, ventaja };
}
