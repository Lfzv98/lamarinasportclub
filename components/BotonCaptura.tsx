"use client";

import clsx from "clsx";
import { Camera, Download, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { toast } from "@/components/ui/Toaster";

/**
 * Guarda una captura de la pantalla del ranking como imagen, en cualquier celular, tablet o
 * computadora: se arma la imagen y luego se comparte (menú del celular) o se descarga.
 * Lo que lleva `data-sin-captura` (botones) no sale en la imagen.
 */
export function BotonCaptura({ objetivo, archivo, className }: { objetivo: string; archivo: string; className?: string }) {
  const [trabajando, setTrabajando] = useState(false);
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);

  async function capturar() {
    const el = document.getElementById(objetivo);
    if (!el) return;
    setTrabajando(true);
    try {
      const { toBlob } = await import("html-to-image");
      const fondo = getComputedStyle(document.body).backgroundColor || "#0f058c";
      const blob = await toBlob(el, {
        pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        backgroundColor: fondo,
        style: { margin: "0", minHeight: "0", paddingBottom: "16px" },
        filter: (n) => !(n instanceof HTMLElement && n.dataset.sinCaptura !== undefined),
      });
      if (!blob) throw new Error("sin imagen");
      if (img) URL.revokeObjectURL(img.url);
      setImg({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast("No se pudo guardar la captura. Prueba otra vez.", "error");
    } finally {
      setTrabajando(false);
    }
  }

  const file = img ? new File([img.blob], archivo, { type: "image/png" }) : null;
  const puedeCompartir = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  async function compartir() {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("No se pudo compartir. Usa Descargar.", "error");
    }
  }

  return (
    <>
      <button data-sin-captura className={clsx("btn-ghost !px-3 text-sm", className)} onClick={capturar} disabled={trabajando} aria-label="Guardar captura de pantalla">
        {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        <span className="hidden min-[420px]:inline">Captura</span>
      </button>
      <Hoja abierta={!!img} onClose={() => setImg(null)} titulo="Tu captura" sub="Compártela o guárdala en tu galería." ancho="max-w-lg">
        {img && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="Captura del ranking" className="mx-auto max-h-[55dvh] w-auto rounded-2xl border border-white/10" />
            <p className="mt-2 text-center text-xs text-white/45">En iPhone también puedes mantener presionada la imagen y tocar “Guardar en Fotos”.</p>
            <div className={clsx("mt-4 grid gap-2", puedeCompartir ? "grid-cols-2" : "grid-cols-1")}>
              {puedeCompartir && (
                <button className="btn-neon" onClick={compartir}>
                  <Share2 className="size-4" /> Compartir
                </button>
              )}
              <a className={puedeCompartir ? "btn-ghost" : "btn-neon"} href={img.url} download={archivo}>
                <Download className="size-4" /> Descargar
              </a>
            </div>
          </div>
        )}
      </Hoja>
    </>
  );
}
