"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

const COLORES = ["#7FE302", "#FFFFFF", "#5CC8FF", "#9BF03A", "#FF5C7A"];

/** Lluvia de confeti ligera (sin dependencias) para celebrar fin de ronda / campeón. */
export function Confetti({ activo, piezas = 70 }: { activo: boolean; piezas?: number }) {
  const datos = useMemo(
    () =>
      Array.from({ length: piezas }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.4,
        dur: 1.6 + Math.random() * 1.4,
        rot: Math.random() * 720 - 360,
        color: COLORES[i % COLORES.length],
        w: 6 + Math.random() * 6,
        drift: Math.random() * 30 - 15,
      })),
    [piezas, activo],
  );
  return (
    <AnimatePresence>
      {activo && (
        <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
          {datos.map((d) => (
            <motion.span
              key={d.id}
              className="absolute top-0 block rounded-[2px]"
              style={{ left: `${d.x}%`, width: d.w, height: d.w * 0.45, background: d.color }}
              initial={{ y: -20, opacity: 1, rotate: 0, x: 0 }}
              animate={{ y: "105vh", rotate: d.rot, x: `${d.drift}vw`, opacity: [1, 1, 0.8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: d.dur, delay: d.delay, ease: [0.2, 0.6, 0.4, 1] }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
