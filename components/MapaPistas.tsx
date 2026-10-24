"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Sun, Warehouse } from "lucide-react";
import { vibrar } from "@/lib/feedback";
import type { PistaClub } from "@/types/americano";

/**
 * Las pistas del club en fila, flotando en perspectiva. Tocar una pista o su
 * tarjeta la suma o la quita del evento.
 */
export function MapaPistas({ pistas, seleccion, onToggle }: { pistas: PistaClub[]; seleccion: number[]; onToggle: (numero: number) => void }) {
  const tocar = (n: number) => {
    vibrar(10);
    onToggle(n);
  };
  return (
    <div>
      <FilaPistas pistas={pistas} seleccion={seleccion} onToggle={tocar} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-pista" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-pista-sel ring-2 ring-lima" /> En el evento
        </span>
        <span className="flex items-center gap-1.5">
          <Warehouse className="size-3 text-cielo" /> Techada
        </span>
        <span className="flex items-center gap-1.5">
          <Sun className="size-3 text-amber-300" /> Al aire libre
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {pistas.map((c) => {
          const on = seleccion.includes(c.numero);
          return (
            <motion.button
              key={c.numero}
              type="button"
              layout
              whileTap={{ scale: 0.96 }}
              onClick={() => tocar(c.numero)}
              aria-pressed={on}
              aria-label={`${c.nombre} ${c.techada ? "techada" : "al aire libre"}`}
              className={clsx(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                on ? "seleccion sobre-marca" : "glass hover:border-white/20",
              )}
            >
              <span
                className={clsx(
                  "flex size-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold transition",
                  on ? "bg-lima text-noche shadow-[0_0_0_4px_rgba(207,243,91,0.25)]" : "bg-pista text-blanco",
                )}
              >
                {on ? <Check className="size-5" strokeWidth={3} /> : c.numero}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{c.nombre}</span>
                <span className={clsx("flex items-center gap-1 text-xs", on ? "font-semibold text-lima" : "text-white/50")}>
                  {c.techada ? <Warehouse className="size-3" /> : <Sun className="size-3" />}
                  {on ? "En el evento" : c.techada ? "Techada" : "Aire libre"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- pistas flotantes en fila ---------- */

function FilaPistas({ pistas, seleccion, onToggle }: { pistas: PistaClub[]; seleccion: number[]; onToggle: (n: number) => void }) {
  return (
    <div className="relative">
      {/* luz ambiente detrás de la fila */}
      <div className="pointer-events-none absolute inset-x-10 top-1/3 h-1/2 rounded-full bg-marca-2/25 blur-3xl" />
      <div className="relative grid grid-cols-5 gap-3 px-1 pb-6 pt-11 min-[400px]:gap-4 sm:gap-8 sm:px-2 sm:pt-12 lg:gap-10">
        {pistas.map((c, i) => (
          <PistaFlotante key={c.numero} c={c} on={seleccion.includes(c.numero)} indice={i} onToggle={onToggle} />
        ))}
      </div>
      {/* línea de piso con reflejo */}
      <div className="pointer-events-none mx-auto -mt-3 h-px w-11/12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}

function PistaFlotante({ c, on, indice, onToggle }: { c: PistaClub; on: boolean; indice: number; onToggle: (n: number) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.07 * indice, type: "spring", stiffness: 140, damping: 16 }}
      className="relative min-w-0"
    >
      {/* sombra en el piso y luz lima de la elegida */}
      <motion.div
        aria-hidden
        className="absolute inset-x-[8%] bottom-1 h-6 rounded-[50%] bg-[#02041a] blur-md"
        animate={{ opacity: on ? 0.4 : 0.6 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-10 rounded-[50%] bg-lima blur-xl"
        initial={false}
        animate={{ opacity: on ? 0.35 : 0 }}
        transition={{ duration: 0.5 }}
      />

      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => onToggle(c.numero)}
        className="group relative block w-full cursor-pointer"
        animate={{ y: [-6, -12, -6] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.97 }}
      >
        {/* número flotante */}
        <span className="absolute inset-x-0 -top-10 z-10 flex flex-col items-center">
          <span
            className={clsx(
              "flex size-7 items-center justify-center rounded-full border-2 font-display text-xs font-extrabold transition-colors sm:size-9 sm:text-base",
              on ? "border-marino-2 bg-lima text-marino-2 shadow-[0_0_16px_rgba(207,243,91,0.7)]" : "border-blanco bg-marino-2 text-blanco",
            )}
          >
            {c.numero}
          </span>
          <span className={clsx("h-3 w-px", on ? "bg-lima/80" : "bg-blanco/60")} />
        </span>

        {/* la pista inclinada en 3D, con su canto */}
        <span className="block [transform-style:preserve-3d]" style={{ transform: "perspective(520px) rotateX(40deg)", transformOrigin: "50% 60%" }}>
          <span
            className={clsx(
              "relative block aspect-[1/2] w-full overflow-hidden rounded-md border-2 transition-[border-color,box-shadow] duration-300",
              on ? "border-lima shadow-[0_0_22px_rgba(207,243,91,0.65)]" : "border-[#0f3a78] group-hover:border-[#5aa9ff]",
            )}
          >
            <Alfombra on={on} />
          </span>
          <span
            aria-hidden
            className={clsx("absolute inset-x-0 bottom-0 block h-2.5 origin-top rounded-b-sm", on ? "bg-[#1d6fd0]" : "bg-[#123f84]")}
            style={{ transform: "translateY(100%) rotateX(-90deg)" }}
          />
        </span>
      </motion.button>

      <p className={clsx("mt-3 flex items-center justify-center gap-1 text-[10px] font-semibold sm:text-[11px]", on ? "text-lima" : "text-white/45")}>
        {c.techada ? <Warehouse className="size-3" /> : <Sun className="size-3" />}
        <span className="hidden min-[400px]:inline">{c.techada ? "Techada" : "Aire libre"}</span>
      </p>
    </motion.div>
  );
}

/** Pista de pádel vista desde arriba: alfombra azul, líneas, red y vidrios. */
function Alfombra({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 100 200" className="block size-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={on ? "fp-sel" : "fp-azul"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={on ? "#6cc6ff" : "#2f86e0"} />
          <stop offset="1" stopColor={on ? "#2a8cf2" : "#1a5ab3"} />
        </linearGradient>
        <linearGradient id="fp-brillo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
          <animate attributeName="x1" values="-1;1" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0;2" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="y1" values="-1;1" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="y2" values="0;2" dur="3.2s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <rect width="100" height="200" fill={`url(#${on ? "fp-sel" : "fp-azul"})`} />
      {/* vidrios del fondo */}
      <rect width="100" height="14" fill="#fff" opacity="0.14" />
      <rect y="186" width="100" height="14" fill="#fff" opacity="0.1" />
      <g stroke="#fff" strokeOpacity="0.9" strokeWidth="1.6" fill="none">
        <rect x="4" y="4" width="92" height="192" strokeOpacity="0.55" />
        <line x1="4" y1="44" x2="96" y2="44" />
        <line x1="4" y1="156" x2="96" y2="156" />
        <line x1="50" y1="44" x2="50" y2="156" />
      </g>
      {/* red */}
      <rect x="0" y="97" width="100" height="6" fill="#071033" opacity="0.85" />
      <line x1="0" y1="97" x2="100" y2="97" stroke="#fff" strokeWidth="1.2" />
      {on && <rect width="100" height="200" fill="url(#fp-brillo)" />}
    </svg>
  );
}
