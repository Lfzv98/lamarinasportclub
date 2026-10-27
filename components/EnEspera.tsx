"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { AvatarPareja } from "@/components/Avatar";
import { nombreCompleto } from "@/lib/scoring";
import type { EventoAmericano, Ronda } from "@/types/americano";

export interface Espera {
  id: string;
  nombre: string;
  nombres: string[];
  /** Nombre y apellido completos de cada jugador (TV). */
  completo: string;
  fotos: (string | null | undefined)[];
  /** Próxima ronda en la que juega (null si ya no le toca). */
  vuelve: number | null;
}

/** Duplas (o jugadores) que esperan esta ronda y cuándo vuelven a jugar. */
export function enEspera(evento: EventoAmericano, ronda: Ronda): Espera[] {
  const porId = new Map(evento.jugadores.map((j) => [j.id, j]));
  const siguiente = (id: string) => evento.rondas.find((r) => r.numero > ronda.numero && r.partidos.length > 0 && !r.descansanIds.includes(id))?.numero ?? null;
  return ronda.descansanIds.map((id) => {
    if (evento.modalidad === "DUPLA_FIJA") {
      const p = evento.parejas.find((x) => x.id === id);
      const js = (p?.jugadorIds ?? []).map((j) => porId.get(j));
      return { id, nombre: p?.nombre ?? id, nombres: js.map((j) => j?.nombre ?? "?"), completo: js.map((j) => nombreCompleto(j)).join(" / "), fotos: js.map((j) => j?.fotoUrl), vuelve: siguiente(id) };
    }
    const j = porId.get(id);
    return { id, nombre: j ? `${j.nombre}${j.apellido ? ` ${j.apellido.charAt(0)}.` : ""}` : id, nombres: [j?.nombre ?? "?"], completo: j ? nombreCompleto(j) : id, fotos: [j?.fotoUrl], vuelve: siguiente(id) };
  });
}

/** Apartado "En espera" del cuadro en vivo: quién no juega esta ronda y cuándo entra. */
export function EnEspera({ evento, ronda }: { evento: EventoAmericano; ronda: Ronda }) {
  const lista = enEspera(evento, ronda);
  if (!lista.length) return null;
  const dupla = evento.modalidad === "DUPLA_FIJA";
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass mt-4 rounded-3xl border-amber-300/15 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-base font-bold text-amber-200">
          <Coffee className="size-4" /> {dupla ? (lista.length === 1 ? "Dupla en espera" : "Duplas en espera") : "En espera"}
        </p>
        <span className="text-xs text-white/40">
          {lista.length} {dupla ? (lista.length === 1 ? "dupla" : "duplas") : lista.length === 1 ? "jugador" : "jugadores"} · Ronda {ronda.numero}
        </span>
      </div>
      <ul className={clsx("grid gap-2", dupla ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {lista.map((e) => (
          <li key={e.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 py-2">
            <AvatarPareja nombres={e.nombres} fotos={e.fotos} size={dupla ? 30 : 28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.nombre}</p>
              <p className="text-[11px] text-white/45">{e.vuelve ? `Juega en la ronda ${e.vuelve}` : "No le quedan rondas"}</p>
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
