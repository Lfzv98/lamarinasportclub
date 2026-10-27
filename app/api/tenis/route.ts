import { NextResponse } from "next/server";
import { arbitroDe, sesionDe } from "@/lib/server/auth";
import { sesionValida } from "@/lib/server/arbitros";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";
import { guardarPartidosTenis, guardarTenis, listarTenis, validarTenis } from "@/lib/server/tenis";
import type { ApiTenisRespuesta, TorneoTenis } from "@/types/tenis";

export const dynamic = "force-dynamic";

/** GET /api/tenis → { modo, torneos }: los torneos de tenis son públicos (cuadro, marcadores y TV). */
export const GET = manejar(async () => {
  if (!TENIS_ACTIVO) throw new ErrorApi(404, "Tenis no está activo en este club.");
  const torneos = await listarTenis();
  return NextResponse.json<ApiTenisRespuesta>({ modo: getTorneosRepository().modo, torneos });
});

/**
 * POST /api/tenis { torneo } → guarda con fusión por partido.
 * El staff crea y cambia todo; un árbitro del club solo puede anotar y mover partidos.
 */
export const POST = manejar(async (req: Request) => {
  if (!TENIS_ACTIVO) throw new ErrorApi(404, "Tenis no está activo en este club.");
  const staff = sesionDe(req);
  const arbitro = staff ? null : await sesionValida(arbitroDe(req));
  if (!staff && !arbitro) throw new ErrorApi(401, "Solo el staff o los árbitros del club.");
  const body = (await leerJson(req)) as { torneo?: unknown } | null;
  const errores = validarTenis(body?.torneo);
  if (errores.length) throw new ErrorApi(422, "Torneo inválido.", errores);
  const t = body!.torneo as TorneoTenis;
  if (staff) return NextResponse.json({ torneo: await guardarTenis(t) });
  const final = await guardarPartidosTenis(t);
  if (!final) throw new ErrorApi(404, "Ese torneo de tenis no existe.");
  return NextResponse.json({ torneo: final });
});
