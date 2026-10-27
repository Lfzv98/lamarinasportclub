import "server-only";
import type { Inscripcion } from "@/types/inscripcion";
import { ipDe } from "./auth";
import { ErrorApi } from "./http";
import { getTorneosRepository } from "./repository";

/**
 * Inscripciones online. Cada una es una fila de `eventos_extras` (tipo "inscripcion"),
 * y su comprobante de pago otra (tipo "insc-comp"), así el listado del staff no carga fotos
 * y los datos personales nunca viajan dentro del torneo.
 */
const idInsc = (torneoId: string, id: string) => `insc:${torneoId}:${id}`;
const idComp = (torneoId: string, id: string) => `insc-comp:${torneoId}:${id}`;

export async function listarInscripciones(torneoId: string): Promise<Inscripcion[]> {
  const filas = await getTorneosRepository().listarExtras(torneoId, "inscripcion");
  return filas
    .map((x) => x.data as Inscripcion)
    .filter(Boolean)
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
}

export async function obtenerInscripcion(torneoId: string, id: string): Promise<Inscripcion> {
  const x = await getTorneosRepository().obtenerExtra(idInsc(torneoId, id));
  if (!x) throw new ErrorApi(404, "Inscripción no encontrada.");
  return x.data as Inscripcion;
}

export async function guardarInscripcion(i: Inscripcion): Promise<Inscripcion> {
  await getTorneosRepository().guardarExtra({ id: idInsc(i.torneoId, i.id), torneoId: i.torneoId, tipo: "inscripcion", data: i, actualizadoEn: i.actualizadaEn });
  return i;
}

export async function guardarComprobante(torneoId: string, id: string, img: string): Promise<void> {
  await getTorneosRepository().guardarExtra({ id: idComp(torneoId, id), torneoId, tipo: "insc-comp", data: { img }, actualizadoEn: new Date().toISOString() });
}

export async function leerComprobante(torneoId: string, id: string): Promise<string | null> {
  const x = await getTorneosRepository().obtenerExtra(idComp(torneoId, id));
  return (x?.data as { img?: string } | undefined)?.img ?? null;
}

/* ---------- freno anti-spam (por instancia; suficiente para un formulario público) ---------- */

const memoria = globalThis as unknown as { __inscFreno?: Map<string, number[]> };
const VENTANA_MS = 10 * 60_000;
const MAX_POR_VENTANA = 12;

export function frenar(req: Request): void {
  const ip = ipDe(req);
  const mapa = (memoria.__inscFreno ??= new Map<string, number[]>());
  const ahora = Date.now();
  const recientes = (mapa.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) throw new ErrorApi(429, "Demasiados intentos seguidos. Espera unos minutos o escríbenos por WhatsApp.");
  recientes.push(ahora);
  mapa.set(ip, recientes);
}
