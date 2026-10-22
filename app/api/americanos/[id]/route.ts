import { NextResponse } from "next/server";
import { calcularTabla } from "@/lib/scoring";
import { esEventoValido, getRepository } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/americanos/:id → { evento, tabla } */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const repo = getRepository();
  const evento = await repo.obtener(id);
  if (!evento) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  return NextResponse.json({ modo: repo.modo, evento, tabla: calcularTabla(evento) });
}

/** PUT /api/americanos/:id  body: { evento } */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { evento?: unknown } | null;
  if (!esEventoValido(body?.evento) || body.evento.id !== id) return NextResponse.json({ error: "Payload inválido" }, { status: 422 });
  const repo = getRepository();
  return NextResponse.json({ modo: repo.modo, evento: await repo.guardar(body.evento) });
}

/** DELETE /api/americanos/:id */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await getRepository().eliminar(id);
  return new NextResponse(null, { status: 204 });
}
