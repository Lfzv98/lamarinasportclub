"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { formatoReloj } from "@/lib/feedback";

export function Cronometro({
  restantes,
  progreso,
  corriendo,
  size = 168,
  className,
}: {
  restantes: number;
  progreso: number;
  corriendo: boolean;
  size?: number;
  className?: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const excedido = restantes < 0;
  const ultimoMinuto = !excedido && restantes <= 60;
  const color = excedido ? "#FF5C7A" : ultimoMinuto ? "#FFB020" : "#7FE302";
  return (
    <div className={clsx("relative", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (excedido ? 0 : progreso) }}
          transition={{ duration: 0.3, ease: "linear" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display font-bold tabular leading-none"
          style={{ fontSize: size * 0.22, color: excedido ? "#FF5C7A" : "#fff" }}
          animate={ultimoMinuto && corriendo ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ repeat: ultimoMinuto && corriendo ? Infinity : 0, duration: 1 }}
        >
          {excedido && "+"}
          {formatoReloj(restantes)}
        </motion.span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {excedido ? "Tiempo cumplido" : corriendo ? "Restante" : "En pausa"}
        </span>
      </div>
    </div>
  );
}
