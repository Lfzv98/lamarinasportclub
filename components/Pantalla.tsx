"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

/** Piezas de las pantallas grandes (Modo TV y pantallas de pista): escala fija, pantalla completa y sin que se apague. */

type DocFull = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> };
type ElFull = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type Bloqueo = { release: () => Promise<void> };

/**
 * Pantalla completa (cuando el navegador la permite: en iPhone no existe) y pantalla siempre encendida.
 * Si el navegador no trae Wake Lock (algunos de Smart TV y Fire TV), un video mudo invisible
 * mantiene la pantalla despierta, que es el truco que funciona en esos navegadores.
 */
export function useFullscreenYWakeLock() {
  const [full, setFull] = useState(false);
  const [puede, setPuede] = useState(false);
  useEffect(() => {
    const d = document as DocFull;
    setPuede(!!(d.fullscreenEnabled || d.webkitFullscreenEnabled));
    const h = () => setFull(!!(d.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", h);
    document.addEventListener("webkitfullscreenchange", h);

    let lock: Bloqueo | null = null;
    let video: HTMLVideoElement | null = null;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Bloqueo> } }).wakeLock;
    const videoDespierto = () => {
      if (video) return void video.play().catch(() => undefined);
      const c = document.createElement("canvas");
      c.width = c.height = 2;
      const stream = (c as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(1);
      if (!stream) return;
      video = document.createElement("video");
      Object.assign(video, { muted: true, loop: true, playsInline: true, srcObject: stream });
      video.setAttribute("playsinline", "");
      video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0";
      document.body.appendChild(video);
      video.play().catch(() => undefined);
    };
    const pedir = () => {
      if (document.visibilityState !== "visible") return;
      if (wl) wl.request("screen").then((l) => (lock = l)).catch(videoDespierto);
      else videoDespierto();
    };
    pedir();
    // Algunos navegadores solo dejan pedirlo después de un toque o una tecla del control remoto.
    window.addEventListener("pointerdown", pedir, { once: true });
    window.addEventListener("keydown", pedir, { once: true });
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("fullscreenchange", h);
      document.removeEventListener("webkitfullscreenchange", h);
      document.removeEventListener("visibilitychange", pedir);
      window.removeEventListener("pointerdown", pedir);
      window.removeEventListener("keydown", pedir);
      lock?.release().catch(() => undefined);
      video?.remove();
    };
  }, []);
  const alternar = () => {
    const d = document as DocFull;
    const el = document.documentElement as ElFull;
    const p = d.fullscreenElement || d.webkitFullscreenElement
      ? (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)
      : (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    Promise.resolve(p).catch(() => undefined);
  };
  return { full, alternar, puede };
}

export function useCursorOculto() {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => {
      setOculto(false);
      clearTimeout(t);
      t = setTimeout(() => setOculto(true), 3000);
    };
    mover();
    window.addEventListener("mousemove", mover);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", mover);
    };
  }, []);
  return oculto;
}

export function Reloj() {
  const [h, setH] = useState("");
  useEffect(() => {
    const f = () => setH(new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
    f();
    const t = setInterval(f, 10_000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-display text-3xl font-semibold tabular text-white/70">{h}</span>;
}

export function useVertical() {
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const ver = () => setVertical(window.innerHeight > window.innerWidth * 1.1);
    ver();
    window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);
  return vertical;
}

/** Medidas del lienzo en píxeles de diseño: 1920 de ancho en una TV, menos en un celular. */
export type Lienzo = { ancho: number; alto: number; escala: number; desplaza: boolean; zoom: boolean; listo: boolean };

/** Por debajo de esta escala la letra ya no se lee: el lienzo se angosta y la pantalla pasa a desplazarse. */
const ESCALA_MIN = 0.55;
/** Lienzo más angosto que esto: celular o tablet chica, todo va en una columna. */
export const ANCHO_ESTRECHO = 1100;

function medir(vertical: boolean, zoom: boolean): Lienzo {
  const [bw, bh] = vertical ? [1080, 1920] : [1920, 1080];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ajuste = Math.min(vw / bw, vh / bh);
  const escala = Math.max(ajuste, ESCALA_MIN);
  return { ancho: vw / escala, alto: vh / escala, escala, desplaza: ajuste < ESCALA_MIN, zoom, listo: true };
}

/**
 * ¿El navegador aplica de verdad `zoom`? Algunos (navegadores dentro de apps como WhatsApp en
 * iPhone) dicen que sí pero lo ignoran, y el lienzo sale sin escalar y roto. Se mide un cuadro de
 * prueba: si no se achica, se usa `transform`, que funciona en todos.
 */
function zoomFunciona(): boolean {
  if (typeof CSS === "undefined" || !CSS.supports?.("zoom", "2")) return false;
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;width:200px;height:10px;zoom:0.5";
  document.body.appendChild(d);
  const w = d.getBoundingClientRect().width;
  d.remove();
  return Math.abs(w - 100) < 2;
}

/**
 * Forma del lienzo según la pantalla: toma la forma exacta (sin franjas negras en un iPad 4:3 ni en
 * una TV ultra ancha) y escala todo con ella, de un celular a una TV 4K de 100". En pantallas chicas
 * no encoge la letra por debajo de lo legible: el lienzo se angosta y deja desplazar.
 */
export function useLienzo(vertical: boolean): Lienzo {
  const [l, setL] = useState<Lienzo>(() => ({ ancho: vertical ? 1080 : 1920, alto: vertical ? 1920 : 1080, escala: 1, desplaza: false, zoom: true, listo: false }));
  useEffect(() => {
    const z = zoomFunciona();
    const ajustar = () => setL(medir(vertical, z));
    ajustar();
    window.addEventListener("resize", ajustar);
    window.addEventListener("orientationchange", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("orientationchange", ajustar);
    };
  }, [vertical]);
  return l;
}

/** `marcaAgua`: el logo de La Marina grande, centrado y difuminado detrás de todo. */
export function Escenario({ oculto, lienzo, marcaAgua = false, children }: { oculto: boolean; lienzo: Lienzo; marcaAgua?: boolean; children: React.ReactNode }) {
  const { ancho, alto, escala, desplaza, zoom, listo } = lienzo;
  return (
    <main className={clsx("tema-noche pantalla fixed inset-0 overflow-x-hidden", desplaza ? "overflow-y-auto" : "overflow-hidden", oculto && "cursor-none", !listo && "invisible")}>
      {marcaAgua && (
        <div aria-hidden className="pointer-events-none fixed inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="w-[72vw] max-w-none opacity-[0.11] blur-[6px] saturate-[0.85]" />
        </div>
      )}
      {zoom ? (
        <div className="relative flex flex-col gap-6 p-10" style={{ width: ancho, height: desplaza ? "auto" : alto, minHeight: alto, zoom: escala }}>
          {children}
        </div>
      ) : (
        <Escalado ancho={ancho} alto={alto} escala={escala} desplaza={desplaza}>
          {children}
        </Escalado>
      )}
    </main>
  );
}

/** Sin `zoom`: el lienzo se escala con `transform` y, si es más alto que la pantalla, una caja con su alto real deja desplazar. */
function Escalado({ ancho, alto, escala, desplaza, children }: { ancho: number; alto: number; escala: number; desplaza: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [altoReal, setAltoReal] = useState(alto);
  useEffect(() => {
    const el = ref.current;
    if (!el || !desplaza) return;
    const medir = () => setAltoReal(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desplaza]);
  return (
    <div className="relative" style={{ width: ancho * escala, height: (desplaza ? altoReal : alto) * escala }}>
      <div
        ref={ref}
        className="relative flex flex-col gap-6 p-10"
        style={{ width: ancho, height: desplaza ? "auto" : alto, minHeight: alto, transform: `scale(${escala})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}
