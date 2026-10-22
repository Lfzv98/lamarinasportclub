"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useId } from "react";
import { vibrar } from "@/lib/feedback";

export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  className,
}: {
  opciones: { id: T; label: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={clsx("glass flex rounded-2xl p-1", className)} role="radiogroup">
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => {
              vibrar(8);
              onChange(o.id);
            }}
            className={clsx("relative flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition", activo ? "text-noche" : "text-white/70 hover:text-white")}
          >
            {activo && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-neon" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
