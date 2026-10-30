import { NextResponse } from "next/server";
import { leerPolitica, padelReserveActivo, pinConfigurado, sesionDe } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/staff/me → { staff: { nombre, metodo } | null, metodos } */
export async function GET(req: Request) {
  const s = await sesionDe(req);
  const pinApagado = await leerPolitica()
    .then((p) => p.pinApagado)
    .catch(() => false);
  return NextResponse.json({
    staff: s ? { nombre: s.nombre, metodo: s.metodo } : null,
    metodos: { pin: !!pinConfigurado() && !pinApagado, pinLargo: pinConfigurado()?.length ?? 4, padelreserve: padelReserveActivo() },
  });
}
