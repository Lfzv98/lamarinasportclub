import { NextResponse } from "next/server";
import { eliminarEvento, fusionarEventos } from "@/lib/evento";
import { calcularTabla } from "@/lib/scoring";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getRepository } from "@/lib/server/repository";
import { validarEvento } from "@/lib/validacion";
import type { EventoAmericano } from "@/types/americano";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function buscar(id: string) {
  const evento = await getRepository().obtener(id);
  if (!evento || evento.eliminado) throw new ErrorApi(404, "Evento no encontrado.");
  return evento;
}

/** GET /api/americanos/:id → { modo, evento, tabla } */
export const GET = manejar(async (_req: Request, { params }: Ctx) => {
  const evento = await buscar((await params).id);
  return NextResponse.json({ modo: getRepository().modo, evento, tabla: calcularTabla(evento) });
});

/** PUT /api/americanos/:id  body: { evento } (mismo comportamiento de fusión que POST) */
export const PUT = manejar(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = (await leerJson(req)) as { evento?: unknown } | null;
  const errores = validarEvento(body?.evento);
  if (errores.length) throw new ErrorApi(422, "Evento inválido.", errores);
  const entrante = body!.evento as EventoAmericano;
  if (entrante.id !== id) throw new ErrorApi(422, "El id del cuerpo no coincide con la URL.");
  const repo = getRepository();
  const existente = await repo.obtener(id);
  const final = existente ? fusionarEventos(existente, entrante) : entrante;
  await repo.guardar(final);
  return NextResponse.json({ modo: repo.modo, evento: final });
});

/** DELETE /api/americanos/:id → borrado lógico (eliminado: true), 204. */
export const DELETE = manejar(async (_req: Request, { params }: Ctx) => {
  const evento = await buscar((await params).id);
  await getRepository().guardar(eliminarEvento(evento));
  return new NextResponse(null, { status: 204 });
});
