"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { vibrar } from "@/lib/feedback";
import { pasosTorneo } from "@/lib/torneo/pasos";
import type { Torneo } from "@/types/torneo";

const CLAVE = "lamarina-pasos-abierto";

/**
 * Guía del operador: los 7 pasos del torneo en orden, en cuál va, qué falta y por qué cada paso
 * va donde va. Abierta mientras se prepara el torneo; plegada (y recordada) una vez que se juega.
 */
export function PasosTorneo({ torneo }: { torneo: Torneo }) {
  const pasos = pasosTorneo(torneo);
  const actual = pasos.find((p) => p.estado === "ACTUAL");
  const hechos = pasos.filter((p) => p.estado === "HECHO").length;
  const [abierto, setAbierto] = useState<boolean | null>(null);
  const [porQue, setPorQue] = useState<number | null>(null);

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(`${CLAVE}:${torneo.id}`);
    } catch {
      /* sin almacenamiento */
    }
    setAbierto(guardado ? guardado === "1" : (actual?.n ?? 7) < 6);
    // Solo al abrir el torneo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneo.id]);

  const alternar = () => {
    vibrar(6);
    const v = !abierto;
    setAbierto(v);
    try {
      localStorage.setItem(`${CLAVE}:${torneo.id}`, v ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <section className="glass mt-2 overflow-hidden rounded-3xl" aria-label="Pasos del torneo">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={alternar} aria-expanded={!!abierto}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-neon">
          <Route className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-white/45">
            {actual ? `Paso ${actual.n} de 7` : "Torneo completo"}
          </span>
          <span className="block truncate font-display text-lg font-bold">{actual ? actual.titulo : "Los 7 pasos están hechos"}</span>
        </span>
        <span className="hidden gap-1 sm:flex" aria-hidden>
          {pasos.map((p) => (
            <span key={p.n} className={clsx("h-1.5 w-5 rounded-full", p.estado === "HECHO" ? "bg-neon" : p.estado === "ACTUAL" ? "bg-amber-300" : "bg-white/15")} />
          ))}
        </span>
        <span className="text-xs text-white/45 sm:hidden">{hechos}/7</span>
        <ChevronDown className={clsx("size-5 shrink-0 text-white/50 transition", abierto && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ol initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden px-4 pb-4">
            {pasos.map((p) => {
              const bloqueado = p.estado === "PENDIENTE" && actual && p.n > actual.n;
              return (
                <li key={p.n} className="relative flex gap-3 pb-4 last:pb-0" data-paso={p.n} data-estado={p.estado}>
                  {p.n < 7 && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-white/10" aria-hidden />}
                  <span
                    className={clsx(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      p.estado === "HECHO" ? "bg-neon text-noche" : p.estado === "ACTUAL" ? "bg-amber-300 text-marino-2" : "bg-white/10 text-white/50",
                    )}
                  >
                    {p.estado === "HECHO" ? <Check className="size-4" /> : p.n}
                  </span>
                  <div className={clsx("min-w-0 flex-1", bloqueado && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="font-semibold">{p.titulo}</p>
                      <p className="text-xs text-white/50">{p.detalle}</p>
                    </div>
                    {p.aviso && (p.estado !== "PENDIENTE" || !bloqueado) && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-amber-200">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" /> {p.aviso}
                      </p>
                    )}
                    {bloqueado && <p className="mt-1 text-xs text-white/45">Después de «{actual!.titulo}».</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      {(p.estado === "ACTUAL" || p.aviso) && !bloqueado && (
                        <Link href={`/torneos/${torneo.id}${p.ir}`} className={clsx("!py-1.5 !text-xs", p.estado === "ACTUAL" ? "btn-neon" : "btn-ghost")}>
                          {p.boton} <ChevronRight className="size-3.5" />
                        </Link>
                      )}
                      <button className="text-xs font-semibold text-cielo" onClick={() => setPorQue(porQue === p.n ? null : p.n)}>
                        {porQue === p.n ? "Ocultar" : "¿Por qué va aquí?"}
                      </button>
                    </div>
                    {porQue === p.n && <p className="mt-1.5 rounded-xl bg-white/5 p-2.5 text-xs text-white/70">{p.porQue}</p>}
                  </div>
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}
