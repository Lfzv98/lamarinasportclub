"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Swords, Users } from "lucide-react";
import { formatoNombre, nombreInscrito, progreso, RAMAS, campeon } from "@/lib/tenis/torneo";
import type { PartidoTenis, TorneoTenis } from "@/types/tenis";
import { MarcadorTenis } from "./Marcador";
import { ChipSuperficie, EstadoTenisBadge, fechaTenis } from "./piezas";

export function TorneoTenisCard({ torneo: t, index = 0 }: { torneo: TorneoTenis; index?: number }) {
  const prog = progreso(t);
  const pct = prog.total ? Math.round((prog.jugados / prog.total) * 100) : 0;
  const rey = campeon(t);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link href={`/tenis/t/${t.id}`} className="glass group block rounded-3xl p-5 transition hover:border-[var(--sup)] active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <EstadoTenisBadge estado={t.estado} />
              <ChipSuperficie superficie={t.superficie} />
            </div>
            <h3 className="truncate font-display text-lg font-semibold">{t.nombre}</h3>
            <p className="mt-1 truncate text-sm text-white/50">
              {t.modalidad === "SINGLES" ? "Singles" : "Dobles"} {RAMAS[t.rama].toLowerCase()} · {t.categoria} · {formatoNombre(t)}
            </p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-white/30 transition group-hover:translate-x-1" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {fechaTenis(t.fecha)}</span>
          <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {t.inscritos.length} {t.modalidad === "SINGLES" ? "jugadores" : "parejas"}</span>
          {prog.enJuego > 0 && <span className="flex items-center gap-1.5 text-neon"><Swords className="size-3.5" /> {prog.enJuego} en cancha</span>}
          {prog.total > 1 && <span className="ml-auto font-semibold text-white/70">{prog.jugados}/{prog.total} partidos</span>}
        </div>
        {rey ? (
          <p className="mt-3 truncate text-sm font-semibold">🏆 {nombreInscrito(t, rey)}</p>
        ) : (
          prog.total > 1 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
              <motion.div className="h-full rounded-full" style={{ background: "var(--sup, #a6e84a)" }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
          )
        )}
      </Link>
    </motion.div>
  );
}

/** Partido en juego (o llamado) con su marcador vivo. */
export function PartidoVivoCard({ torneo: t, partido: p }: { torneo: TorneoTenis; partido: PartidoTenis }) {
  return (
    <Link href={`/tenis/t/${t.id}/p/${p.id}`} className="glass block rounded-3xl p-4 transition hover:border-[var(--sup)] active:scale-[0.99]">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/50">
        <span className="truncate">
          {p.cancha ? <b className="mr-1.5 text-white/80">Cancha {p.cancha}</b> : null}
          {t.nombre}
        </span>
        {p.estado === "LLAMADO" ? <span className="chip text-amber-200">Llamado</span> : <ChipSuperficie superficie={t.superficie} />}
      </div>
      <MarcadorTenis torneo={t} partido={p} />
    </Link>
  );
}

export function partidosVivos(torneos: TorneoTenis[]) {
  return torneos.flatMap((t) => t.partidos.filter((p) => p.estado === "EN_JUEGO" || p.estado === "LLAMADO").map((p) => ({ t, p })));
}
