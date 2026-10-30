import { NextResponse } from "next/server";
import { sesionDe } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { getTorneosRepository } from "@/lib/server/repository";
import { arbitroValido, nombreArbitro } from "@/lib/server/arbitros";
import { paraVisor, visorDe } from "@/lib/server/torneos";
import { limiteWO } from "@/lib/torneo/programacion";
import { validarResultadoTorneo } from "@/lib/torneo/tabla";
import { partido, reglasDe } from "@/lib/torneo/torneo";
import { aplicarAccion, type AccionPartido, type RolPartido } from "@/lib/torneo/arbitraje";
import type { ResultadoTorneo, Torneo } from "@/types/torneo";

export const dynamic = "force-dynamic";

const TIPOS = ["NORMAL", "RETIRO", "DESCALIFICACION"];

/**
 * POST /api/torneos/:id/partidos/:pid  { accion, … }
 *
 * Lo que hace el árbitro con un partido, aplicado en el servidor sobre la versión vigente del
 * torneo (así no pisa nada de lo que el staff cambió en paralelo). Lo pueden usar el staff y los
 * árbitros del torneo. El árbitro de pista no corrige un resultado ya cargado y solo da W.O. cuando
 * venció la tolerancia. La mesa técnica (árbitro principal o staff) revisa y corrige con motivo.
 */
export const POST = manejar(async (req: Request, ctx: { params: Promise<{ id: string; pid: string }> }) => {
  const { id, pid } = await ctx.params;
  const repo = getTorneosRepository();
  const t = await repo.obtener(id);
  if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
  const v = await visorDe(req);
  const staff = await sesionDe(req);
  const arbitro = staff ? null : await arbitroValido(t, v.arbitro);
  if (!staff && !arbitro) throw new ErrorApi(401, "Solo el staff o los árbitros de este torneo pueden anotar.");
  const p = partido(t, pid);
  if (!p || p.bye) throw new ErrorApi(404, "Partido no encontrado.");
  const body = (await leerJson(req)) as Partial<AccionPartido> | null;
  const rol: RolPartido = staff || arbitro?.principal ? "MESA" : "PISTA";
  const por = staff ? staff.nombre : `${arbitro!.principal ? "Árbitro principal" : "Árbitro"} ${nombreArbitro(arbitro!)}`;
  const pistaValida = (n: unknown) => typeof n === "number" && t.canchas.some((c) => c.numero === n && c.activa);

  const resultadoValido = (r: unknown): ResultadoTorneo => {
    const x = r as ResultadoTorneo | undefined;
    if (!x || !Array.isArray(x.sets) || !x.sets.length || x.sets.length > 3 || (x.ganador !== "A" && x.ganador !== "B") || !TIPOS.includes(x.tipo))
      throw new ErrorApi(422, "Resultado inválido.");
    if (x.sets.some((s) => !Number.isInteger(s?.a) || !Number.isInteger(s?.b) || s.a < 0 || s.b < 0 || s.a > 99 || s.b > 99)) throw new ErrorApi(422, "Resultado inválido.");
    if (x.tipo === "NORMAL") {
      const error = validarResultadoTorneo(reglasDe(t, p), x.sets);
      if (error) throw new ErrorApi(422, error);
    }
    return { sets: x.sets.map((s) => ({ a: s.a, b: s.b })), ganador: x.ganador, tipo: x.tipo };
  };
  let accion: AccionPartido;

  switch (body?.accion) {
    case "llamar": {
      if (p.estado !== "PENDIENTE" || !p.duplaA || !p.duplaB) throw new ErrorApi(409, "Este partido no se puede llamar ahora.");
      if (!pistaValida(body.pista)) throw new ErrorApi(400, "Pista inválida.");
      accion = { accion: "llamar", pista: body.pista! };
      break;
    }
    case "iniciar": {
      if (p.estado === "FINALIZADO") throw new ErrorApi(409, "El partido ya terminó.");
      if (!p.duplaA || !p.duplaB) throw new ErrorApi(409, "Todavía no se conocen las dos duplas.");
      if (body.pista != null && !pistaValida(body.pista)) throw new ErrorApi(400, "Pista inválida.");
      accion = { accion: "iniciar", pista: body.pista ?? null };
      break;
    }
    case "resultado": {
      if (p.estado === "FINALIZADO")
        throw new ErrorApi(rol === "MESA" ? 409 : 403, rol === "MESA" ? "El partido ya tiene resultado: usa Corregir." : "El resultado ya está cargado. Para corregirlo, avisa a mesa técnica.");
      accion = { accion: "resultado", resultado: resultadoValido(body.resultado) };
      break;
    }
    case "wo": {
      if (body.ganador !== "A" && body.ganador !== "B") throw new ErrorApi(400, "Indica quién gana por W.O.");
      if (p.estado === "FINALIZADO") throw new ErrorApi(409, "El partido ya terminó.");
      if (rol === "PISTA") {
        const limite = p.estado === "LLAMADO" ? limiteWO(t, p) : null;
        if (limite === null || limite > Date.now()) throw new ErrorApi(403, "Todavía corre la tolerancia: el W.O. se puede dar cuando se cumpla.");
      }
      accion = { accion: "wo", ganador: body.ganador };
      break;
    }
    case "revisar": {
      if (rol !== "MESA") throw new ErrorApi(403, "Solo mesa técnica revisa resultados.");
      if (p.estado !== "FINALIZADO") throw new ErrorApi(409, "El partido todavía no terminó.");
      accion = { accion: "revisar" };
      break;
    }
    case "corregir": {
      if (rol !== "MESA") throw new ErrorApi(403, "Solo mesa técnica corrige resultados.");
      if (p.estado !== "FINALIZADO") throw new ErrorApi(409, "El partido todavía no terminó.");
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
      if (motivo.length < 3) throw new ErrorApi(422, "Escribe el motivo de la corrección.");
      accion = { accion: "corregir", resultado: resultadoValido(body.resultado), motivo: motivo.slice(0, 200) };
      break;
    }
    default:
      throw new ErrorApi(400, "Acción desconocida.");
  }

  const final: Torneo = aplicarAccion(t, pid, accion, por, rol);
  await repo.guardar(final);
  return NextResponse.json({ modo: repo.modo, torneo: paraVisor(final, v) });
});
