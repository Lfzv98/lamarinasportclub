"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { vibrar } from "@/lib/feedback";

export function Stepper({
  valor,
  onChange,
  min = 0,
  max = 99,
  paso = 1,
  sufijo,
  grande = false,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  sufijo?: string;
  grande?: boolean;
}) {
  const cambiar = (d: number) => {
    const v = Math.min(max, Math.max(min, valor + d));
    if (v !== valor) {
      vibrar(8);
      onChange(v);
    }
  };
  const btn = grande ? "size-16 rounded-2xl" : "size-11 rounded-xl";
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Restar" onClick={() => cambiar(-paso)} disabled={valor <= min} className={`btn-ghost !p-0 ${btn}`}>
        <Minus className={grande ? "size-7" : "size-4"} />
      </button>
      <div className={`relative overflow-hidden text-center font-display font-bold tabular ${grande ? "w-24 text-6xl" : "w-14 text-2xl"}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={valor}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="inline-block"
          >
            {valor}
          </motion.span>
        </AnimatePresence>
        {sufijo && <span className="ml-1 text-xs font-medium text-white/40">{sufijo}</span>}
      </div>
      <button type="button" aria-label="Sumar" onClick={() => cambiar(paso)} disabled={valor >= max} className={`btn-ghost !p-0 ${btn}`}>
        <Plus className={grande ? "size-7" : "size-4"} />
      </button>
    </div>
  );
}
