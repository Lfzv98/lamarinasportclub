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
        grande ? "size-14 text-2xl" : "size-7 text-xs sm:size-8 sm:text-sm",
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
          className={clsx("flex items-center font-bold", grande ? "text-xl" : "text-xs", v > 0 ? "text-lima" : "text-coral")}
        >
          {v > 0 ? <ArrowUp className={grande ? "size-6" : "size-3.5"} /> : <ArrowDown className={grande ? "size-6" : "size-3.5"} />}
          {Math.abs(v)}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

const COLS = "grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,1.6rem)_2.1rem_2.3rem] sm:grid-cols-[2.75rem_minmax(0,1fr)_repeat(6,3rem)_3.5rem]";
const COLS_TV = "grid-cols-[4.5rem_minmax(0,1fr)_repeat(6,4.75rem)_6.5rem]";
// Celular o tablet chica: sin PF ni PC para que el nombre tenga espacio (nunca menos de 9rem).
const COLS_TV_ESTRECHO = "grid-cols-[3rem_minmax(9rem,1fr)_repeat(4,3.25rem)_4rem]";

/** Tabla de posiciones con animación de cambio de posición (layout animations). */
/** `estrecho`: modo TV en una pantalla angosta (celular), con columnas más justas. */
export function Leaderboard({ tabla, nombresPorFila, modoTV = false, estrecho = false, limite }: { tabla: TablaPosiciones; nombresPorFila: (f: FilaPosicion) => string[]; modoTV?: boolean; estrecho?: boolean; limite?: number }) {
  const cambios = useCambios(tabla.filas);
  const filas = limite ? tabla.filas.slice(0, limite) : tabla.filas;
  const cols = modoTV ? (estrecho ? COLS_TV_ESTRECHO : COLS_TV) : COLS;
  const sinPfPc = modoTV ? (estrecho ? "hidden" : undefined) : "hidden sm:block";
  const th = clsx("text-center font-semibold uppercase tracking-wider text-white/40", modoTV ? "text-lg" : "text-[10px] sm:text-[11px]");

  return (
    <div className={clsx("glass overflow-hidden", modoTV ? "rounded-[2rem]" : "rounded-3xl")}>
      <div className={clsx("grid items-center gap-1 border-b border-white/5", cols, modoTV ? "px-6 py-4" : "px-2 py-3 sm:px-4")}>
        <span className={th}>#</span>
        <span className={clsx(th, "text-left")}>{tabla.tipo === "PAREJA" ? "Pareja" : "Jugador"}</span>
        <span className={th}>PJ</span>
        <span className={th}>PG</span>
        <span className={th}>PP</span>
        <span className={clsx(th, sinPfPc)}>PF</span>
        <span className={clsx(th, sinPfPc)}>PC</span>
        <span className={th}>+/-</span>
        <span className={clsx(th, "!text-neon")}>PTS</span>
      </div>
      <LayoutGroup>
        <ul>
          {filas.map((f) => {
            const delta = cambios[f.entidadId];
            const td = clsx("text-center tabular", modoTV ? (estrecho ? "text-2xl font-semibold" : "text-[2rem] font-semibold") : "text-[13px] sm:text-sm");
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
                  <AvatarPareja nombres={nombresPorFila(f)} fotos={f.fotoUrls} dupla={f.fotoDupla} size={modoTV ? (estrecho ? 48 : 54) : 28} />
                  {modoTV ? (
                    // En la TV va el nombre completo de cada jugador, uno por línea, sin cortar.
                    <span className={clsx("min-w-0 break-words font-semibold leading-tight", estrecho ? (nombresPorFila(f).length > 1 ? "text-xl" : "text-2xl") : nombresPorFila(f).length > 1 ? "text-[1.7rem]" : "text-[2rem]")}>
                      {nombresPorFila(f).map((n, i) => (
                        <span key={i} className="block">{n}</span>
                      ))}
                    </span>
                  ) : (
                    nombresPorFila(f).length > 1 ? (
                      // Dupla en el celular: un jugador por línea para que se lean completos.
                      <span className="min-w-0 text-[13px] font-semibold leading-tight sm:text-sm">
                        {nombresPorFila(f).map((n, i) => (
                          <span key={i} className="block truncate">{n}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="min-w-0 truncate text-[13px] font-semibold sm:text-sm">{f.nombre}</span>
                    )
                  )}
                  {f.retirado && <span className="chip shrink-0 !px-2 !py-0.5 text-[10px] text-white/50">Retiro</span>}
                  {f.posicion === 1 && f.pj > 0 && <Crown className={clsx("shrink-0 text-neon", modoTV ? "size-7" : "size-4")} />}
                  <Delta v={delta} grande={modoTV} />
                </span>
                <span className={td}>{f.pj}</span>
                <span className={td}>{f.pg}</span>
                <span className={clsx(td, "text-white/60")}>{f.pp}</span>
                <span className={clsx(td, "text-white/60", sinPfPc)}>{f.puntosAFavor}</span>
                <span className={clsx(td, "text-white/60", sinPfPc)}>{f.puntosEnContra}</span>
                <span className={clsx(td, f.diferencia > 0 ? "text-neon" : f.diferencia < 0 ? "text-coral" : "text-white/50")}>
                  {f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia}
                </span>
                <motion.span key={f.puntos} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={clsx("text-center font-display font-bold tabular text-neon", modoTV ? (estrecho ? "text-3xl" : "text-[2.6rem]") : "text-base")}>
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
