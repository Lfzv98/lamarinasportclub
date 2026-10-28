"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Valla } from "@/types/americano";

export const MAX_VALLAS = 6;
/** Cada cuánto las vallas cambian de lugar, como el giro de anuncios en las vallas de un estadio. */
const SEGUNDOS_POR_GIRO = 20;

const tieneContenido = (v?: Valla | null): v is Valla => !!v && (!!v.img || !!v.nombre.trim());

/**
 * Las 6 vallas publicitarias del Modo TV. Cada una corre su anuncio sin parar y, cada 20 s,
 * todas giran un lugar en cascada para que cada marca pase por las mejores posiciones.
 * Una valla sin marca muestra el logo de La Marina.
 */
export function VallasTV({ vallas, fila = false, className }: { vallas?: Valla[]; fila?: boolean; className?: string }) {
  const lista = Array.from({ length: MAX_VALLAS }, (_, i) => (tieneContenido(vallas?.[i]) ? vallas![i] : null));
  const hay = lista.some(Boolean);
  const [giro, setGiro] = useState(0);
  useEffect(() => {
    if (!hay) return;
    const t = setInterval(() => setGiro((g) => g + 1), SEGUNDOS_POR_GIRO * 1000);
    return () => clearInterval(t);
  }, [hay]);

  return (
    <aside aria-label="Publicidad" className={clsx("grid min-h-0 gap-3", fila ? "grid-cols-3 grid-rows-2" : "grid-rows-6", className)}>
      {lista.map((_, i) => (
        <PanelValla key={i} valla={lista[(i + giro) % MAX_VALLAS]} indice={i} />
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
          <div className="valla-pista flex h-full w-max items-center" style={{ "--valla-seg": `${15 + (indice % 3) * 2}s` } as React.CSSProperties}>
            {[0, 1].map((copia) => (
              <div key={copia} className="flex h-full items-center" aria-hidden={copia === 1}>
                {[0, 1, 2].map((k) => (
                  <Anuncio key={k} valla={valla} />
                ))}
              </div>
            ))}
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
      <span className="flex h-full shrink-0 items-center px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={valla.img} alt={valla.nombre} className="max-h-[70%] w-auto max-w-[12.5rem] object-contain" />
      </span>
    );
  if (valla)
    return (
      <span className="flex h-full shrink-0 items-center gap-6 px-5 font-display text-3xl font-black uppercase tracking-wide text-white">
        {valla.nombre}
        <span className="size-2 rounded-full bg-neon" />
      </span>
    );
  return (
    <span className="flex h-full shrink-0 items-center px-7">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="La Marina Sport Club" className="max-h-[56%] w-auto max-w-[11rem] object-contain opacity-90" />
    </span>
  );
}
