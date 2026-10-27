import { NextResponse } from "next/server";
import {
  aperturaInscripcion,
  confirmarEnTorneo,
  crearInscripcion,
  cuposCategorias,
  MAX_COMPROBANTE,
  MAX_INSCRIPCIONES_TORNEO,
  nombreInscrito,
  validarInscripcion,
  type EntradaInscripcion,
} from "@/lib/inscripcion";
import { claveCedula, etiquetaNivel, puedeJugar, verificarDupla } from "@/lib/ranking/fvp";
import { exigirStaff, sesionDe } from "@/lib/server/auth";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import { frenar, guardarComprobante, guardarInscripcion, listarInscripciones, obtenerInscripcion } from "@/lib/server/inscripciones";
import { getTorneosRepository } from "@/lib/server/repository";
import { buscadorVigente } from "@/lib/server/rankingFvp";
import { nombreCategoria } from "@/lib/torneo/categorias";
import { categoria, despues, dupla, editarDupla, jugador } from "@/lib/torneo/torneo";
import type { ApiInscripcionPublica, EstadoInscripcion, Inscripcion } from "@/types/inscripcion";
import type { JugadorTorneo, Torneo } from "@/types/torneo";

export const dynamic = "force-dynamic";

async function torneoDe(id: string): Promise<Torneo> {
  const t = await getTorneosRepository().obtener(id);
  if (!t || t.eliminado) throw new ErrorApi(404, "Torneo no encontrado.");
  return t;
}

/**
 * GET /api/inscripciones/:torneoId → ApiInscripcionPublica (datos del torneo, configuración y cupos).
 *   El staff además recibe `inscripciones`.
 *   ?codigo=LM-XXXX → { estado, categoria, dupla } para que la dupla consulte cómo va.
 *   ?cedula=V-123&categoriaId=M-4TA → lo que dice el ranking FVP de esa cédula.
 */
export const GET = manejar(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const t = await torneoDe(id);
  const q = new URL(req.url).searchParams;
  const staff = !!sesionDe(req);

  const codigo = q.get("codigo")?.trim().toUpperCase();
  if (codigo) {
    const i = (await listarInscripciones(t.id)).find((x) => x.codigo === codigo);
    if (!i) throw new ErrorApi(404, "No encontramos ese código. Revísalo o escríbenos por WhatsApp.");
    const c = categoria(t, i.categoriaId)?.categoria;
    return NextResponse.json({
      codigo: i.codigo,
      estado: i.estado,
      categoria: c ? nombreCategoria(c) : i.categoriaId,
      dupla: i.jugadores.map((j) => `${j.nombre} ${j.apellido.slice(0, 1)}.`).join(" / "),
      nota: i.estado === "RECHAZADA" ? i.nota : undefined,
      creadaEn: i.creadaEn,
    });
  }

  const cedula = q.get("cedula");
  if (cedula != null) {
    if (!claveCedula(cedula)) return NextResponse.json({ valida: false });
    const fvp = await buscadorVigente();
    const a = fvp?.buscar(cedula) ?? null;
    const c = categoria(t, q.get("categoriaId") ?? "")?.categoria;
    const puede = !a?.categoria || !c || c.tipo !== "NIVEL" || !c.nivel ? true : puedeJugar(c.nivel, a.categoria);
    return NextResponse.json({
      valida: true,
      lista: !!fvp,
      encontrado: !!a,
      // Solo el primer nombre: alcanza para que el jugador se reconozca.
      nombre: a?.nombre.split(" ")[0] ?? null,
      categoria: a?.categoria ? etiquetaNivel(a.categoria) : null,
      puntos: a?.puntos ?? null,
      puede,
    });
  }

  const inscripciones = await listarInscripciones(t.id);
  const ap = aperturaInscripcion(t);
  const body: ApiInscripcionPublica = {
    torneo: {
      id: t.id,
      nombre: t.nombre,
      dias: t.dias,
      sede: t.sedes?.find((s) => !s.provisional)?.nombre ?? "La Marina Sport Club",
      estado: t.estado,
      patrocinadores: (t.patrocinadores ?? []).map(({ id, nombre, logo, principal }) => ({ id, nombre, logo, principal })),
    },
    config: t.inscripcion ?? null,
    abierta: ap.abierta,
    motivoCerrada: ap.motivo,
    categorias: cuposCategorias(t, inscripciones),
    ...(staff ? { inscripciones } : {}),
  };
  return NextResponse.json(body);
});

/**
 * POST /api/inscripciones/:torneoId (público)
 *   { categoriaId, jugadores: [j1, j2], aceptaReglamento, pago?: { metodoId, referencia }, comprobante?: dataURL }
 *   → 201 { id, codigo, estado }  ·  422 { error, detalles } con lo que falta.
 */
export const POST = manejar(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  frenar(req);
  const b = (await leerJson(req, 700_000)) as (Omit<EntradaInscripcion, "comprobante"> & { comprobante?: unknown; web?: unknown }) | null;
  if (!b || typeof b !== "object") throw new ErrorApi(400, "Envía los datos de la inscripción.");
  // Campo trampa: las personas no lo ven; los robots lo llenan.
  if (typeof b.web === "string" && b.web) throw new ErrorApi(422, "No se pudo enviar la inscripción.");
  const comprobante = typeof b.comprobante === "string" && b.comprobante ? b.comprobante : null;
  if (comprobante) {
    if (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(comprobante)) throw new ErrorApi(422, "El comprobante debe ser una foto (JPG o PNG).");
    if (comprobante.length > MAX_COMPROBANTE) throw new ErrorApi(413, "La foto del comprobante pesa demasiado.");
  }
  const t = await torneoDe(id);
  const previas = await listarInscripciones(t.id);
  if (previas.length >= MAX_INSCRIPCIONES_TORNEO) throw new ErrorApi(409, "Este torneo llegó al máximo de inscripciones online. Escríbenos por WhatsApp.");
  const fvp = await buscadorVigente();
  const entrada: EntradaInscripcion = {
    categoriaId: String(b.categoriaId ?? ""),
    jugadores: Array.isArray(b.jugadores) ? [b.jugadores[0], b.jugadores[1]] : [null, null],
    aceptaReglamento: b.aceptaReglamento === true,
    pago: b.pago && typeof b.pago === "object" ? { metodoId: String(b.pago.metodoId ?? ""), referencia: String(b.pago.referencia ?? "") } : null,
    comprobante: !!comprobante,
  };
  const v = validarInscripcion(t, entrada, previas, fvp?.buscar ?? null);
  if (v.errores.length) throw new ErrorApi(422, v.errores[0], v.errores);
  const insc = crearInscripcion(t, entrada, v.jugadores, v.fvp, fvp?.lista);
  if (comprobante) await guardarComprobante(t.id, insc.id, comprobante);
  await guardarInscripcion(insc);
  return NextResponse.json({ id: insc.id, codigo: insc.codigo, estado: insc.estado }, { status: 201 });
});

/**
 * PATCH /api/inscripciones/:torneoId (staff)
 *   { id, accion: "confirmar" }               → verifica el pago y mete la dupla al torneo
 *   { id, accion: "rechazar", nota }          → la rechaza con motivo (libera el cupo)
 *   { id, accion: "pendiente" | "verificar" } → la vuelve a "sin pago" o "por verificar"
 *   → { inscripcion, torneo? }
 */
export const PATCH = manejar(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesion = exigirStaff(req);
  const { id } = await ctx.params;
  const b = (await leerJson(req)) as { id?: unknown; accion?: unknown; nota?: unknown } | null;
  if (typeof b?.id !== "string" || typeof b.accion !== "string") throw new ErrorApi(400, "Envía { id, accion }.");
  const t = await torneoDe(id);
  const insc = await obtenerInscripcion(t.id, b.id);
  const ahora = new Date().toISOString();
  const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 300) : "";

  if (b.accion === "confirmar") {
    if (insc.estado === "CONFIRMADA" && insc.duplaId && dupla(t, insc.duplaId)) return NextResponse.json({ inscripcion: insc, torneo: t });
    const ct = categoria(t, insc.categoriaId);
    if (!ct) throw new ErrorApi(409, "Esa categoría ya no está en el torneo.");
    const activas = ct.duplas.filter((d) => d.estado === "ACTIVA");
    if (ct.cupo != null && activas.length >= ct.cupo) throw new ErrorApi(409, `${nombreCategoria(ct.categoria)} ya llegó a su cupo de ${ct.cupo} duplas.`);
    const enCategoria = new Set(activas.flatMap((d) => d.jugadorIds.map((x) => claveCedula(jugador(t, x)?.cedula))));
    const repetido = insc.jugadores.find((j) => enCategoria.has(claveCedula(j.cedula)));
    if (repetido) throw new ErrorApi(409, `${nombreInscrito(repetido)} ya está en una dupla de ${nombreCategoria(ct.categoria)}.`);
    const { torneo: conDupla, duplaId } = confirmarEnTorneo(t, insc, null);
    // Mismo chequeo FVP que cuando el staff carga una dupla a mano.
    const fvp = await buscadorVigente();
    const d = dupla(conDupla, duplaId)!;
    const js = d.jugadorIds.map((x) => jugador(conDupla, x)) as [JugadorTorneo, JugadorTorneo];
    const ver = t.validarFvp === false ? null : verificarDupla(ct.categoria, js, fvp?.buscar ?? null, { lista: fvp?.lista });
    let final = ver ? editarDupla(conDupla, insc.categoriaId, duplaId, { fvp: ver }) : conDupla;
    final = {
      ...final,
      actualizadoEn: despues(final.actualizadoEn),
      historial: [...(final.historial ?? []), { en: ahora, por: sesion.nombre, texto: `Inscripción online ${insc.codigo} confirmada: ${insc.jugadores.map(nombreInscrito).join(" / ")} (${nombreCategoria(ct.categoria)}).` }].slice(-300),
    };
    await getTorneosRepository().guardar(final);
    const lista = await guardarInscripcion({ ...insc, estado: "CONFIRMADA", duplaId, revisadaPor: sesion.nombre, nota: nota || insc.nota, actualizadaEn: ahora });
    return NextResponse.json({ inscripcion: lista, torneo: final });
  }

  const destino: Record<string, EstadoInscripcion> = { rechazar: "RECHAZADA", pendiente: "PENDIENTE_PAGO", verificar: "PAGO_REPORTADO" };
  const estado = destino[b.accion];
  if (!estado) throw new ErrorApi(400, "Acción desconocida.");
  if (insc.estado === "CONFIRMADA") throw new ErrorApi(409, "Esta dupla ya está en el torneo: para sacarla usa Inscritos → Quitar.");
  if (estado === "RECHAZADA" && !nota) throw new ErrorApi(422, "Escribe el motivo del rechazo (la dupla lo verá al consultar su código).");
  const actualizada: Inscripcion = { ...insc, estado, nota: estado === "RECHAZADA" ? nota : insc.nota, revisadaPor: sesion.nombre, actualizadaEn: ahora };
  await guardarInscripcion(actualizada);
  return NextResponse.json({ inscripcion: actualizada });
});
