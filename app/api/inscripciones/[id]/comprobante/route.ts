import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, manejar } from "@/lib/server/http";
import { leerComprobante } from "@/lib/server/inscripciones";

export const dynamic = "force-dynamic";

/** GET /api/inscripciones/:torneoId/comprobante?i=<inscripcionId> → la foto del comprobante (staff). */
export const GET = manejar(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await exigirStaff(req);
  const { id } = await ctx.params;
  const i = new URL(req.url).searchParams.get("i");
  if (!i) throw new ErrorApi(400, "Falta la inscripción.");
  const m = (await leerComprobante(id, i))?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new ErrorApi(404, "Sin comprobante.");
  return new Response(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600" } });
});
