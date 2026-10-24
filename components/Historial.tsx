"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Coffee, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PistaLabel } from "@/components/PistaLabel";
import { ganador, nombreJugador } from "@/lib/scoring";
import type { EventoAmericano, Partido } from "@/types/americano";

/**
 * Historial de marcadores: todas las rondas con sus resultados. Se puede filtrar
 * por jugador (o dupla) para revisar partido a partido de dónde salen sus puntos.
 */
export function Historial({ evento }: { evento: EventoAmericano }) {
  const dupla = evento.modalidad === "DUPLA_FIJA";
  const porId = useMemo(() => new Map(evento.jugadores.map((j) => [j.id, j])), [evento.jugadores]);
  const [filtro, setFiltro] = useState("");
  const opciones = useMemo(
    () =>
      (dupla
        ? evento.parejas.map((p) => ({ id: p.id, nombre: p.nombre ?? p.jugadorIds.map((id) => porId.get(id)?.nombre).join(" / ") }))
        : evento.jugadores.map((j) => ({ id: j.id, nombre: nombreJugador(j) }))
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [dupla, evento.parejas, evento.jugadores, porId],
  );

  const juega = (p: Partido, id: string) => (dupla ? p.parejaA.id === id || p.parejaB.id === id : [...p.parejaA.jugadorIds, ...p.parejaB.jugadorIds].includes(id));
  const rondas = evento.rondas
    .filter((r) => r.numero <= evento.rondaActual || r.partidos.some((p) => p.resultado))
    .map((r) => ({ ...r, partidos: filtro ? r.partidos.filter((p) => juega(p, filtro)) : r.partidos }))
    .reverse();

  // Resumen del filtrado: partidos, ganados y marcador acumulado.
  const resumen = useMemo(() => {
    if (!filtro) return null;
    let pj = 0, pg = 0, pp = 0, pf = 0, pc = 0;
    for (const r of evento.rondas)
      for (const p of r.partidos) {
        if (!p.resultado || !juega(p, filtro)) continue;
        const enA = dupla ? p.parejaA.id === filtro : p.parejaA.jugadorIds.includes(filtro);
        const g = ganador(evento.puntuacion, p.resultado) * (enA ? 1 : -1);
        pj++;
        if (g > 0) pg++;
        else if (g < 0) pp++;
        pf += enA ? p.resultado.puntosA : p.resultado.puntosB;
        pc += enA ? p.resultado.puntosB : p.resultado.puntosA;
      }
    return { pj, pg, pp, pf, pc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, evento]);

  const nombresLado = (ids: string[]) => ids.map((id) => nombreJugador(porId.get(id))).join(" / ");

  return (
    <div>
      <label className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
        <Search className="size-4 shrink-0 text-white/40" />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full bg-transparent py-1 text-sm font-semibold outline-none [color-scheme:dark]"
          aria-label={dupla ? "Filtrar por dupla" : "Filtrar por jugador"}
        >
          <option value="">Todos los partidos</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>

      {resumen && (
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
          {[
            ["PJ", resumen.pj],
            ["PG", resumen.pg],
            ["PP", resumen.pp],
            ["PF", resumen.pf],
            ["PC", resumen.pc],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-2xl py-2">
              <p className="font-display text-lg font-bold tabular">{v}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{k}</p>
            </div>
          ))}
        </div>
      )}

      {rondas.every((r) => r.partidos.length === 0) && (
        <p className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-white/40">
          <History className="size-6" /> Todavía no hay marcadores cargados.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <AnimatePresence initial={false}>
          {rondas.map((r) => {
            const descansa = filtro && r.descansanIds.includes(filtro);
            if (!r.partidos.length && !descansa) return null;
            return (
              <motion.section key={r.numero} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="label !mb-2">
                  Ronda {r.numero}
                  {r.numero === evento.rondaActual && evento.estado !== "FINALIZADO" && <span className="ml-2 text-neon">· en curso</span>}
                </p>
                {descansa && (
                  <p className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-amber-200">
                    <Coffee className="size-4" /> En espera esta ronda
                  </p>
                )}
                <ul className="space-y-2">
                  {r.partidos.map((p) => {
                    const res = p.resultado;
                    const g = res ? ganador(evento.puntuacion, res) : null;
                    const lado = (l: "A" | "B") => {
                      const par = l === "A" ? p.parejaA : p.parejaB;
                      const gana = g === (l === "A" ? 1 : -1);
                      const resaltado = filtro && (dupla ? par.id === filtro : par.jugadorIds.includes(filtro));
                      return (
                        <div className="flex items-center gap-2">
                          <span className={clsx("min-w-0 flex-1 truncate text-sm", gana ? "font-bold text-white" : "text-white/70", resaltado && "underline decoration-neon/60 underline-offset-4")}>
                            {dupla ? par.nombre ?? nombresLado(par.jugadorIds) : nombresLado(par.jugadorIds)}
                          </span>
                          {res && <span className={clsx("font-display text-xl font-bold tabular", gana ? "text-neon" : "text-white/60")}>{l === "A" ? res.puntosA : res.puntosB}</span>}
                        </div>
                      );
                    };
                    return (
                      <li key={p.id} className="glass rounded-2xl px-4 py-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <PistaLabel evento={evento} numero={p.pista} className="text-[11px] tracking-[0.2em]" icono="size-3" />
                          {res ? (
                            <span className="flex items-center gap-1 text-[11px] text-white/45">
                              <Check className="size-3 text-neon" />
                              {res.sets?.length ? res.sets.map((x) => `${x.a}-${x.b}`).join(" · ") : "Final"}
                              {res.tieBreak && ` · tie ${res.tieBreak.a}-${res.tieBreak.b}`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/40">{p.estado === "EN_JUEGO" ? "Jugando" : "Por jugar"}</span>
                          )}
                        </div>
                        {lado("A")}
                        {lado("B")}
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
