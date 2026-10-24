"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { vibrar } from "@/lib/feedback";

/** Interruptor encendido/apagado. */
export function Switch({ activo, onChange, etiqueta }: { activo: boolean; onChange: (on: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => {
        vibrar(8);
        onChange(!activo);
      }}
      className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", activo ? "bg-neon" : "bg-white/15")}
    >
      <motion.span layout className={clsx("absolute top-1 size-5 rounded-full bg-blanco shadow", activo ? "right-1" : "left-1")} />
    </button>
  );
}
