import { NextResponse } from "next/server";
import { esEventoValido, getRepository } from "@/lib/server/repository";
import type { ApiListaRespuesta } from "@/types/americano";

export const dynamic = "force-dynamic";

/** GET /api/americanos → lista todos los eventos (más recientes primero). */
export async function GET() {
  const repo = getRepository();
  try {
    const eventos = await repo.listar();
    return NextResponse.json<ApiListaRespuesta>({ modo: repo.modo, eventos });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

/** POST /api/americanos  body: { evento } → crea o actualiza (upsert por id). */
export async function POST(req: Request) {
  const repo = getRepository();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const evento = (body as { evento?: unknown })?.evento;
  if (!esEventoValido(evento)) return NextResponse.json({ error: "Payload inválido: se espera { evento: EventoAmericano }" }, { status: 422 });
  try {
    const guardado = await repo.guardar(evento);
    return NextResponse.json({ modo: repo.modo, evento: guardado }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
