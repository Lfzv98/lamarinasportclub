import { NextResponse } from "next/server";
import { arbitroDe, claveCorrecta, controlarIntentos, COOKIE_ARBITRO, crearTokenArbitro, huellaClave, ipDe, limpiarIntentos, registrarFallo } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { esArbitroDe } from "@/lib/server/torneos";

export const dynamic = "force-dynamic";

/** GET /api/arbitro → { arbitro: { torneoId, nombre } | null } de este dispositivo. */
export const GET = manejar(async (req: Request) => {
  const a = arbitroDe(req);
  const t = a ? await getTorneosRepository().obtener(a.torneoId) : null;
  return NextResponse.json({ arbitro: a && t && esArbitroDe(t, a) ? { torneoId: a.torneoId, nombre: a.nombre } : null });
});

/**
 * POST /api/arbitro  { torneoId, pin, nombre } → entra como árbitro de ese torneo.
 * El PIN lo crea el staff en Ajustes → Claves de torneos y vence al terminar el torneo.
 */
export const POST = manejar(async (req: Request) => {
  const ip = ipDe(req);
  controlarIntentos(ip);
  const body = (await leerJson(req)) as { torneoId?: unknown; pin?: unknown; nombre?: unknown } | null;
  if (typeof body?.torneoId !== "string" || typeof body?.pin !== "string" || typeof body?.nombre !== "string") throw new ErrorApi(400, "Envía { torneoId, pin, nombre }.");
  const nombre = body.nombre.trim().replace(/\s+/g, " ").slice(0, 40);
  if (nombre.length < 2) throw new ErrorApi(400, "Escribe tu nombre: queda en cada partido que anotes.");
  const t = await getTorneosRepository().obtener(body.torneoId);
  if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
  if (!t.arbitros?.pin) throw new ErrorApi(403, "Este torneo no tiene PIN de árbitros. Pídelo al staff.");
  const vence = new Date(t.arbitros.vence).getTime();
  if (!(vence > Date.now())) throw new ErrorApi(410, "El PIN de árbitros de este torneo ya venció.");
  if (!claveCorrecta(body.pin, t.arbitros.pin)) {
    registrarFallo(ip);
    throw new ErrorApi(401, "PIN incorrecto.");
  }
  limpiarIntentos(ip);
  const { token, maxAge } = crearTokenArbitro({ torneoId: t.id, nombre, huella: huellaClave(t.arbitros.pin) }, vence);
  const res = NextResponse.json({ arbitro: { torneoId: t.id, nombre } });
  res.cookies.set(COOKIE_ARBITRO, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  return res;
});

/** DELETE /api/arbitro → cierra la sesión de árbitro de este dispositivo. */
export const DELETE = manejar(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ARBITRO, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
});
