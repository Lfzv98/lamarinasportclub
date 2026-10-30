import "server-only";
import { isValidElement, type ReactNode } from "react";
import { PAGINAS } from "@/components/manual/paginas";

type Props = { children?: ReactNode; [k: string]: unknown };

/**
 * Árbol del manual → texto plano con títulos y viñetas, para el prompt del asistente.
 * Los componentes del manual son funciones puras sin hooks: se llaman directo.
 */
export function aTexto(nodo: ReactNode): string {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(aTexto).join("");
  if (!isValidElement<Props>(nodo)) return "";
  const { type, props } = nodo;
  if (typeof type === "function") return aTexto((type as (p: Props) => ReactNode)(props));
  const hijos = aTexto(props.children);
  switch (type) {
    case "figure":
    case "img":
    case "svg":
      return "";
    case "h1":
    case "h2":
    case "h3":
      return `\n## ${hijos.trim()}\n`;
    case "li":
      return `\n- ${hijos.trim()}`;
    case "aside":
      return `\nNota: ${hijos.trim()}\n`;
    case "br":
    case "tr":
      return `\n${hijos}`;
    case "td":
    case "th":
      return `${hijos.trim()} | `;
    case "p":
    case "ul":
    case "ol":
    case "div":
    case "header":
    case "table":
      return `\n${hijos}\n`;
    default:
      return hijos;
  }
}

const limpiar = (t: string) =>
  t
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

let cache: string | null = null;

/** El manual de la A a la Z en texto plano (se arma una vez por instancia del servidor). */
export function manualEnTexto(): string {
  if (cache) return cache;
  const partes: string[] = [];
  let ultima = "";
  for (const p of PAGINAS) {
    if (p.tipo === "tapa" || p.tipo === "contratapa" || !p.cuerpo) continue;
    if (p.seccion === "Índice" || p.seccion === "Notas") continue;
    const texto = limpiar(aTexto(p.cuerpo));
    if (!texto) continue;
    if (p.seccion && p.seccion !== ultima) partes.push(`\n# ${p.seccion}`);
    ultima = p.seccion ?? ultima;
    partes.push(texto);
  }
  cache = partes.join("\n").trim();
  return cache;
}
