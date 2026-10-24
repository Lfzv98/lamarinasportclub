import { NextResponse } from "next/server";
import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { paraVisor, visorDe } from "@/lib/server/torneos";
import { fusionarTorneos } from "@/lib/torneo/torneo";
import { validarTorneo } from "@/lib/torneo/validacion";
import type { ApiTorneosRespuesta, Torneo } from "@/types/torneo";

export const dynamic = "force-dynamic";

/**
 * GET /api/torneos → { modo, torneos }. `?todos=1` incluye los eliminados.
 * El staff recibe todo; los participantes, según la clave del torneo (ver lib/server/torneos.ts).
 */
export const GET = manejar(async (req: Request) => {
  const repo = getTorneosRepository();
  const v = visorDe(req);
  const todos = new URL(req.url).searchParams.get("todos") === "1";
  const torneos = (await repo.listar()).filter((t) => todos || !t.eliminado).map((t) => paraVisor(t, v));
  return NextResponse.json<ApiTorneosRespuesta>({ modo: repo.modo, torneos });
});

/** POST /api/torneos body: { torneo } → upsert con fusión por partido (staff). */
export const POST = manejar(async (req: Request) => {
  exigirStaff(req);
  const body = (await leerJson(req)) as { torneo?: unknown } | null;
  const errores = validarTorneo(body?.torneo);
  if (errores.length) throw new ErrorApi(422, "Torneo inválido.", errores);
  const entrante = body!.torneo as Torneo;
  const { bloqueado: _b, ...limpio } = entrante;
  const repo = getTorneosRepository();
  const existente = await repo.obtener(limpio.id);
  const final = existente ? fusionarTorneos(existente, limpio) : limpio;
  await repo.guardar(final);
  return NextResponse.json({ modo: repo.modo, torneo: final }, { status: existente ? 200 : 201 });
});
