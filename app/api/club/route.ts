import { NextResponse } from "next/server";
import { normalizarClub } from "@/lib/horarios";
import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getRepository } from "@/lib/server/repository";
import { validarClub } from "@/lib/validacion";
import type { ConfigClub } from "@/types/americano";

export const dynamic = "force-dynamic";

/** GET /api/club → { modo, club } */
export const GET = manejar(async () => {
  const repo = getRepository();
  return NextResponse.json({ modo: repo.modo, club: normalizarClub(await repo.obtenerClub()) });
});

/** POST /api/club  body: { club } → guarda si es más reciente que lo guardado. */
export const POST = manejar(async (req: Request) => {
  exigirStaff(req);
  const body = (await leerJson(req)) as { club?: unknown } | null;
  const errores = validarClub(body?.club);
  if (errores.length) throw new ErrorApi(422, "Configuración inválida.", errores);
  const repo = getRepository();
  const entrante = normalizarClub(body!.club as ConfigClub);
  const actual = await repo.obtenerClub();
  const final = actual.actualizadoEn > entrante.actualizadoEn ? actual : await repo.guardarClub(entrante);
  return NextResponse.json({ modo: repo.modo, club: final });
});
