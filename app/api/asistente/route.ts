import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { exigirStaff, ipDe } from "@/lib/server/auth";
import { HERRAMIENTAS, NOMBRES_HERRAMIENTAS } from "@/lib/server/asistente/herramientas";
import { promptSistema } from "@/lib/server/asistente/prompt";
import { ErrorApi, leerJson, manejar } from "@/lib/server/http";
import type { AccionAsistente, MensajeAsistente, RespuestaAsistente } from "@/lib/asistente/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODELO = process.env.ASISTENTE_MODELO || "claude-opus-5-5";
const MAX_MENSAJES = 30;
const MAX_TEXTO = 6000;
const MAX_CONTEXTO = 40_000;

/** Freno de costos: mensajes por IP en una ventana de 10 minutos. */
const VENTANA_MS = 10 * 60_000;
const MAX_POR_VENTANA = 60;
const uso = new Map<string, number[]>();
function controlarUso(ip: string) {
  const ahora = Date.now();
  const recientes = (uso.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) throw new ErrorApi(429, "Muchas preguntas seguidas. Espera unos minutos y vuelve a intentar.");
  recientes.push(ahora);
  uso.set(ip, recientes);
}

const activo = () => !!process.env.ANTHROPIC_API_KEY;

/** GET /api/asistente → { activo }: si el club tiene la clave de la IA configurada. */
export const GET = manejar(async () => NextResponse.json({ activo: activo() }));

/**
 * POST /api/asistente (staff) body: { mensajes: [{ rol, texto }], contexto } → { texto, acciones }.
 * Las acciones no se ejecutan acá: el chat las muestra y el staff decide.
 */
export const POST = manejar(async (req: Request) => {
  await exigirStaff(req);
  if (!activo()) throw new ErrorApi(503, "El asistente no está configurado: falta la clave ANTHROPIC_API_KEY en el servidor.");
  controlarUso(ipDe(req));

  const body = (await leerJson(req, 200_000)) as { mensajes?: unknown; contexto?: unknown } | null;
  const mensajes = (Array.isArray(body?.mensajes) ? body!.mensajes : [])
    .filter((m): m is MensajeAsistente => !!m && typeof m === "object" && ((m as MensajeAsistente).rol === "staff" || (m as MensajeAsistente).rol === "asistente") && typeof (m as MensajeAsistente).texto === "string")
    .slice(-MAX_MENSAJES)
    .map((m) => ({ ...m, texto: m.texto.slice(0, MAX_TEXTO) }));
  while (mensajes.length && mensajes[0].rol !== "staff") mensajes.shift();
  const ultimo = mensajes.at(-1);
  if (!ultimo || ultimo.rol !== "staff" || !ultimo.texto.trim()) throw new ErrorApi(400, "Escribe o dicta qué necesitas.");
  const contexto = JSON.stringify(body?.contexto ?? {}).slice(0, MAX_CONTEXTO);

  const historial: Anthropic.Beta.BetaMessageParam[] = mensajes.map((m, i) =>
    i === mensajes.length - 1
      ? {
          role: "user",
          content: [
            { type: "text", text: `<contexto_app>\n${contexto}\n</contexto_app>` },
            { type: "text", text: m.texto },
          ],
        }
      : { role: m.rol === "staff" ? "user" : "assistant", content: m.texto },
  );

  const client = new Anthropic();
  let respuesta: Anthropic.Beta.BetaMessage;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: promptSistema(), cache_control: { type: "ephemeral" } }],
      tools: HERRAMIENTAS,
      tool_choice: { type: "auto" },
      messages: historial,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ErrorApi(503, "La clave de la IA no es válida. Revisa ANTHROPIC_API_KEY en Vercel.");
    if (err instanceof Anthropic.RateLimitError) throw new ErrorApi(429, "La IA está ocupada. Intenta de nuevo en un momento.");
    if (err instanceof Anthropic.APIError) {
      console.error("[api/asistente]", err.status, err.message);
      throw new ErrorApi(502, "La IA no respondió. Intenta de nuevo.");
    }
    throw err;
  }

  if (respuesta.stop_reason === "refusal")
    return NextResponse.json<RespuestaAsistente>({ texto: "Con eso no te puedo ayudar. Pregúntame algo de los americanos, torneos o la app del club.", acciones: [] });

  const texto = respuesta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const acciones = respuesta.content
    .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && NOMBRES_HERRAMIENTAS.has(b.name))
    .map((b) => ({ ...(b.input as object), tipo: b.name }) as AccionAsistente);

  return NextResponse.json<RespuestaAsistente>({
    texto: texto || (acciones.length ? "Listo, te lo dejo preparado para revisar." : "No entendí bien. ¿Me lo repites?"),
    acciones,
  });
});
