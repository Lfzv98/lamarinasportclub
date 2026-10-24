import { NextResponse } from "next/server";
import { sesionDe } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { esArbitroDe, puedeVer, visorDe } from "@/lib/server/torneos";
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

/**
 * POST /api/marcadores body: { marcador } → gana la versión más reciente.
 * Lo suben el staff y los árbitros del torneo del marcador (el árbitro queda como anotador).
 */
export const POST = manejar(async (req: Request) => {
  const body = (await leerJson(req)) as { marcador?: unknown } | null;
  const errores = validarMarcador(body?.marcador);
  if (errores.length) throw new ErrorApi(422, "Marcador inválido.", errores);
  let entrante = body!.marcador as MarcadorVivo;
  const repo = getTorneosRepository();
  const existente = await repo.obtenerMarcador(entrante.id);
  if (!sesionDe(req)) {
    const t = await repo.obtener(entrante.torneoId);
    const a = visorDe(req).arbitro;
    if (!t || !esArbitroDe(t, a)) throw new ErrorApi(401, "Solo el staff o los árbitros de este torneo pueden anotar.");
    // Solo partidos de su torneo.
    if (!t.categorias.some((c) => c.cuadro?.partidos.some((p) => p.id === entrante.id))) throw new ErrorApi(403, "Ese partido no es de tu torneo.");
    if (existente?.finalizado) throw new ErrorApi(403, "Ese partido ya se cerró. Para corregirlo, avisa al staff.");
    entrante = { ...entrante, anotador: a!.nombre };
  }
  if (existente && existente.torneoId !== entrante.torneoId) throw new ErrorApi(409, "Ese marcador es de otro torneo.");
  const final = existente && existente.actualizadoEn > entrante.actualizadoEn ? existente : entrante;
  await repo.guardarMarcador(final);
  return NextResponse.json({ modo: repo.modo, marcador: final });
});
