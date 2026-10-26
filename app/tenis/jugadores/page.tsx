"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { PelotaTenis } from "@/components/tenis/piezas";
import { useListaTenis, useTenis } from "@/lib/tenisStore";
import { claveNombre, especialidad, fichasJugadores, ordenar, pct, type FichaJugador } from "@/lib/tenis/jugadores";
import { SUPERFICIES } from "@/lib/tenis/torneo";
import type { Superficie } from "@/types/tenis";

/** Ranking de jugadores: todos los torneos, con su récord en cancha dura y en arcilla. */
export default function JugadoresTenisPage() {
  const torneos = useListaTenis();
  const hidratado = useTenis((s) => s.hidratado);
  const [sup, setSup] = useState<Superficie | null>(null);
  const [q, setQ] = useState("");
  const fichas = useMemo(() => fichasJugadores(torneos), [torneos]);
  const lista = ordenar(fichas, sup).filter((f) => !q || f.clave.includes(claveNombre(q)));
  const reyArcilla = ordenar(fichas, "ARCILLA").find((f) => f.por.ARCILLA.pj >= 2);
  const reyDura = ordenar(fichas, "DURA").find((f) => f.por.DURA.pj >= 2);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2 py-3">
        <Link href="/tenis" className="btn-ghost !p-2.5" aria-label="Tenis">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex-1" />
        <Logo compacto />
      </header>
      <p className="label !text-neon">Tenis · La Marina</p>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Jugadores</h1>
      <p className="mt-2 max-w-lg text-white/60">Victorias de todos los torneos, separadas por superficie. ¿Quién manda en la arcilla y quién en la cancha dura?</p>

      {(reyArcilla || reyDura) && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ["ARCILLA", reyArcilla],
            ["DURA", reyDura],
          ] as const).map(([s, f]) =>
            f ? (
              <motion.div
                key={s}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sobre-marca flex items-center gap-4 rounded-3xl p-5"
                style={{ background: `linear-gradient(135deg, ${SUPERFICIES[s].color}, ${SUPERFICIES[s].oscuro})` }}
              >
                <Avatar nombre={f.nombre} fotoUrl={f.fotoUrl} size={56} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">{s === "ARCILLA" ? "Manda en arcilla" : "Manda en cancha dura"}</p>
                  <p className="truncate font-display text-xl font-bold">{f.nombre}</p>
                  <p className="text-sm text-white/75">
                    {f.por[s].pg} ganados de {f.por[s].pj} · {Math.round(pct(f.por[s]) * 100)}%
                  </p>
                </div>
              </motion.div>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([null, "DURA", "ARCILLA"] as (Superficie | null)[]).map((s) => (
          <button
            key={s ?? "todas"}
            onClick={() => setSup(s)}
            className={clsx("chip !px-4 !py-2 !text-sm transition", sup === s && "!border-transparent font-semibold !text-blanco")}
            style={sup === s ? { background: s ? SUPERFICIES[s].color : "#2b3bd6" } : undefined}
          >
            {s ? SUPERFICIES[s].nombre : "Todas"}
          </button>
        ))}
        <label className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input className="input !py-2 !pl-9" placeholder="Buscar jugador" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {!hidratado ? (
          <div className="glass h-40 animate-pulse rounded-3xl" />
        ) : lista.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center text-white/60">
            <PelotaTenis className="size-10" />
            Cuando se jueguen partidos de tenis, aquí aparece el ranking.
          </div>
        ) : (
          lista.map((f, i) => <Fila key={f.clave} f={f} i={i} sup={sup} />)
        )}
      </div>
    </main>
  );
}

function Fila({ f, i, sup }: { f: FichaJugador; i: number; sup: Superficie | null }) {
  const r = sup ? f.por[sup] : f.total;
  const esp = especialidad(f);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="glass flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4">
      <span className="w-6 text-center font-display text-lg font-bold text-white/60">{i + 1}</span>
      <Avatar nombre={f.nombre} fotoUrl={f.fotoUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-semibold">
          {f.nombre}
          {f.titulos > 0 && <span title={`${f.titulos} título(s)`}>{"🏆".repeat(Math.min(f.titulos, 3))}</span>}
          {f.racha >= 3 && (
            <span className="chip !py-0.5 text-amber-200" title="Victorias seguidas">
              <Flame className="size-3" /> {f.racha}
            </span>
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-white/55">
          {(["DURA", "ARCILLA"] as Superficie[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: SUPERFICIES[s].color }} />
              {f.por[s].pg}-{f.por[s].pj - f.por[s].pg}
            </span>
          ))}
          {esp && (
            <span className="truncate font-semibold" style={{ color: SUPERFICIES[esp].claro }}>
              Especialista en {SUPERFICIES[esp].nombre.toLowerCase()}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl font-bold tabular">{r.pg}</p>
        <p className="text-[11px] text-white/45">{Math.round(pct(r) * 100)}% de {r.pj}</p>
      </div>
    </motion.div>
  );
}
