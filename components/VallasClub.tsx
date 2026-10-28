"use client";

import { ImagePlus, Loader2, Megaphone, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { MAX_VALLAS } from "@/components/Vallas";
import { comprimirBanner } from "@/lib/fotos";
import { useAmericanos } from "@/lib/store";
import type { Valla } from "@/types/americano";

/**
 * Ajustes → Publicidad del Modo TV: las 6 vallas que corren a la izquierda de la tabla en la TV
 * de los americanos. La imagen se sube al instante; nombre y orden se guardan con "Guardar cambios".
 */
export function VallasClub({ valor, onChange }: { valor: Valla[] | undefined; onChange: (v: Valla[]) => void }) {
  const nueva = (i: number): Valla => ({ id: `valla-${i + 1}`, nombre: "", img: null });
  const cantidad = Math.min(MAX_VALLAS, Math.max(1, valor?.length || MAX_VALLAS));
  const vallas = Array.from({ length: cantidad }, (_, i) => valor?.[i] ?? nueva(i));
  const elegirCantidad = (k: number) => onChange(Array.from({ length: k }, (_, i) => vallas[i] ?? nueva(i)));
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const cambiar = (i: number, cambios: Partial<Valla>) => onChange(vallas.map((v, k) => (k === i ? { ...v, ...cambios } : v)));

  async function subir(i: number, f: File) {
    setSubiendo(i);
    try {
      const img = await comprimirBanner(f);
      const r = await fetch("/api/club/vallas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: vallas[i].id, img }) });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.status === 401) useAmericanos.setState({ staff: null, pedirLogin: true });
      if (!r.ok || !d.url) return toast(d.error ?? "No se pudo subir la imagen.", "error");
      cambiar(i, { img: d.url, nombre: vallas[i].nombre || f.name.replace(/\.[^.]+$/, "").slice(0, 40) });
      toast(`Valla ${i + 1} lista. Toca "Guardar cambios" para publicarla.`, "info");
    } catch {
      toast("No se pudo leer la imagen o no hay conexión.", "error");
    } finally {
      setSubiendo(null);
    }
  }

  return (
    <section id="publicidad" className="scroll-mt-6">
      <h2 className="label mt-10 flex items-center gap-1.5">
        <Megaphone className="size-3.5" /> Publicidad del Modo TV (americanos)
      </h2>
      <p className="mb-3 text-xs text-white/50">
        Vallas a la izquierda de la tabla, como las de un estadio: se reparten el alto de la pantalla y cambian de lugar cada 12 segundos. Usa imágenes anchas (ej. 1200 × 300). Si una valla queda vacía, sale el logo de La Marina.
      </p>
      <div className="glass mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3">
        <span className="text-sm font-semibold">¿Cuántas vallas?</span>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="radiogroup" aria-label="Cantidad de vallas">
          {Array.from({ length: MAX_VALLAS }, (_, i) => i + 1).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={k === cantidad}
              onClick={() => elegirCantidad(k)}
              className={k === cantidad ? "size-9 rounded-lg bg-neon font-display font-bold text-noche" : "size-9 rounded-lg font-display font-bold text-white/60 hover:text-white"}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {vallas.map((v, i) => (
          <li key={v.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neon/10 font-display text-sm font-bold text-neon">{i + 1}</span>
            <button
              type="button"
              className="relative flex h-14 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#04060d]"
              onClick={() => {
                archivo.current!.dataset.i = String(i);
                archivo.current!.click();
              }}
              aria-label={`Imagen de la valla ${i + 1}`}
              disabled={subiendo !== null}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.img ? <img src={v.img} alt="" className="max-h-11 max-w-[8.5rem] object-contain" /> : <ImagePlus className="size-5 text-white/40" />}
              {subiendo === i && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="size-5 animate-spin text-white" />
                </span>
              )}
            </button>
            <input className="input !w-auto min-w-0 flex-1 !py-2" placeholder="Marca" maxLength={80} value={v.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} aria-label={`Marca de la valla ${i + 1}`} />
            {(v.img || v.nombre) && (
              <button
                className="rounded-lg p-2 text-white/40 hover:text-coral"
                onClick={() => cambiar(i, { img: null, nombre: "" })}
                aria-label={`Vaciar la valla ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const i = Number(e.target.dataset.i);
          e.target.value = "";
          if (f) subir(i, f);
        }}
      />
    </section>
  );
}
