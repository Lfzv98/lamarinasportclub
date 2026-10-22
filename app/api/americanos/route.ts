import { NextResponse } from "next/server";
import { fusionarEventos } from "@/lib/evento";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getRepository } from "@/lib/server/repository";
import { validarEvento } from "@/lib/validacion";
import type { ApiListaRespuesta, EventoAmericano } from "@/types/americano";

export const dynamic = "force-dynamic";

/**
 * GET /api/americanos → { modo, eventos } (más recientes primero).
 * Por defecto excluye los eliminados; `?todos=1` los incluye (lo usa la app
 * para propagar borrados entre dispositivos).
 */
export const GET = manejar(async (req: Request) => {
  const repo = getRepository();
  const todos = new URL(req.url).searchParams.get("todos") === "1";
  const eventos = (await repo.listar()).filter((e) => todos || !e.eliminado);
  return NextResponse.json<ApiListaRespuesta>({ modo: repo.modo, eventos });
});

/**
 * POST /api/americanos  body: { evento } → upsert por id.
 * Si ya existe, fusiona con la versión guardada (marcador más reciente por
 * partido) para que dos dispositivos no se pisen. 201 si es nuevo, 200 si actualiza.
 */
export const POST = manejar(async (req: Request) => {
  const body = (await leerJson(req)) as { evento?: unknown } | null;
  const errores = validarEvento(body?.evento);
  if (errores.length) throw new ErrorApi(422, "Evento inválido.", errores);
  const entrante = body!.evento as EventoAmericano;

  const repo = getRepository();
  const existente = await repo.obtener(entrante.id);
  const final = existente ? fusionarEventos(existente, entrante) : entrante;
  await repo.guardar(final);
  return NextResponse.json({ modo: repo.modo, evento: final }, { status: existente ? 200 : 201 });
});
