"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, LayoutGrid, Trophy, Users } from "lucide-react";
import { categoriaLabel, METODOS, MODALIDADES } from "@/lib/categories";
import { progresoEvento } from "@/lib/evento";
import type { EventoAmericano } from "@/types/americano";

export function EstadoBadge({ estado }: { estado: EventoAmericano["estado"] }) {
  if (estado === "EN_CURSO")
    return (
      <span className="chip border-neon/30 bg-neon/10 text-neon">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-neon" />
        </span>
        En vivo
      </span>
    );
  if (estado === "FINALIZADO")
    return (
      <span className="chip">
        <Trophy className="size-3" /> Finalizado
      </span>
    );
  return <span className="chip text-cielo">Por comenzar</span>;
}

export function EventoCard({ evento, index = 0 }: { evento: EventoAmericano; index?: number }) {
  const prog = progresoEvento(evento);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <Link href={`/evento/${evento.id}`} className="glass group block rounded-3xl p-5 transition hover:border-neon/30 hover:bg-white/[0.06] active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={evento.estado} />
              <span className="chip">{categoriaLabel(evento.categoria)}</span>
            </div>
            <h3 className="truncate font-display text-lg font-semibold">{evento.nombre}</h3>
            <p className="mt-1 text-sm text-white/50">
              {MODALIDADES.find((m) => m.id === evento.modalidad)?.label} · {METODOS.find((m) => m.id === evento.puntuacion.metodo)?.label}
            </p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-neon" />
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {evento.jugadores.length}</span>
          <span className="flex items-center gap-1.5"><LayoutGrid className="size-3.5" /> {evento.pistas} pistas</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {new Date(evento.fecha + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
          <span className="ml-auto font-semibold text-white/70">Ronda {Math.min(evento.rondaActual, evento.totalRondas)}/{evento.totalRondas}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div className="h-full rounded-full bg-neon" initial={{ width: 0 }} animate={{ width: `${prog.pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </Link>
    </motion.div>
  );
}
