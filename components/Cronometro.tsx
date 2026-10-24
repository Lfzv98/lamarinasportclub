"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { formatoReloj } from "@/lib/feedback";
import type { Ronda } from "@/types/americano";

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

/** Sin cronómetro: en el lugar del reloj muestra cuántos marcadores de la ronda ya se cargaron. */
export function MarcadorRonda({ ronda, total, size = 168, className }: { ronda: Ronda; total: number; size?: number; className?: string }) {
  const hechos = ronda.partidos.filter((p) => p.estado === "FINALIZADO").length;
  const n = ronda.partidos.length;
  const progreso = n ? hechos / n : 0;
  const r = 46;
  const c = 2 * Math.PI * r;
  const estado = n && hechos === n ? "Ronda completa" : ronda.estado === "PENDIENTE" ? "Por empezar" : "Marcadores";
  return (
    <div className={clsx("relative", className)} style={{ width: size, height: size }} aria-label={`Ronda ${ronda.numero} de ${total}: ${estado}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#7FE302"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - progreso) }}
          style={{ filter: "drop-shadow(0 0 6px #7FE30288)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold tabular leading-none" style={{ fontSize: size * 0.24 }}>
          {hechos}
          <span className="text-white/30" style={{ fontSize: size * 0.14 }}>
            /{n}
          </span>
        </span>
        <span className="mt-1.5 font-semibold uppercase tracking-[0.2em] text-white/40" style={{ fontSize: Math.max(10, size * 0.06) }}>
          {estado}
        </span>
      </div>
    </div>
  );
}
