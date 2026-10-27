import "server-only";
import mock from "@/data/mockData.json";
import type { EventoAmericano } from "@/types/americano";
import type { MarcadorVivo, PartidoTorneo, Torneo } from "@/types/torneo";
import { leerPlantel, guardarPlantel, type ArbitroGuardado } from "./arbitros";
import { borrarDemoInscripcion, cargarDemoInscripcion } from "./demoInscripcion";
import { getRepository, getTorneosRepository } from "./repository";
import { guardarTenis, listarTenis } from "./tenis";
import { torneosDemoTenis } from "@/lib/tenis/demo";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";
import { programarTorneo } from "@/lib/torneo/programacion";

/**
 * Datos de prueba para enseñar la app (botón en Ajustes): dos americanos en juego y uno terminado,
 * un torneo en pleno desarrollo con marcadores punto a punto, y seis árbitros (código 1234, PIN 2468;
 * Carla es la árbitro principal de mesa técnica).
 * Las fechas se corren para que el torneo y los americanos sean de hoy, y los instantes para que la
 * foto de las 11:50 sea "ahora": lo que estaba en juego sigue en juego y lo pendiente se reacomoda
 * desde la hora actual (sin atraso falso ni W.O. vencidos al cargarla a otra hora).
 */
const DIA_BASE = "2026-10-24";
const INSTANTE_BASE = Date.parse("2026-10-24T15:50:00.000Z");
const datos = mock as unknown as { eventos: EventoAmericano[]; torneos: Torneo[]; marcadores: MarcadorVivo[]; extras: { data: { pin: string; arbitros: (ArbitroGuardado & { codigoDemo?: string })[] } }[] };

/** Lo cargado lleva ids "demo-…": así se reconoce para borrarlo, y cada carga es nueva (un evento borrado no revive). */
const PREFIJO = "demo-";
const ARBITROS_DEMO = datos.extras.flatMap((x) => x.data.arbitros.map((a) => a.id));

const hoyClub = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

/**
 * Corre las fechas `dias` días y renombra los ids de eventos. Con `ms`, los instantes (ISO con hora)
 * se corren exactos esos milisegundos; sin `ms`, solo cambia el día y la hora queda igual.
 */
function correr<T>(x: T, dias: number, ids: Map<string, string>, ms?: number): T {
  let json = JSON.stringify(x);
  for (const [viejo, nuevo] of ids) json = json.split(`"${viejo}`).join(`"${nuevo}`);
  if (!dias && !ms) return JSON.parse(json) as T;
  json = json.replace(/"(\d{4}-\d{2}-\d{2})(T[^"]*)?"/g, (_, f: string, resto = "") => {
    if (ms !== undefined && resto) {
      const d = new Date(`${f}${resto}`);
      if (!Number.isNaN(d.getTime())) return `"${new Date(d.getTime() + ms).toISOString()}"`;
    }
    const d = new Date(`${f}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return `"${d.toISOString().slice(0, 10)}${resto}"`;
  });
  return JSON.parse(json) as T;
}

/**
 * Lo ya jugado, llamado o en juego conserva su hora relativa a "ahora": su horario programado se
 * corre lo mismo que sus instantes (si no, contaría como atraso). Lo pendiente lo reacomoda `programarTorneo`.
 */
function horasALaFoto(t: Torneo, ms: number): Torneo {
  const correrProg = (p: PartidoTorneo): PartidoTorneo => {
    if (p.estado === "PENDIENTE" || !p.programacion) return p;
    // Hora de pared del club: se suma como si fuera UTC y se vuelve a leer igual.
    const d = new Date(Date.parse(`${p.programacion.fecha}T${p.programacion.hora}:00Z`) + ms).toISOString();
    return { ...p, programacion: { ...p.programacion, fecha: d.slice(0, 10), hora: d.slice(11, 16) } };
  };
  return { ...t, categorias: t.categorias.map((c) => (c.cuadro ? { ...c, cuadro: { ...c.cuadro, partidos: c.cuadro.partidos.map(correrProg) } } : c)) };
}

export async function cargarDemo(): Promise<{ americanos: number; torneos: number; arbitros: number; tenis: number }> {
  // Volver a cargar reemplaza los de prueba anteriores: así no se duplican si se toca dos veces.
  await borrarDemo();
  const dias = Math.round((new Date(`${hoyClub()}T12:00:00Z`).getTime() - new Date(`${DIA_BASE}T12:00:00Z`).getTime()) / 86_400_000);
  const ahora = new Date().toISOString();
  const marca = Date.now().toString(36);
  const ids = new Map([...datos.eventos, ...datos.torneos].map((x) => [x.id, `${PREFIJO}${marca}-${x.id}`]));
  const am = getRepository();
  for (const e of datos.eventos) await am.guardar({ ...correr(e, dias, ids), actualizadoEn: ahora });
  const tr = getTorneosRepository();
  const ms = Date.now() - INSTANTE_BASE;
  for (const t of datos.torneos) {
    const corrido = horasALaFoto(correr(t, dias, ids, ms), ms - dias * 86_400_000);
    await tr.guardar({ ...programarTorneo(corrido, { desde: ahora }).torneo, actualizadoEn: ahora });
  }
  for (const m of datos.marcadores) await tr.guardarMarcador(correr(m, dias, ids, ms));
  await cargarDemoInscripcion(`${PREFIJO}${marca}-`, hoyClub());
  const p = await leerPlantel();
  const nuevos = datos.extras.flatMap((x) => x.data.arbitros).filter((a) => !p.arbitros.some((y) => y.id === a.id));
  await guardarPlantel({ pin: p.pin ?? datos.extras[0]?.data.pin ?? null, arbitros: [...p.arbitros, ...(nuevos as ArbitroGuardado[])] });
  const tenis = TENIS_ACTIVO ? torneosDemoTenis(`${PREFIJO}${marca}-`, hoyClub()) : [];
  for (const t of tenis) await guardarTenis(t);
  // + la Copa Navidad con la inscripción online abierta.
  return { americanos: datos.eventos.length, torneos: datos.torneos.length + 1, arbitros: nuevos.length, tenis: tenis.length };
}

/** Quita lo que cargó `cargarDemo` (borrado lógico, así los otros dispositivos también lo sueltan). */
export async function borrarDemo(): Promise<void> {
  const ahora = new Date().toISOString();
  const am = getRepository();
  for (const e of await am.listar()) if (e.id.startsWith(PREFIJO) && !e.eliminado) await am.guardar({ ...e, eliminado: true, actualizadoEn: ahora });
  const tr = getTorneosRepository();
  const demo = (await tr.listar()).filter((t) => t.id.startsWith(PREFIJO));
  for (const t of demo) if (!t.eliminado) await tr.guardar({ ...t, eliminado: true, actualizadoEn: ahora });
  await borrarDemoInscripcion(demo.map((t) => t.id));
  if (TENIS_ACTIVO) for (const t of await listarTenis()) if (t.id.startsWith(PREFIJO) && !t.eliminado) await guardarTenis({ ...t, eliminado: true, actualizadoEn: ahora });
  const p = await leerPlantel();
  await guardarPlantel({ ...p, arbitros: p.arbitros.filter((a) => !ARBITROS_DEMO.includes(a.id)) });
}
