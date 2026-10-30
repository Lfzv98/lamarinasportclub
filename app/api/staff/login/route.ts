import { NextResponse } from "next/server";
import {
  anotarAcceso,
  COOKIE,
  controlarIntentos,
  crearToken,
  dispositivoDe,
  ipDe,
  leerPolitica,
  limpiarIntentos,
  registrarFallo,
  verificarPadelReserve,
  verificarPin,
} from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/login
 *   { pin }               → PIN del club (si no está apagado en Ajustes → Seguridad)
 *   { email, password }   → usuario de PadelReserve con permiso de staff
 * Responde { staff: { nombre, metodo } } y deja la cookie de sesión (12 h). Cada intento queda en el registro de accesos.
 */
export const POST = manejar(async (req: Request) => {
  const ip = ipDe(req);
  controlarIntentos(ip);
  const body = (await leerJson(req)) as { pin?: unknown; email?: unknown; password?: unknown } | null;
  // Si la base no responde, rige la política por defecto: el staff no queda afuera en pleno evento.
  const politica = await leerPolitica(true).catch(() => ({ pinApagado: false, correos: [], version: 0, actualizadoEn: "" }));
  const base = { en: new Date().toISOString(), ip, dispositivo: dispositivoDe(req) };

  let sesion: Parameters<typeof crearToken>[0] | null = null;
  if (typeof body?.pin === "string" || typeof body?.pin === "number") {
    if (politica.pinApagado) {
      await anotarAcceso({ ...base, ok: false, metodo: "PIN", motivo: "PIN apagado" });
      throw new ErrorApi(403, "El PIN compartido está apagado. Entra con tu usuario de PadelReserve.");
    }
    if (verificarPin(String(body.pin))) sesion = { sub: "pin", nombre: "Staff La Marina", metodo: "PIN", v: politica.version };
  } else if (typeof body?.email === "string" && typeof body?.password === "string") {
    const correo = body.email.trim().toLowerCase();
    try {
      sesion = await verificarPadelReserve(correo, body.password, politica);
    } catch (e) {
      if (e instanceof ErrorApi) await anotarAcceso({ ...base, ok: false, metodo: "PADELRESERVE", correo, motivo: "Sin permiso de staff" });
      throw e;
    }
    if (!sesion) await anotarAcceso({ ...base, ok: false, metodo: "PADELRESERVE", correo, motivo: "Contraseña incorrecta" });
  } else {
    throw new ErrorApi(400, "Envía { pin } o { email, password }.");
  }

  if (!sesion) {
    if (typeof body?.pin !== "undefined") await anotarAcceso({ ...base, ok: false, metodo: "PIN", motivo: "PIN incorrecto" });
    registrarFallo(ip);
    throw new ErrorApi(401, "PIN o credenciales incorrectas.");
  }
  limpiarIntentos(ip);
  await anotarAcceso({ ...base, ok: true, metodo: sesion.metodo, nombre: sesion.nombre, correo: sesion.correo });
  const { token, maxAge } = crearToken(sesion);
  const res = NextResponse.json({ staff: { nombre: sesion.nombre, metodo: sesion.metodo } });
  res.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  return res;
});
