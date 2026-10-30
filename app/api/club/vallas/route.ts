import { NextResponse } from "next/server";
import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/**
 * Imágenes de las vallas publicitarias del Modo TV de americanos. Se guardan aparte de la
 * configuración del club (que se sincroniza seguido) y se sirven por URL versionada.
 */
const MAX_IMG = 600_000;
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const idValla = (id: string) => `valla:club:${id}`;

/** POST /api/club/vallas { id, img: "data:image/…;base64,…" } → { url } (solo staff). */
export const POST = manejar(async (req: Request) => {
  const staff = await exigirStaff(req);
  const b = (await leerJson(req, 800_000)) as { id?: unknown; img?: unknown } | null;
  if (typeof b?.id !== "string" || !ID.test(b.id) || typeof b.img !== "string") throw new ErrorApi(400, "Envía { id, img }.");
  if (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(b.img)) throw new ErrorApi(422, "La imagen debe ser JPEG, WebP o PNG.");
  if (b.img.length > MAX_IMG) throw new ErrorApi(413, "La imagen pesa demasiado.");
  const x = await getTorneosRepository().guardarExtra({ id: idValla(b.id), torneoId: "club", tipo: "valla", data: { img: b.img, por: staff.nombre }, actualizadoEn: new Date().toISOString() });
  return NextResponse.json({ url: `/api/club/vallas/${encodeURIComponent(b.id)}?v=${encodeURIComponent(x.actualizadoEn)}` }, { status: 201 });
});

/** DELETE /api/club/vallas?id= (solo staff). */
export const DELETE = manejar(async (req: Request) => {
  await exigirStaff(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !ID.test(id)) throw new ErrorApi(400, "Falta id.");
  await getTorneosRepository().borrarExtra(idValla(id));
  return NextResponse.json({ ok: true });
});

