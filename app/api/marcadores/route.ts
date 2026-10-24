import { NextResponse } from "next/server";
import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { puedeVer, visorDe } from "@/lib/server/torneos";
import { validarMarcador } from "@/lib/torneo/validacion";
import type { ApiMarcadoresRespuesta, MarcadorVivo } from "@/types/torneo";

export const dynamic = "force-dynamic";

/**
 * GET /api/marcadores?torneoId=… → marcadores punto a punto (para el marcador de pista,
 * el cuadro en vivo y las estadísticas). `&desde=ISO` devuelve solo los cambiados después.
 */
export const GET = manejar(async (req: Request) => {
  const url = new URL(req.url);
  const torneoId = url.searchParams.get("torneoId");
  const desde = url.searchParams.get("desde");
  const repo = getTorneosRepository();
  const v = visorDe(req);
  const torneos = new Map((await repo.listar()).map((t) => [t.id, t]));
  const marcadores = (await repo.listarMarcadores(torneoId)).filter((m) => {
    const t = torneos.get(m.torneoId);
    return t && puedeVer(t, v) && (!desde || m.actualizadoEn > desde);
  });
  return NextResponse.json<ApiMarcadoresRespuesta>({ modo: repo.modo, marcadores });
});

/** POST /api/marcadores body: { marcador } → gana la versión más reciente (staff). */
export const POST = manejar(async (req: Request) => {
  exigirStaff(req);
  const body = (await leerJson(req)) as { marcador?: unknown } | null;
  const errores = validarMarcador(body?.marcador);
  if (errores.length) throw new ErrorApi(422, "Marcador inválido.", errores);
  const entrante = body!.marcador as MarcadorVivo;
  const repo = getTorneosRepository();
  const existente = await repo.obtenerMarcador(entrante.id);
  const final = existente && existente.actualizadoEn > entrante.actualizadoEn ? existente : entrante;
  await repo.guardarMarcador(final);
  return NextResponse.json({ modo: repo.modo, marcador: final });
});
