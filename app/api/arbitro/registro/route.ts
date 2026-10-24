import { NextResponse } from "next/server";
import { claveCorrecta, controlarIntentos, hashCodigo, ipDe, limpiarIntentos, registrarFallo } from "@/lib/server/auth";
import { conSesion, guardarRegistro, leerRegistro, sesionPublica, torneoConArbitros, type ArbitroGuardado } from "@/lib/server/arbitros";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const limpiar = (s: unknown, max: number) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, max) : "");
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * POST /api/arbitro/registro  { torneoId, pin, nombre, apellido, telefono, codigo }
 * Registro del árbitro con el PIN que da el staff y un código personal de 4 dígitos.
 * Si ya estaba registrado con ese teléfono, actualiza su código (así recupera el acceso).
 */
export const POST = manejar(async (req: Request) => {
  const ip = ipDe(req);
  controlarIntentos(ip);
  const b = (await leerJson(req)) as Record<string, unknown> | null;
  const t = await torneoConArbitros(b?.torneoId);
  const nombre = limpiar(b?.nombre, 30);
  const apellido = limpiar(b?.apellido, 30);
  const telefono = limpiar(b?.telefono, 20).replace(/[^\d+]/g, "");
  const codigo = limpiar(b?.codigo, 4);
  if (typeof b?.pin !== "string" || !claveCorrecta(b.pin, t.arbitros!.pin)) {
    registrarFallo(ip);
    throw new ErrorApi(401, "PIN del torneo incorrecto. Pídelo al staff.");
  }
  if (nombre.length < 2 || apellido.length < 2) throw new ErrorApi(422, "Escribe tu nombre y tu apellido.");
  if (telefono.replace(/\D/g, "").length < 7) throw new ErrorApi(422, "Escribe tu teléfono: es para que el staff te ubique.");
  if (!/^\d{4}$/.test(codigo)) throw new ErrorApi(422, "Tu código personal son 4 números.");
  limpiarIntentos(ip);

  const lista = await leerRegistro(t.id);
  const tel = telefono.replace(/\D/g, "").slice(-10);
  const ahora = new Date().toISOString();
  let a = lista.find((x) => x.telefono && x.telefono.replace(/\D/g, "").slice(-10) === tel);
  if (!a && lista.some((x) => sinAcentos(`${x.nombre} ${x.apellido}`) === sinAcentos(`${nombre} ${apellido}`)))
    throw new ErrorApi(409, "Ya hay un árbitro con ese nombre y otro teléfono. Si eres tú, usa el mismo teléfono con el que te registraste.");
  if (lista.length >= 60 && !a) throw new ErrorApi(422, "Este torneo ya tiene 60 árbitros registrados.");
  if (a) {
    a = { ...a, nombre, apellido, telefono, actualizadoEn: ahora };
    a.codigoHash = hashCodigo(t.id, a.id, codigo);
    const i = lista.findIndex((x) => x.id === a!.id);
    lista[i] = a;
  } else {
    const id = `arb-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
    a = { id, nombre, apellido, telefono, activo: true, registradoEn: ahora, actualizadoEn: ahora, codigoHash: hashCodigo(t.id, id, codigo) } satisfies ArbitroGuardado;
    lista.push(a);
  }
  if (!a.activo) throw new ErrorApi(403, "Tu acceso está pausado. Habla con el staff.");
  await guardarRegistro(t.id, lista);
  return conSesion(NextResponse.json({ arbitro: sesionPublica(t, a) }, { status: 201 }), t, a);
});
