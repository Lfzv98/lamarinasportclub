import { NextResponse } from "next/server";
import { arbitroDe, codigoCorrecto, controlarIntentos, COOKIE_ARBITRO, ipDe, limpiarIntentos, registrarFallo } from "@/lib/server/auth";
import { arbitroValido, conSesion, leerRegistro, opcionesCookie, sesionPublica, torneoConArbitros } from "@/lib/server/arbitros";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/** GET /api/arbitro → { arbitro: { torneoId, id, nombre } | null } de este dispositivo. */
export const GET = manejar(async (req: Request) => {
  const s = arbitroDe(req);
  const t = s ? await getTorneosRepository().obtener(s.torneoId) : null;
  const a = t ? await arbitroValido(t, s) : null;
  return NextResponse.json({ arbitro: t && a ? sesionPublica(t, a) : null });
});

/**
 * POST /api/arbitro  { torneoId, arbitroId, codigo } → entra un árbitro ya registrado
 * con su código personal de 4 dígitos.
 */
export const POST = manejar(async (req: Request) => {
  const ip = ipDe(req);
  controlarIntentos(ip);
  const body = (await leerJson(req)) as { torneoId?: unknown; arbitroId?: unknown; codigo?: unknown } | null;
  if (typeof body?.arbitroId !== "string" || typeof body?.codigo !== "string") throw new ErrorApi(400, "Envía { torneoId, arbitroId, codigo }.");
  const t = await torneoConArbitros(body.torneoId);
  const a = (await leerRegistro(t.id)).find((x) => x.id === body.arbitroId);
  if (!a) throw new ErrorApi(404, "No encontramos tu registro. Regístrate de nuevo.");
  if (!a.activo) throw new ErrorApi(403, "Tu acceso está pausado. Habla con el staff.");
  if (!codigoCorrecto(t.id, a.id, body.codigo, a.codigoHash)) {
    registrarFallo(ip);
    throw new ErrorApi(401, "Código incorrecto.");
  }
  limpiarIntentos(ip);
  return conSesion(NextResponse.json({ arbitro: sesionPublica(t, a) }), t, a);
});

/** DELETE /api/arbitro → cierra la sesión de árbitro de este dispositivo. */
export const DELETE = manejar(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ARBITRO, "", opcionesCookie(0));
  return res;
});
