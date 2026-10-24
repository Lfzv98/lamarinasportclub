import "server-only";
import type { NextResponse } from "next/server";
import type { ArbitroRegistrado, Torneo } from "@/types/torneo";
import { COOKIE_ARBITRO, crearTokenArbitro, hashCodigo, huellaClave, type SesionArbitro } from "./auth";
import { ErrorApi } from "./http";
import { getTorneosRepository } from "./repository";
import { esArbitroDe } from "./torneos";

/**
 * Registro de árbitros de un torneo. Vive aparte del torneo (tabla `torneos_extras`, tipo
 * "arbitros") para que el código personal nunca viaje con el torneo y para que un registro
 * no compita con los cambios del staff.
 */
export interface ArbitroGuardado extends ArbitroRegistrado {
  codigoHash: string;
  actualizadoEn: string;
}

const idRegistro = (torneoId: string) => `arbitros:${torneoId}`;

export async function leerRegistro(torneoId: string): Promise<ArbitroGuardado[]> {
  const x = await getTorneosRepository().obtenerExtra(idRegistro(torneoId));
  // Los árbitros de ejemplo (data/mockData.json) traen el código en claro solo para la demo.
  return ((x?.data as (ArbitroGuardado & { codigoDemo?: string })[] | undefined) ?? []).map(({ codigoDemo, ...a }) =>
    !a.codigoHash && codigoDemo ? { ...a, codigoHash: hashCodigo(torneoId, a.id, codigoDemo) } : a,
  );
}

export async function guardarRegistro(torneoId: string, lista: ArbitroGuardado[]): Promise<void> {
  await getTorneosRepository().guardarExtra({ id: idRegistro(torneoId), torneoId, tipo: "arbitros", data: lista, actualizadoEn: new Date().toISOString() });
}

/** Lo que ve cualquiera en la pantalla de entrada: nombre e inicial del apellido. */
export const arbitroPublico = (a: ArbitroGuardado) => ({ id: a.id, nombre: a.nombre, apellido: a.apellido ? `${a.apellido[0]}.` : "", activo: a.activo, registradoEn: a.registradoEn });

/** Lo que ve el staff: todo menos el código. */
export const arbitroStaff = ({ codigoHash: _c, actualizadoEn: _u, ...a }: ArbitroGuardado): ArbitroRegistrado => a;

export const nombreArbitro = (a: Pick<ArbitroRegistrado, "nombre" | "apellido">) => `${a.nombre} ${a.apellido}`.trim();

/** Huella del código que va en la cookie: si cambia el código, la sesión cae. */
export const huellaCodigo = (a: ArbitroGuardado) => huellaClave(a.codigoHash);

/** Para escribir: la sesión vale para el torneo y el árbitro sigue registrado, activo y con el mismo código. */
export async function arbitroValido(t: Torneo, s?: SesionArbitro | null): Promise<ArbitroGuardado | null> {
  if (!s || !esArbitroDe(t, s)) return null;
  const a = (await leerRegistro(t.id)).find((x) => x.id === s.arbitroId);
  return a && a.activo && huellaCodigo(a) === s.hc ? a : null;
}

export const opcionesCookie = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });

/** Torneo con PIN de árbitros vigente, o el error que corresponde. */
export async function torneoConArbitros(torneoId: unknown): Promise<Torneo> {
  if (typeof torneoId !== "string") throw new ErrorApi(400, "Falta el torneo.");
  const t = await getTorneosRepository().obtener(torneoId);
  if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
  if (!t.arbitros?.pin) throw new ErrorApi(403, "Este torneo no tiene PIN de árbitros. Pídelo al staff.");
  if (!(new Date(t.arbitros.vence).getTime() > Date.now())) throw new ErrorApi(410, "El acceso de árbitros de este torneo ya venció.");
  return t;
}

/** Deja la sesión del árbitro en este dispositivo. */
export function conSesion(res: NextResponse, t: Torneo, a: ArbitroGuardado): NextResponse {
  const { token, maxAge } = crearTokenArbitro(
    { torneoId: t.id, arbitroId: a.id, nombre: nombreArbitro(a), huella: huellaClave(t.arbitros!.pin), hc: huellaCodigo(a) },
    new Date(t.arbitros!.vence).getTime(),
  );
  res.cookies.set(COOKIE_ARBITRO, token, opcionesCookie(maxAge));
  return res;
}

export const sesionPublica = (t: Torneo, a: ArbitroGuardado) => ({ torneoId: t.id, id: a.id, nombre: nombreArbitro(a) });

