import { NextResponse } from "next/server";
import { sesionDe } from "@/lib/server/auth";
import { arbitroPublico, arbitroStaff, guardarRegistro, leerRegistro } from "@/lib/server/arbitros";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/arbitros?torneoId= → árbitros registrados.
 * Staff: todo (teléfono, estado y cuántos partidos anotó cada uno). Resto: nombre e inicial,
 * solo mientras el torneo tenga PIN de árbitros vigente (es la lista de "¿quién eres?").
 */
export const GET = manejar(async (req: Request) => {
  const torneoId = new URL(req.url).searchParams.get("torneoId");
  if (!torneoId) throw new ErrorApi(400, "Falta torneoId.");
  const repo = getTorneosRepository();
  const t = await repo.obtener(torneoId);
  if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
  const lista = await leerRegistro(torneoId);
  if (sesionDe(req)) {
    const marcadores = await repo.listarMarcadores(torneoId);
    const partidos = new Map<string, number>();
    const puntos = new Map<string, number>();
    for (const m of marcadores) {
      for (const x of new Set((m.anotadores ?? []).map((a) => a.id))) partidos.set(x, (partidos.get(x) ?? 0) + 1);
      for (const p of m.puntos) if (p.por) puntos.set(p.por, (puntos.get(p.por) ?? 0) + 1);
    }
    return NextResponse.json({ arbitros: lista.map((a) => ({ ...arbitroStaff(a), partidos: partidos.get(a.id) ?? 0, puntos: puntos.get(a.id) ?? 0 })) });
  }
  const vigente = t.arbitros?.pin && new Date(t.arbitros.vence).getTime() > Date.now();
  return NextResponse.json({ arbitros: vigente ? lista.filter((a) => a.activo).map(arbitroPublico) : [] });
});

/** PATCH /api/arbitros { torneoId, id, activo } (staff) → pausa o reactiva a un árbitro. */
export const PATCH = manejar(async (req: Request) => {
  if (!sesionDe(req)) throw new ErrorApi(401, "Solo el staff.");
  const b = (await leerJson(req)) as { torneoId?: unknown; id?: unknown; activo?: unknown } | null;
  if (typeof b?.torneoId !== "string" || typeof b?.id !== "string" || typeof b?.activo !== "boolean") throw new ErrorApi(400, "Envía { torneoId, id, activo }.");
  const lista = await leerRegistro(b.torneoId);
  const a = lista.find((x) => x.id === b.id);
  if (!a) throw new ErrorApi(404, "Árbitro no encontrado.");
  a.activo = b.activo;
  a.actualizadoEn = new Date().toISOString();
  await guardarRegistro(b.torneoId, lista);
  return NextResponse.json({ arbitro: arbitroStaff(a) });
});

/** DELETE /api/arbitros?torneoId=&id= (staff) → borra el registro (sus partidos anotados conservan su nombre). */
export const DELETE = manejar(async (req: Request) => {
  if (!sesionDe(req)) throw new ErrorApi(401, "Solo el staff.");
  const q = new URL(req.url).searchParams;
  const torneoId = q.get("torneoId");
  const id = q.get("id");
  if (!torneoId || !id) throw new ErrorApi(400, "Faltan torneoId e id.");
  const lista = await leerRegistro(torneoId);
  await guardarRegistro(torneoId, lista.filter((x) => x.id !== id));
  return NextResponse.json({ ok: true });
});
