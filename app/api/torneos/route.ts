import { NextResponse } from "next/server";
import { revisarFvpServidor } from "@/lib/ranking/fvp";
import { exigirStaff } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { buscadorVigente } from "@/lib/server/rankingFvp";
import { actualizarTorneo, paraVisor, puedeVer, visorDe } from "@/lib/server/torneos";
import { despues, fusionarTorneos } from "@/lib/torneo/torneo";
import { validarTorneo } from "@/lib/torneo/validacion";
import type { ApiTorneosRespuesta, Torneo } from "@/types/torneo";

export const dynamic = "force-dynamic";

/**
 * GET /api/torneos → { modo, torneos }. `?todos=1` incluye los eliminados.
 * El staff recibe todo; los participantes, según la clave del torneo (ver lib/server/torneos.ts).
 */
/**
 * GET /api/torneos[?todos=1][&v=id~versión,…]
 * Con `v` (las versiones que el cliente ya tiene), solo viajan los torneos que cambiaron: con un Open de
 * 450 duplas abierto en cientos de celulares, cada sincronización pesa unos bytes en vez de ~1 MB.
 * La versión incluye cómo lo ve este visor (staff / con acceso / bloqueado): si eso cambia, se reenvía.
 */
export const GET = manejar(async (req: Request) => {
  const repo = getTorneosRepository();
  const v = await visorDe(req);
  const q = new URL(req.url).searchParams;
  const todos = q.get("todos") === "1";
  const indice = (await repo.indice()).filter((i) => todos || !i.eliminado);
  const versionDe = (i: (typeof indice)[number]) => `${Date.parse(i.actualizadoEn)}${v.staff ? "s" : puedeVer(i as unknown as Torneo, v) ? "v" : "b"}`;
  const versiones = Object.fromEntries(indice.map((i) => [i.id, versionDe(i)]));
  const conocidas = new Map(
    (q.get("v") ?? "")
      .split(",")
      .filter(Boolean)
      .map((x) => x.split("~") as [string, string]),
  );
  const pedir = indice.filter((i) => conocidas.get(i.id) !== versiones[i.id]).map((i) => i.id);
  const torneos = (pedir.length ? await repo.obtenerVarios(pedir) : []).map((t) => paraVisor(t, v));
  return NextResponse.json<ApiTorneosRespuesta>({ modo: repo.modo, torneos, versiones });
});

/**
 * POST /api/torneos body: { torneo } → upsert con fusión por partido (staff).
 * Las duplas nuevas o cambiadas se vuelven a chequear con el ranking FVP (ver lib/ranking/fvp.ts).
 */
export const POST = manejar(async (req: Request) => {
  const sesion = await exigirStaff(req);
  const body = (await leerJson(req)) as { torneo?: unknown } | null;
  const errores = validarTorneo(body?.torneo);
  if (errores.length) throw new ErrorApi(422, "Torneo inválido.", errores);
  const entrante = body!.torneo as Torneo;
  const { bloqueado: _b, ...limpio } = entrante;
  const repo = getTorneosRepository();
  const fvp = await buscadorVigente();
  const preparar = (existente: Torneo | null): Torneo => {
    const fusionado = existente ? fusionarTorneos(existente, limpio) : limpio;
    const revisado = revisarFvpServidor(existente, fusionado, fvp?.buscar ?? null, { lista: fvp?.lista, staff: sesion.nombre });
    // Si el servidor corrigió algo, la versión sube para que el cliente la adopte al fusionar.
    return revisado.cambios ? { ...revisado.torneo, actualizadoEn: despues(fusionado.actualizadoEn) } : fusionado;
  };
  const existente = await repo.obtener(limpio.id);
  if (!existente) {
    const nuevo = preparar(null);
    await repo.guardar(nuevo);
    return NextResponse.json({ modo: repo.modo, torneo: nuevo }, { status: 201 });
  }
  // Fusión sobre la versión vigente: si una tablet cerró un partido mientras tanto, no se pierde.
  const { despues: final } = await actualizarTorneo(repo, limpio.id, preparar);
  return NextResponse.json({ modo: repo.modo, torneo: final }, { status: 200 });
});
