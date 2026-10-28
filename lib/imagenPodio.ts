"use client";

/**
 * Imagen para redes del resultado de cada jugador o dupla al terminar un americano:
 * 1080 × 1350 (sirve para publicación y para historia de Instagram), con la foto, el puesto,
 * los puntos y la etiqueta de La Marina Sport Club. Se dibuja en el celular, sin servidor.
 */
import { iniciales } from "@/components/Avatar";
import { categoriaLabel } from "@/lib/categories";
import type { EventoAmericano, FilaPosicion } from "@/types/americano";

const W = 1080;
const H = 1350;
const NEON = "#c6f24e";
const MEDALLAS: Record<number, [string, string]> = { 1: ["#fde68a", "#f59e0b"], 2: ["#f1f5f9", "#94a3b8"], 3: ["#fdba74", "#c2410c"] };

export interface DatosImagen {
  evento: EventoAmericano;
  fila: FilaPosicion;
  nombres: string[];
  total: number;
  instagram: string;
}

/** Título del puesto, en femenino si todas son mujeres y en plural si es dupla. */
export function tituloPuesto(evento: EventoAmericano, fila: FilaPosicion, total: number): string {
  const ids = evento.modalidad === "DUPLA_FIJA" ? (evento.parejas.find((p) => p.id === fila.entidadId)?.jugadorIds ?? []) : [fila.entidadId];
  const js = ids.map((id) => evento.jugadores.find((j) => j.id === id));
  const plural = ids.length > 1;
  const mujeres = js.length > 0 && js.every((j) => j?.genero === "F");
  if (fila.posicion === 1) return plural ? (mujeres ? "Campeonas" : "Campeones") : mujeres ? "Campeona" : "Campeón";
  if (fila.posicion === 2) return plural ? (mujeres ? "Subcampeonas" : "Subcampeones") : mujeres ? "Subcampeona" : "Subcampeón";
  if (fila.posicion === 3) return "Tercer lugar";
  return `Puesto ${fila.posicion} de ${total}`;
}

function familia(clase: string): string {
  const el = document.createElement("span");
  el.className = clase;
  el.style.display = "none";
  document.body.appendChild(el);
  const f = getComputedStyle(el).fontFamily;
  el.remove();
  return f || "sans-serif";
}

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** Parte un texto en líneas que entren en `ancho` (máximo `max` líneas, la última con "…"). */
function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max = 2): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let linea = "";
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
    else {
      out.push(linea);
      linea = p;
    }
  }
  if (linea) out.push(linea);
  if (out.length > max) {
    const resto = out.slice(max - 1).join(" ");
    let corta = resto;
    while (corta.length > 1 && ctx.measureText(`${corta}…`).width > ancho) corta = corta.slice(0, -1);
    return [...out.slice(0, max - 1), `${corta}…`];
  }
  return out;
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Foto en círculo (o iniciales si no hay foto). */
function circulo(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, nombre: string, cx: number, cy: number, r: number, fuente: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    // Recorte cuadrado centrado, un poco hacia arriba (donde suelen estar las caras).
    const sx = (img.naturalWidth - lado) / 2;
    const sy = Math.max(0, (img.naturalHeight - lado) * 0.3);
    ctx.drawImage(img, sx, sy, lado, lado, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, "#a6e84a");
    g.addColorStop(1, "#34d399");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#0b1030";
    ctx.font = `700 ${Math.round(r * 0.8)}px ${fuente}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(iniciales(nombre) || "?", cx, cy + r * 0.04);
  }
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = NEON;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.stroke();
}

export async function generarImagenPodio({ evento, fila, nombres, total, instagram }: DatosImagen): Promise<Blob> {
  const display = familia("font-display");
  const sans = familia("font-sans");
  await Promise.all([document.fonts.load(`700 60px ${display}`), document.fonts.load(`600 40px ${sans}`)]).catch(() => undefined);

  const fotos = fila.fotoDupla ? [fila.fotoDupla] : fila.fotoUrls.filter((u): u is string => !!u).length ? fila.fotoUrls.map((u) => u ?? null) : [];
  const [logo, ...imgs] = await Promise.all([cargar("/brand/logo.png"), ...fotos.map((u) => (u ? cargar(u) : Promise.resolve(null)))]);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // Fondo: el índigo de la marca, con un brillo lima detrás de la foto.
  const fondo = ctx.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, "#1b2fb5");
  fondo.addColorStop(0.45, "#111a6b");
  fondo.addColorStop(1, "#070a1c");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);
  const brillo = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 520);
  brillo.addColorStop(0, "rgba(198,242,78,0.28)");
  brillo.addColorStop(1, "rgba(198,242,78,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, W, H);

  // Logo de La Marina arriba.
  if (logo) {
    const lw = 460;
    const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
    ctx.drawImage(logo, (W - lw) / 2, 56, lw, lh);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Evento.
  ctx.fillStyle = NEON;
  ctx.font = `700 26px ${sans}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("AMERICANO DE PÁDEL", W / 2, 268);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 50px ${display}`;
  const lineasEvento = lineas(ctx, evento.nombre, W - 160, 2);
  lineasEvento.forEach((l, i) => ctx.fillText(l, W / 2, 326 + i * 56));
  const fecha = new Date(`${evento.fecha}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 28px ${sans}`;
  ctx.fillText(`${categoriaLabel(evento.categoria)} · ${fecha}`, W / 2, 326 + lineasEvento.length * 56 + 6);

  // Foto (una, o las dos de la dupla superpuestas).
  const cy = 680;
  if (imgs.length >= 2 || (!imgs.length && nombres.length > 1)) {
    const r = 150;
    circulo(ctx, imgs[0] ?? null, nombres[0] ?? "?", W / 2 - 115, cy, r, display);
    circulo(ctx, imgs[1] ?? null, nombres[1] ?? "?", W / 2 + 115, cy, r, display);
  } else circulo(ctx, imgs[0] ?? null, nombres.join(" "), W / 2, cy, 185, display);

  // Medalla con el puesto.
  const mx = W / 2 + 175;
  const my = cy + 140;
  const [m1, m2] = MEDALLAS[fila.posicion] ?? ["#ffffff", "#cbd5e1"];
  const gm = ctx.createLinearGradient(mx - 60, my - 60, mx + 60, my + 60);
  gm.addColorStop(0, m1);
  gm.addColorStop(1, m2);
  ctx.fillStyle = gm;
  ctx.beginPath();
  ctx.arc(mx, my, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#0b1030";
  ctx.stroke();
  ctx.fillStyle = "#0b1030";
  ctx.font = `700 64px ${display}`;
  ctx.textBaseline = "middle";
  ctx.fillText(String(fila.posicion), mx, my + 4);
  ctx.textBaseline = "alphabetic";

  // Puesto y nombres.
  ctx.fillStyle = NEON;
  ctx.font = `700 76px ${display}`;
  ctx.fillText(tituloPuesto(evento, fila, total).toUpperCase(), W / 2, 958);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${nombres.length > 1 ? 40 : 46}px ${sans}`;
  const nombresTxt = nombres.length > 1 ? [nombres.join(" & ")] : nombres;
  const lineasNombre = nombresTxt.flatMap((n) => lineas(ctx, n, W - 140, 2));
  lineasNombre.forEach((l, i) => ctx.fillText(l, W / 2, 1014 + i * 50));

  // Números: puntos, ganados y diferencia.
  const datos: [string, string][] = [
    [String(fila.puntos), "Puntos"],
    [`${fila.pg}/${fila.pj}`, "Ganados"],
    [fila.diferencia > 0 ? `+${fila.diferencia}` : String(fila.diferencia), "Diferencia"],
  ];
  const by = 1014 + lineasNombre.length * 50 + 10;
  const bw = 250;
  const gap = 24;
  const bx0 = (W - (bw * 3 + gap * 2)) / 2;
  datos.forEach(([v, l], i) => {
    const x = bx0 + i * (bw + gap);
    redondeado(ctx, x, by, bw, 110, 28);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();
    ctx.fillStyle = i === 0 ? NEON : "#ffffff";
    ctx.font = `700 52px ${display}`;
    ctx.fillText(v, x + bw / 2, by + 58);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 22px ${sans}`;
    ctx.fillText(l.toUpperCase(), x + bw / 2, by + 92);
  });

  // Etiqueta del club.
  ctx.fillStyle = NEON;
  ctx.font = `700 40px ${display}`;
  ctx.fillText(`@${instagram}`, W / 2, H - 70);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `500 22px ${sans}`;
  ctx.fillText("La Marina Sport Club · PadelReserve", W / 2, H - 32);

  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("sin imagen"))), "image/png"));
}
