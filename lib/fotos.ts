"use client";

/**
 * Fotos de duplas y jugadores: se comprimen en el dispositivo (JPEG ~900 px, < 400 KB),
 * se suben a /api/fotos y se muestran por URL versionada (el navegador las guarda en caché).
 */
import { useEffect } from "react";
import { create } from "zustand";

export type TipoFoto = "dupla" | "jugador";

/** Reduce la foto de la cámara a un JPEG liviano y bien orientado. */
export async function comprimirFoto(file: File, lado = 900): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => null);
  const fuente: CanvasImageSource & { width: number; height: number } =
    bmp ??
    (await new Promise<HTMLImageElement>((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = mal;
      img.src = URL.createObjectURL(file);
    }));
  const escala = Math.min(1, lado / Math.max(fuente.width, fuente.height));
  const c = document.createElement("canvas");
  c.width = Math.round(fuente.width * escala);
  c.height = Math.round(fuente.height * escala);
  c.getContext("2d")!.drawImage(fuente, 0, 0, c.width, c.height);
  let q = 0.8;
  let url = c.toDataURL("image/jpeg", q);
  while (url.length > 400_000 && q > 0.4) {
    q -= 0.1;
    url = c.toDataURL("image/jpeg", q);
  }
  return url;
}

/**
 * Imagen de una valla publicitaria: hasta 1400 × 360 px, conservando la transparencia del logo
 * (WebP o PNG) y, si pesa mucho, JPEG sobre el fondo oscuro de las vallas.
 */
/**
 * Recorta los márgenes vacíos del logo (transparentes o del mismo color del fondo), para que en la
 * banda de la TV la marca ocupe su espacio completo y todas se vean del mismo tamaño. Deja un 4 % de aire.
 */
function bordeUtil(img: HTMLImageElement, ancho: number, alto: number) {
  const todo = { x: 0, y: 0, w: ancho, h: alto };
  const k = Math.min(1, 400 / Math.max(ancho, alto));
  const cw = Math.max(1, Math.round(ancho * k));
  const ch = Math.max(1, Math.round(alto * k));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return todo;
  ctx.drawImage(img, 0, 0, cw, ch);
  let d: Uint8ClampedArray;
  try {
    d = ctx.getImageData(0, 0, cw, ch).data;
  } catch {
    return todo;
  }
  const [r0, g0, b0, a0] = [d[0], d[1], d[2], d[3]];
  const vacio = (i: number) =>
    a0 < 16 ? d[i + 3] < 16 : d[i + 3] > 200 && Math.abs(d[i] - r0) < 18 && Math.abs(d[i + 1] - g0) < 18 && Math.abs(d[i + 2] - b0) < 18;
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++)
      if (!vacio((y * cw + x) * 4)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return todo;
  const aire = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - aire);
  y0 = Math.max(0, y0 - aire);
  x1 = Math.min(cw - 1, x1 + aire);
  y1 = Math.min(ch - 1, y1 + aire);
  return { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
}

export async function comprimirBanner(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = url;
    });
    // Un SVG sin tamaño propio se dibuja a 1200 × 300.
    const ancho = img.naturalWidth || 1200;
    const altoImg = img.naturalHeight || 300;
    const { x, y, w, h } = bordeUtil(img, ancho, altoImg);
    const escala = Math.min(1, 1400 / w, 360 / h);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * escala));
    c.height = Math.max(1, Math.round(h * escala));
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/webp", 0.88);
    if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
    if (out.length > 450_000) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#04060d";
      ctx.fillRect(0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", 0.85);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function subirFoto(eventoId: string, tipo: TipoFoto, id: string, img: string): Promise<{ url?: string; error?: string }> {
  try {
    const r = await fetch("/api/fotos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventoId, tipo, id, img }) });
    const d = (await r.json()) as { url?: string; error?: string };
    return r.ok ? { url: d.url } : { error: d.error ?? "No se pudo subir la foto." };
  } catch {
    return { error: "Sin conexión: la foto necesita internet para subirse." };
  }
}

export async function borrarFoto(eventoId: string, tipo: TipoFoto, id: string): Promise<boolean> {
  try {
    return (await fetch(`/api/fotos?${new URLSearchParams({ eventoId, tipo, id })}`, { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}

/* ---------- fotos de duplas de un torneo ---------- */

interface EstadoFotos {
  porTorneo: Record<string, Record<string, string>>;
  cargar: (torneoId: string) => Promise<void>;
  poner: (torneoId: string, duplaId: string, url: string | null) => void;
}

export const useFotos = create<EstadoFotos>()((set) => ({
  porTorneo: {},
  async cargar(torneoId) {
    try {
      const r = await fetch(`/api/fotos?torneoId=${encodeURIComponent(torneoId)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { fotos: Record<string, string> };
      set((s) => ({ porTorneo: { ...s.porTorneo, [torneoId]: d.fotos } }));
    } catch {
      /* sin conexión: se queda con lo que tenía */
    }
  },
  poner(torneoId, duplaId, url) {
    set((s) => {
      const actual = { ...(s.porTorneo[torneoId] ?? {}) };
      if (url) actual[duplaId] = url;
      else delete actual[duplaId];
      return { porTorneo: { ...s.porTorneo, [torneoId]: actual } };
    });
  },
}));

/** Fotos de las duplas del torneo; se refrescan cada `cadaMs` (30 s por defecto). */
export function useFotosTorneo(torneoId: string | null | undefined, cadaMs = 30_000): Record<string, string> {
  const fotos = useFotos((s) => (torneoId ? s.porTorneo[torneoId] : undefined));
  useEffect(() => {
    if (!torneoId) return;
    const cargar = () => useFotos.getState().cargar(torneoId);
    cargar();
    const id = setInterval(cargar, cadaMs);
    return () => clearInterval(id);
  }, [torneoId, cadaMs]);
  return fotos ?? VACIO;
}
const VACIO: Record<string, string> = {};

/** URL de la foto de una dupla (sin pedir nada: usa lo que ya cargó `useFotosTorneo`). */
export function useFotoDupla(torneoId: string, duplaId: string | null | undefined): string | null {
  return useFotos((s) => (duplaId ? s.porTorneo[torneoId]?.[duplaId] : undefined)) ?? null;
}
