import { NextResponse } from "next/server";
import { sesionDe } from "@/lib/server/auth";
import { borrarDemo, cargarDemo } from "@/lib/server/demo";
import { crearAmericanoPrueba, crearTorneoPrueba } from "@/lib/server/demoRapido";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo (staff) → datos de prueba para enseñar la app.
 * { accion: "cargar" | "borrar" }: el paquete completo. { accion: "torneo" | "americano" }: uno listo para jugar, devuelve su id.
 */
export const POST = manejar(async (req: Request) => {
  if (!(await sesionDe(req))) throw new ErrorApi(401, "Solo el staff.");
  const b = (await leerJson(req)) as { accion?: unknown } | null;
  if (b?.accion === "cargar") return NextResponse.json({ ok: true, ...(await cargarDemo()) });
  if (b?.accion === "torneo") return NextResponse.json({ ok: true, id: (await crearTorneoPrueba()).id });
  if (b?.accion === "americano") return NextResponse.json({ ok: true, id: (await crearAmericanoPrueba()).id });
  if (b?.accion === "borrar") {
    await borrarDemo();
    return NextResponse.json({ ok: true });
  }
  throw new ErrorApi(400, 'Envía { accion: "cargar" | "borrar" | "torneo" | "americano" }.');
});
