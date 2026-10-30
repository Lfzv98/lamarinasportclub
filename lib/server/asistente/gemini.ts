import "server-only";
import { ErrorApi } from "@/lib/server/http";
import type { MensajeAsistente } from "@/lib/asistente/tipos";

/**
 * Gemini (clave gratis de Google AI Studio) por su endpoint compatible con OpenAI, igual que
 * el copiloto de La Fructosa. Prueba los modelos en orden y, si Google apaga uno o saca uno
 * nuevo, toma los Flash vigentes de ListModels sin volver a desplegar.
 */
// GEMINI_BASE_URL solo para pruebas (un servidor falso); en producción no se define.
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const URL_CHAT = `${BASE}/openai/chat/completions`;
const URL_MODELOS = `${BASE}/models?pageSize=1000`;
const MODELOS = (process.env.GEMINI_MODELO || "gemini-3.6-flash,gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-2.5-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LISTAR_CADA_MS = 6 * 3600_000;
const ESPERA_MS = 25_000;

export const claveGemini = () => process.env.GEMINI_API_KEY ?? "";

let catalogo: { en: number; nombres: Set<string> } | null = null;

function flashMasNuevos(nombres: Iterable<string>, excluir: string[]): string[] {
  const ver = (m: string) => (m.match(/gemini-(\d+(?:\.\d+)?)/) ?? ["", "0"])[1].split(".").map(Number);
  return [...nombres]
    .filter((m) => /^gemini-[\d.]+-flash(-lite)?$|^gemini-flash(-lite)?-latest$/.test(m) && !excluir.includes(m))
    .sort((a, b) => {
      const va = ver(a);
      const vb = ver(b);
      return vb[0] - va[0] || (vb[1] ?? 0) - (va[1] ?? 0) || Number(a.includes("lite")) - Number(b.includes("lite"));
    });
}

async function cadenaModelos(): Promise<string[]> {
  if (!catalogo || Date.now() - catalogo.en > LISTAR_CADA_MS) {
    try {
      const r = await fetch(URL_MODELOS, { headers: { "x-goog-api-key": claveGemini() }, signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const j = (await r.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
        const nombres = new Set<string>();
        for (const m of j.models ?? []) if (m.supportedGenerationMethods?.includes("generateContent")) nombres.add(String(m.name ?? "").replace(/^models\//, ""));
        catalogo = { en: Date.now(), nombres };
      }
    } catch {
      /* sin catálogo: se usa la lista fija */
    }
  }
  const nombres = catalogo?.nombres;
  if (!nombres?.size) return MODELOS;
  const quedan = MODELOS.filter((m) => nombres.has(m));
  const cadena = [...quedan, ...flashMasNuevos(nombres, quedan).slice(0, 3)];
  return cadena.length ? cadena : MODELOS;
}

type Esquema = Record<string, unknown>;
const esNulo = (e: unknown) => !!e && typeof e === "object" && (e as Esquema).type === "null";

/** Esquema de las herramientas → el que acepta Gemini: sin anyOf con null (pasa a opcional) ni additionalProperties. */
export function esquemaGemini(e: Esquema): Esquema {
  if (Array.isArray(e.anyOf)) {
    const resto = (e.anyOf as Esquema[]).filter((x) => !esNulo(x));
    if (resto.length === 1) return esquemaGemini({ ...resto[0], ...(e.description ? { description: e.description } : {}) });
  }
  const { additionalProperties: _a, ...limpio } = e;
  if (limpio.type === "object" && limpio.properties) {
    const props = limpio.properties as Record<string, Esquema>;
    return {
      ...limpio,
      properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, esquemaGemini(v)])),
      required: ((limpio.required as string[] | undefined) ?? []).filter((k) => !(Array.isArray(props[k]?.anyOf) && (props[k].anyOf as unknown[]).some(esNulo))),
    };
  }
  if (limpio.type === "array" && limpio.items) return { ...limpio, items: esquemaGemini(limpio.items as Esquema) };
  return limpio;
}

export interface HerramientaGenerica {
  name: string;
  description?: string;
  input_schema: Esquema;
}

export interface SalidaModelo {
  texto: string;
  llamadas: { nombre: string; entrada: unknown }[];
}

export async function preguntarGemini(sistema: string, historial: MensajeAsistente[], ultimo: string, herramientas: HerramientaGenerica[]): Promise<SalidaModelo> {
  const messages = [
    { role: "system", content: sistema },
    ...historial.map((m) => ({ role: m.rol === "staff" ? "user" : "assistant", content: m.texto })),
    { role: "user", content: ultimo },
  ];
  const tools = herramientas.map((h) => ({ type: "function", function: { name: h.name, description: h.description, parameters: esquemaGemini(h.input_schema) } }));

  let ultimoEstado = 502;
  for (const model of await cadenaModelos()) {
    try {
      const r = await fetch(URL_CHAT, {
        method: "POST",
        headers: { Authorization: `Bearer ${claveGemini()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 8192, reasoning_effort: "low" }),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      if (!r.ok) {
        ultimoEstado = r.status;
        console.error("[api/asistente] gemini", model, r.status);
        await r.body?.cancel();
        // Clave inválida o petición mala: otro modelo no ayuda.
        if (![404, 429].includes(r.status) && r.status < 500) break;
        continue;
      }
      const j = (await r.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
      };
      const msg = j.choices?.[0]?.message;
      const llamadas = (msg?.tool_calls ?? []).flatMap((t) => {
        try {
          return t.function?.name ? [{ nombre: t.function.name, entrada: JSON.parse(t.function.arguments || "{}") as unknown }] : [];
        } catch {
          return [];
        }
      });
      return { texto: (msg?.content ?? "").trim(), llamadas };
    } catch {
      ultimoEstado = 504;
      console.error("[api/asistente] gemini", model, "sin respuesta");
      break;
    }
  }
  if (ultimoEstado === 429) throw new ErrorApi(429, "La IA gratis llegó a su límite por ahora. Intenta en un minuto.");
  if (ultimoEstado === 400 || ultimoEstado === 401 || ultimoEstado === 403) throw new ErrorApi(503, "Gemini rechazó la petición. Revisa que GEMINI_API_KEY en Vercel sea correcta.");
  throw new ErrorApi(502, "La IA no respondió. Intenta de nuevo.");
}
