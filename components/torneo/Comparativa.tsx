"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { filasComparativa } from "@/lib/torneo/estadisticas";
import type { MarcadorVivo } from "@/types/torneo";

/**
 * Comparativa de las dos duplas, estilo transmisión de Premier Padel: el valor de cada dupla a
 * los lados, el nombre de la estadística al medio y una barra que crece hacia cada lado.
 * `tv` agranda todo para la pantalla de la pista; `corta` deja solo las principales.
 */
export function Comparativa({ m, tv = false, corta = false, nombres }: { m: MarcadorVivo; tv?: boolean; corta?: boolean; nombres?: [string, string] }) {
  const filas = useMemo(() => filasComparativa(m, corta), [m, corta]);
  return (
    <div className={tv ? "space-y-4" : "space-y-3"}>
      {nombres && (
        <div className={clsx("flex items-center justify-between font-display font-bold", tv ? "text-2xl" : "text-sm")}>
          <span className="min-w-0 truncate text-lima">{nombres[0]}</span>
          <span className="min-w-0 truncate text-right text-cielo">{nombres[1]}</span>
        </div>
      )}
      {filas.map((f) => {
        const total = f.a + f.b || 1;
        const mejorA = f.menosEsMejor ? f.a < f.b : f.a > f.b;
        const mejorB = f.menosEsMejor ? f.b < f.a : f.b > f.a;
        return (
          <div key={f.t}>
            <div className={clsx("flex items-baseline justify-between", tv ? "text-xl" : "text-sm")}>
              <span className={clsx("font-display font-bold tabular", tv ? "w-24 text-4xl" : "w-14 text-lg", mejorA ? "text-lima" : "text-white/70")}>{f.ta ?? f.a}</span>
              <span className={clsx("text-center font-semibold uppercase", tv ? "tracking-[0.15em] text-white/60" : "text-xs tracking-wide text-white/55")}>{f.t}</span>
              <span className={clsx("text-right font-display font-bold tabular", tv ? "w-24 text-4xl" : "w-14 text-lg", mejorB ? "text-cielo" : "text-white/70")}>{f.tb ?? f.b}</span>
            </div>
            <div className={clsx("mt-1 flex gap-1", tv ? "h-2.5" : "h-1.5")}>
              <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-white/5">
                <motion.div className="h-full rounded-full bg-lima" initial={{ width: 0 }} animate={{ width: `${(f.a / total) * 100}%` }} />
              </div>
              <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                <motion.div className="h-full rounded-full bg-cielo" initial={{ width: 0 }} animate={{ width: `${(f.b / total) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
