"use client";

import clsx from "clsx";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Crown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import type { FilaPosicion, TablaPosiciones } from "@/types/americano";

type Cambios = Record<string, number>;

/** Recuerda la posición anterior de cada fila para mostrar flechas ↑↓ unos segundos. */
function useCambios(filas: FilaPosicion[]): Cambios {
  const previas = useRef<Record<string, number> | null>(null);
  const [cambios, setCambios] = useState<Cambios>({});
  const firma = filas.map((f) => `${f.entidadId}:${f.posicion}`).join(",");

  useEffect(() => {
    const ahora = Object.fromEntries(filas.map((f) => [f.entidadId, f.posicion]));
    if (previas.current) {
      const delta: Cambios = {};
      for (const f of filas) {
        const antes = previas.current[f.entidadId];
        if (antes && antes !== f.posicion) delta[f.entidadId] = antes - f.posicion;
      }
      if (Object.keys(delta).length) {
        setCambios(delta);
        const t = setTimeout(() => setCambios({}), 4000);
        previas.current = ahora;
        return () => clearTimeout(t);
      }
    }
    previas.current = ahora;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  return cambios;
}

const MEDALLAS = ["from-amber-200 to-amber-500 text-noche", "from-slate-100 to-slate-400 text-noche", "from-orange-300 to-orange-700 text-noche"];

export function Posicion({ n, grande = false }: { n: number; grande?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tabular",
        grande ? "size-12 text-xl" : "size-7 text-xs sm:size-8 sm:text-sm",
        n <= 3 ? `bg-gradient-to-br ${MEDALLAS[n - 1]}` : "bg-white/5 text-white/70",
      )}
    >
      {n}
    </span>
  );
}

function Delta({ v, grande }: { v?: number; grande?: boolean }) {
  return (
    <AnimatePresence>
      {v ? (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className={clsx("flex items-center font-bold", grande ? "text-lg" : "text-xs", v > 0 ? "text-lima" : "text-coral")}
        >
          {v > 0 ? <ArrowUp className={grande ? "size-5" : "size-3.5"} /> : <ArrowDown className={grande ? "size-5" : "size-3.5"} />}
          {Math.abs(v)}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

const COLS = "grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,1.6rem)_2.1rem_2.3rem] sm:grid-cols-[2.75rem_minmax(0,1fr)_repeat(6,3rem)_3.5rem]";
const COLS_TV = "grid-cols-[4rem_minmax(0,1fr)_repeat(6,5rem)_6rem]";

/** Tabla de posiciones con animación de cambio de posición (layout animations). */
export function Leaderboard({ tabla, nombresPorFila, modoTV = false, limite }: { tabla: TablaPosiciones; nombresPorFila: (f: FilaPosicion) => string[]; modoTV?: boolean; limite?: number }) {
  const cambios = useCambios(tabla.filas);
  const filas = limite ? tabla.filas.slice(0, limite) : tabla.filas;
  const cols = modoTV ? COLS_TV : COLS;
  const th = clsx("text-center font-semibold uppercase tracking-wider text-white/40", modoTV ? "text-base" : "text-[10px] sm:text-[11px]");

  return (
    <div className={clsx("glass overflow-hidden", modoTV ? "rounded-[2rem]" : "rounded-3xl")}>
      <div className={clsx("grid items-center gap-1 border-b border-white/5", cols, modoTV ? "px-6 py-4" : "px-2 py-3 sm:px-4")}>
        <span className={th}>#</span>
        <span className={clsx(th, "text-left")}>{tabla.tipo === "PAREJA" ? "Pareja" : "Jugador"}</span>
        <span className={th}>PJ</span>
        <span className={th}>PG</span>
        <span className={th}>PP</span>
        <span className={clsx(th, !modoTV && "hidden sm:block")}>PF</span>
        <span className={clsx(th, !modoTV && "hidden sm:block")}>PC</span>
        <span className={th}>+/-</span>
        <span className={clsx(th, "!text-neon")}>PTS</span>
      </div>
      <LayoutGroup>
        <ul>
          {filas.map((f) => {
            const delta = cambios[f.entidadId];
            const td = clsx("text-center tabular", modoTV ? "text-2xl font-semibold" : "text-[13px] sm:text-sm");
            return (
              <motion.li
                key={f.entidadId}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={clsx(
                  "grid items-center gap-1 border-b border-white/[0.04] last:border-0",
                  cols,
                  modoTV ? "px-6 py-3" : "px-2 py-2.5 sm:px-4",
                  f.posicion === 1 && "bg-gradient-to-r from-neon/10 to-transparent",
                  delta && delta > 0 && "bg-lima/[0.06]",
                )}
              >
                <span className="flex flex-col items-center">
                  <Posicion n={f.posicion} grande={modoTV} />
                </span>
                <span className={clsx("flex min-w-0 items-center", modoTV ? "gap-3" : "gap-2")}>
                  <AvatarPareja nombres={nombresPorFila(f)} fotos={f.fotoUrls} size={modoTV ? 48 : 28} />
                  <span className={clsx("min-w-0 truncate font-semibold", modoTV ? "text-2xl" : "text-[13px] sm:text-sm")}>{f.nombre}</span>
                  {f.retirado && <span className="chip shrink-0 !px-2 !py-0.5 text-[10px] text-white/50">Retiro</span>}
                  {f.posicion === 1 && f.pj > 0 && <Crown className={clsx("shrink-0 text-neon", modoTV ? "size-6" : "size-4")} />}
                  <Delta v={delta} grande={modoTV} />
                </span>
                <span className={td}>{f.pj}</span>
                <span className={td}>{f.pg}</span>
                <span className={clsx(td, "text-white/60")}>{f.pp}</span>
                <span className={clsx(td, "text-white/60", !modoTV && "hidden sm:block")}>{f.puntosAFavor}</span>
                <span className={clsx(td, "text-white/60", !modoTV && "hidden sm:block")}>{f.puntosEnContra}</span>
                <span className={clsx(td, f.diferencia > 0 ? "text-neon" : f.diferencia < 0 ? "text-coral" : "text-white/50")}>
                  {f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia}
                </span>
                <motion.span key={f.puntos} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={clsx("text-center font-display font-bold tabular text-neon", modoTV ? "text-3xl" : "text-base")}>
                  {f.puntos}
                </motion.span>
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>
    </div>
  );
}
