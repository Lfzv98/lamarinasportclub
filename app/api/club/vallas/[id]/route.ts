import { ErrorApi, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/** GET /api/club/vallas/:id?v= → la imagen de la valla (pública: sale en la TV). */
export const GET = manejar(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const x = await getTorneosRepository().obtenerExtra(`valla:club:${decodeURIComponent(id)}`);
  const m = (x?.data as { img?: string } | undefined)?.img?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new ErrorApi(404, "Sin imagen.");
  return new Response(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" } });
});
