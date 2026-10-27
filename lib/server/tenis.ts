import "server-only";
import { fusionarTenis, resolver } from "@/lib/tenis/torneo";
import type { TorneoTenis } from "@/types/tenis";
import { getTorneosRepository } from "./repository";

/**
 * Torneos de tenis: una fila por torneo en `eventos_extras` (evento_id = 'tenis', tipo = 'tenis'),
 * así Juan no necesita una tabla nueva para empezar. Ver docs/BACKEND.md.
 */
const EVENTO = "tenis";
const TIPO = "tenis";

export async function listarTenis(): Promise<TorneoTenis[]> {
  const filas = await getTorneosRepository().listarExtras(EVENTO, TIPO);
  return filas.map((f) => f.data as TorneoTenis).filter(Boolean);
}

export async function obtenerTenis(id: string): Promise<TorneoTenis | null> {
  const x = await getTorneosRepository().obtenerExtra(`tenis:${id}`);
  return (x?.data as TorneoTenis) ?? null;
}

export async function guardarTenis(t: TorneoTenis): Promise<TorneoTenis> {
  const existente = await obtenerTenis(t.id);
  const final = existente ? fusionarTenis(existente, t) : resolver(t);
  await getTorneosRepository().guardarExtra({ id: `tenis:${t.id}`, torneoId: EVENTO, tipo: TIPO, data: final, actualizadoEn: final.actualizadoEn });
  return final;
}

/** Un árbitro solo cambia partidos (marcador, cancha, estado) de un torneo que ya existe. */
export async function guardarPartidosTenis(t: TorneoTenis): Promise<TorneoTenis | null> {
  const existente = await obtenerTenis(t.id);
  if (!existente || existente.eliminado) return null;
  const propios = new Map(t.partidos.map((p) => [p.id, p]));
  const partidos = existente.partidos.map((p) => {
    const n = propios.get(p.id);
    if (!n || n.actualizadoEn <= p.actualizadoEn) return p;
    return { ...p, estado: n.estado, cancha: n.cancha, marcador: n.marcador, resultado: n.resultado?.tipo === "BYE" ? p.resultado : n.resultado, actualizadoEn: n.actualizadoEn };
  });
  const ahora = new Date().toISOString();
  const final = resolver({ ...existente, partidos, actualizadoEn: ahora > existente.actualizadoEn ? ahora : existente.actualizadoEn });
  await getTorneosRepository().guardarExtra({ id: `tenis:${t.id}`, torneoId: EVENTO, tipo: TIPO, data: final, actualizadoEn: final.actualizadoEn });
  return final;
}

export function validarTenis(x: unknown): string[] {
  const t = x as Partial<TorneoTenis> | null;
  const e: string[] = [];
  if (!t || typeof t !== "object") return ["Falta el torneo."];
  if (typeof t.id !== "string" || !/^[\w-]{3,80}$/.test(t.id)) e.push("id inválido.");
  if (typeof t.nombre !== "string" || t.nombre.length > 120) e.push("nombre inválido.");
  if (t.superficie !== "DURA" && t.superficie !== "ARCILLA") e.push("superficie inválida.");
  if (t.modalidad !== "SINGLES" && t.modalidad !== "DOBLES") e.push("modalidad inválida.");
  if (!Array.isArray(t.inscritos) || t.inscritos.length > 256) e.push("inscritos inválidos.");
  if (!Array.isArray(t.partidos) || t.partidos.length > 512) e.push("partidos inválidos.");
  if (typeof t.actualizadoEn !== "string") e.push("actualizadoEn inválido.");
  if (!t.reglas || typeof t.reglas !== "object") e.push("reglas inválidas.");
  return e;
}
