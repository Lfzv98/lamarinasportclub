"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Valla } from "@/types/americano";

export const MAX_VALLAS = 6;
/** Cada cuánto las vallas cambian de lugar, como el giro de anuncios en las vallas de un estadio. */
const SEGUNDOS_POR_GIRO = 12;

const tieneContenido = (v?: Valla | null): v is Valla => !!v && (!!v.img || !!v.nombre.trim());

/**
 * Las vallas publicitarias del Modo TV (1 a 6). Cada logo va completo y centrado y, cada 12 s,
 * todas giran un lugar en cascada para que cada marca pase por las mejores posiciones.
 * Una valla sin marca muestra el logo de La Marina.
 */
export function VallasTV({ vallas, fila = false, className }: { vallas?: Valla[]; fila?: boolean; className?: string }) {
  // Cuántas vallas eligió el staff en Ajustes (1 a 6); sin configurar, 6. Se reparten el espacio exacto.
  const n = Math.min(MAX_VALLAS, Math.max(1, vallas?.length || MAX_VALLAS));
  const lista = Array.from({ length: n }, (_, i) => (tieneContenido(vallas?.[i]) ? vallas![i] : null));
  const hay = n > 1 && lista.some(Boolean);
  const [giro, setGiro] = useState(0);
  useEffect(() => {
    if (!hay) return;
    const t = setInterval(() => setGiro((g) => g + 1), SEGUNDOS_POR_GIRO * 1000);
    return () => clearInterval(t);
  }, [hay]);

  return (
    <aside
      aria-label="Publicidad"
      className={clsx("grid min-h-0 gap-3", className)}
      style={
        fila
          ? { gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.ceil(n / 3)}, minmax(0, 1fr))` }
          : { gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }
      }
    >
      {lista.map((_, i) => (
        <PanelValla key={i} valla={lista[(i + giro) % n]} indice={i} />
      ))}
    </aside>
  );
}

function PanelValla({ valla, indice }: { valla: Valla | null; indice: number }) {
  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#04060d] shadow-[inset_0_0_28px_rgba(0,0,0,0.85),0_0_24px_-8px_rgba(166,232,74,0.25)]">
      <AnimatePresence initial={false}>
        <motion.div
          key={valla?.id ?? "la-marina"}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.6, delay: indice * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-0 flex items-center overflow-hidden"
        >
          {/* Fijo y centrado: el logo o el nombre de la marca entra completo en la valla. */}
          <div className="flex size-full items-center justify-center px-4">
            <Anuncio valla={valla} />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="valla-led pointer-events-none absolute inset-0" />
      <div className="valla-brillo pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" style={{ animationDelay: `${indice * 0.6}s` }} />
    </div>
  );
}

function Anuncio({ valla }: { valla: Valla | null }) {
  if (valla?.img)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={valla.img} alt={valla.nombre} className="max-h-[72%] max-w-full object-contain" />
    );
  if (valla)
    return <span className="break-words text-center font-display text-3xl font-black uppercase leading-tight tracking-wide text-white">{valla.nombre}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo.png" alt="La Marina Sport Club" className="max-h-[58%] max-w-full object-contain opacity-90" />
  );
}

/**
 * Banda publicitaria de abajo, como la valla LED de un estadio de fútbol: una sola cinta larga
 * que corre sin parar con todas las marcas (las que eligió el staff, 1 a 6) una detrás de otra.
 * Sin marcas cargadas, corre el logo de La Marina.
 */
export function BandaVallas({ vallas, alto, className }: { vallas?: Valla[]; alto: number; className?: string }) {
  const n = Math.min(MAX_VALLAS, Math.max(1, vallas?.length || MAX_VALLAS));
  const marcas = Array.from({ length: n }, (_, i) => (tieneContenido(vallas?.[i]) ? vallas![i] : null));
  // Siempre al menos 8 piezas por vuelta para que la cinta llene pantallas anchas; se duplica para el bucle sin saltos.
  const vuelta = Array.from({ length: Math.max(8, Math.ceil(8 / marcas.length) * marcas.length) }, (_, i) => marcas[i % marcas.length]);
  const segundos = vuelta.length * 4;
  return (
    <aside
      aria-label="Publicidad"
      className={clsx("relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#04060d] shadow-[inset_0_0_28px_rgba(0,0,0,0.85),0_0_24px_-8px_rgba(166,232,74,0.25)]", className)}
      style={{ height: alto }}
    >
      <div className="valla-cinta flex h-full w-max" style={{ animationDuration: `${segundos}s` }}>
        {[0, 1].map((copia) => (
          <div key={copia} className="flex h-full" aria-hidden={copia === 1 || undefined}>
            {vuelta.map((v, i) => (
              <div key={i} className="flex h-full items-center justify-center border-r border-white/10 px-10" style={{ width: alto * 3.4 }}>
                <Anuncio valla={v} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="valla-led pointer-events-none absolute inset-0" />
    </aside>
  );
}
