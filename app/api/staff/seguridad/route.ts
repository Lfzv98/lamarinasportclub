import { NextResponse } from "next/server";
import {
  COOKIE,
  crearToken,
  exigirStaff,
  guardarPolitica,
  leerAccesosStaff,
  leerPolitica,
  padelReserveActivo,
  pinConfigurado,
  type PoliticaStaff,
} from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CORREOS = 50;

/** GET /api/staff/seguridad (staff) → política, registro de accesos y qué puede cambiar esta sesión. */
export const GET = manejar(async (req: Request) => {
  const s = await exigirStaff(req);
  const [politica, accesos] = await Promise.all([leerPolitica(true), leerAccesosStaff()]);
  return NextResponse.json({
    politica: { pinApagado: politica.pinApagado, correos: politica.correos, actualizadoEn: politica.actualizadoEn, por: politica.por },
    accesos: accesos.slice(0, 60),
    padelreserve: padelReserveActivo(),
    pinConfigurado: !!pinConfigurado(),
    yo: { nombre: s.nombre, metodo: s.metodo, correo: s.correo ?? null },
    // Con el PIN compartido no se cambia la seguridad: alguien que solo sabe el PIN no puede apagar ni abrir accesos.
    puedeCambiar: s.metodo === "PADELRESERVE",
  });
});

/**
 * POST /api/staff/seguridad (solo usuario de PadelReserve)
 *   { accion: "pin", apagado }        → apaga o enciende el PIN compartido
 *   { accion: "correos", correos[] }  → correos de PadelReserve con permiso de staff
 *   { accion: "cerrarTodo" }          → cierra la sesión en todos los dispositivos menos este
 */
export const POST = manejar(async (req: Request) => {
  const s = await exigirStaff(req);
  if (s.metodo !== "PADELRESERVE") throw new ErrorApi(403, "Para cambiar la seguridad entra con tu usuario de PadelReserve, no con el PIN.");
  const b = (await leerJson(req)) as { accion?: unknown; apagado?: unknown; correos?: unknown } | null;
  const actual = await leerPolitica(true);
  const base = { ...actual, actualizadoEn: new Date().toISOString(), por: s.nombre };
  let nueva: PoliticaStaff;

  if (b?.accion === "pin" && typeof b.apagado === "boolean") {
    if (b.apagado && !padelReserveActivo()) throw new ErrorApi(409, "No se puede apagar el PIN sin el ingreso con PadelReserve configurado.");
    nueva = { ...base, pinApagado: b.apagado };
  } else if (b?.accion === "correos" && Array.isArray(b.correos)) {
    const correos = [...new Set(b.correos.filter((c): c is string => typeof c === "string").map((c) => c.trim().toLowerCase()).filter(Boolean))];
    if (correos.length > MAX_CORREOS) throw new ErrorApi(422, `Máximo ${MAX_CORREOS} correos.`);
    const malo = correos.find((c) => !CORREO.test(c) || c.length > 120);
    if (malo) throw new ErrorApi(422, `Correo no válido: ${malo}`);
    if (s.porLista && s.correo && !correos.includes(s.correo)) throw new ErrorApi(409, "No puedes quitar tu propio correo: te quedarías sin acceso.");
    nueva = { ...base, correos };
  } else if (b?.accion === "cerrarTodo") {
    nueva = { ...base, version: actual.version + 1 };
  } else {
    throw new ErrorApi(400, 'Envía { accion: "pin" | "correos" | "cerrarTodo" }.');
  }

  await guardarPolitica(nueva);
  const res = NextResponse.json({ politica: { pinApagado: nueva.pinApagado, correos: nueva.correos, actualizadoEn: nueva.actualizadoEn, por: nueva.por } });
  if (nueva.version !== actual.version) {
    // Quien cierra todo sigue adentro en este dispositivo.
    const { exp: _exp, ...resto } = s;
    const { token, maxAge } = crearToken({ ...resto, v: nueva.version });
    res.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  }
  return res;
});
