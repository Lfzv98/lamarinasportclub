"use client";

import { ArrowDown, ArrowUp, ImagePlus, Loader2, Megaphone, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { BandaVallas, MAX_VALLAS } from "@/components/Vallas";
import { comprimirBanner } from "@/lib/fotos";
import { useAmericanos } from "@/lib/store";
import type { Valla } from "@/types/americano";

const nuevoId = () => `valla-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nombreDeArchivo = (f: File) => f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 40);

/** Sube la imagen ya ajustada; devuelve su URL o null (y avisa). */
async function subirImagen(id: string, f: File): Promise<string | null> {
  try {
    const img = await comprimirBanner(f);
    const r = await fetch("/api/club/vallas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, img }) });
    const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (r.status === 401) useAmericanos.setState({ staff: null, pedirLogin: true });
    if (!r.ok || !d.url) {
      toast(d.error ?? `No se pudo subir ${f.name}.`, "error");
      return null;
    }
    return d.url;
  } catch {
    toast(`No se pudo leer ${f.name} o no hay conexión.`, "error");
    return null;
  }
}

/**
 * Ajustes → Publicidad del Modo TV: hasta 30 marcas que corren en la banda de abajo de la TV de
 * todos los americanos (normales, individuales, mixtos y Americano Torneo). Las imágenes se suben al
 * instante, recortadas a su borde; marcas y orden se publican con "Guardar cambios".
 */
export function VallasClub({ valor, onChange }: { valor: Valla[] | undefined; onChange: (v: Valla[]) => void }) {
  const vallas = (valor ?? []).slice(0, MAX_VALLAS);
  // La lista más reciente: las subidas terminan después de varios cambios.
  const ultima = useRef(vallas);
  ultima.current = vallas;
  const publicar = (v: Valla[]) => {
    ultima.current = v;
    onChange(v);
  };
  const archivo = useRef<HTMLInputElement>(null);
  const varios = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [lote, setLote] = useState<{ hechas: number; total: number } | null>(null);
  const cambiar = (id: string, cambios: Partial<Valla>) => publicar(ultima.current.map((v) => (v.id === id ? { ...v, ...cambios } : v)));
  const libres = MAX_VALLAS - vallas.length;

  async function reemplazar(id: string, f: File) {
    setSubiendo(id);
    const url = await subirImagen(id, f);
    setSubiendo(null);
    if (!url) return;
    const v = ultima.current.find((x) => x.id === id);
    cambiar(id, { img: url, nombre: v?.nombre || nombreDeArchivo(f) });
    toast(`Logo listo. Toca "Guardar cambios" para publicarlo en la TV.`, "info");
  }

  async function agregarVarias(files: File[]) {
    const tomar = files.slice(0, libres);
    if (files.length > libres) toast(`Solo caben ${MAX_VALLAS} marcas: se suben ${libres} de ${files.length}.`, "info");
    if (!tomar.length) return;
    setLote({ hechas: 0, total: tomar.length });
    let ok = 0;
    for (const f of tomar) {
      const id = nuevoId();
      const url = await subirImagen(id, f);
      if (url) {
        publicar([...ultima.current, { id, nombre: nombreDeArchivo(f), img: url }]);
        ok++;
      }
      setLote((l) => l && { ...l, hechas: l.hechas + 1 });
    }
    setLote(null);
    if (ok) toast(`${ok} logo${ok === 1 ? "" : "s"} agregado${ok === 1 ? "" : "s"}. Toca "Guardar cambios" para publicarlos en la TV.`, "info");
  }

  function quitar(v: Valla) {
    if ((v.img || v.nombre) && !confirm(`¿Quitar ${v.nombre || "esta marca"} de la publicidad?`)) return;
    publicar(ultima.current.filter((x) => x.id !== v.id));
    // La imagen guardada se borra en segundo plano; si falla, queda huérfana sin salir en la TV.
    if (v.img) fetch(`/api/club/vallas?id=${encodeURIComponent(v.id)}`, { method: "DELETE" }).catch(() => undefined);
  }

  function mover(i: number, paso: -1 | 1) {
    const j = i + paso;
    if (j < 0 || j >= vallas.length) return;
    const v = [...vallas];
    [v[i], v[j]] = [v[j], v[i]];
    publicar(v);
  }

  return (
    <section id="publicidad" className="scroll-mt-6">
      <h2 className="label mt-10 flex items-center gap-1.5">
        <Megaphone className="size-3.5" /> Publicidad del Modo TV (todos los americanos)
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-white/50">
        Una banda larga abajo de la pantalla que corre sin parar, como la valla LED de un estadio: las marcas pasan una detrás de otra en este orden y
        todas salen en cada vuelta (con 30 marcas, una vuelta dura 2 minutos). Sale en la TV de los americanos normales, individuales, mixtos y del
        Americano Torneo. Mejor un logo PNG con fondo transparente o un banner ancho (ej. 1200 × 300): se recorta solo a su borde y se ajusta a cada
        pantalla.
      </p>

      <div className="glass mb-3 rounded-2xl p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Así se ve en la TV</p>
        <BandaVallas vallas={vallas} alto={64} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn-neon !py-2.5 text-sm" disabled={!libres || !!lote || !!subiendo} onClick={() => varios.current?.click()}>
          {lote ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {lote ? `Subiendo ${lote.hechas + 1} de ${lote.total}…` : "Subir logos"}
        </button>
        <button
          className="btn-ghost !py-2.5 text-sm"
          disabled={!libres || !!lote}
          onClick={() => publicar([...ultima.current, { id: nuevoId(), nombre: "", img: null }])}
          title="Marca solo con su nombre (o súbele el logo después)"
        >
          <Plus className="size-4" /> Marca sin logo
        </button>
        <span className="ml-auto text-xs font-semibold text-white/50">
          {vallas.length} de {MAX_VALLAS} marcas
        </span>
      </div>

      {vallas.length === 0 ? (
        <p className="glass rounded-2xl p-4 text-center text-sm text-white/50">Aún no hay marcas: en la TV corre el logo de La Marina. Toca “Subir logos” y elige uno o varios a la vez.</p>
      ) : (
        <ul className="space-y-2">
          {vallas.map((v, i) => (
            <li key={v.id} className="glass flex flex-wrap items-center gap-2 rounded-2xl p-2.5 sm:flex-nowrap sm:gap-3 sm:p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neon/10 font-display text-sm font-bold text-neon">{i + 1}</span>
              <button
                type="button"
                className="relative flex h-14 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#04060d] sm:w-36"
                onClick={() => {
                  archivo.current!.dataset.id = v.id;
                  archivo.current!.click();
                }}
                aria-label={`${v.img ? "Cambiar" : "Subir"} el logo de la marca ${i + 1}`}
                title={v.img ? "Cambiar el logo" : "Subir el logo"}
                disabled={subiendo !== null || !!lote}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.img ? <img src={v.img} alt="" className="max-h-10 max-w-[7.5rem] object-contain" /> : <ImagePlus className="size-5 text-white/40" />}
                {subiendo === v.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </span>
                )}
              </button>
              <input
                className="input !w-auto min-w-0 flex-1 basis-40 !py-2"
                placeholder="Nombre de la marca"
                maxLength={80}
                value={v.nombre}
                onChange={(e) => cambiar(v.id, { nombre: e.target.value })}
                aria-label={`Nombre de la marca ${i + 1}`}
              />
              <div className="ml-auto flex shrink-0 items-center">
                <button className="rounded-lg p-2 text-white/40 hover:text-white disabled:opacity-20" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir la marca ${i + 1}`}>
                  <ArrowUp className="size-4" />
                </button>
                <button className="rounded-lg p-2 text-white/40 hover:text-white disabled:opacity-20" onClick={() => mover(i, 1)} disabled={i === vallas.length - 1} aria-label={`Bajar la marca ${i + 1}`}>
                  <ArrowDown className="size-4" />
                </button>
                <button className="rounded-lg p-2 text-white/40 hover:text-coral" onClick={() => quitar(v)} aria-label={`Quitar la marca ${i + 1}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = e.target.dataset.id;
          e.target.value = "";
          if (f && id) reemplazar(id, f);
        }}
      />
      <input
        ref={varios}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        aria-label="Subir logos de marcas"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (fs.length) agregarVarias(fs);
        }}
      />
    </section>
  );
}
