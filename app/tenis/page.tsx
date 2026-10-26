"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Trophy, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StaffChip } from "@/components/StaffGate";
import { Cancha, FondoSuperficie, PelotaTenis, slugDe, temaSuperficie } from "@/components/tenis/piezas";
import { PartidoVivoCard, partidosVivos } from "@/components/tenis/Tarjetas";
import { useAmericanos, useEsStaff } from "@/lib/store";
import { useListaTenis } from "@/lib/tenisStore";
import { SUPERFICIES } from "@/lib/tenis/torneo";
import type { Superficie } from "@/types/tenis";

/** Tenis: dos puertas, cancha dura y arcilla. */
export default function TenisPage() {
  const torneos = useListaTenis();
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const vivos = partidosVivos(torneos);
  const soloStaff = (e: React.MouseEvent) => {
    if (esStaff) return;
    e.preventDefault();
    setPedirLogin(true);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2 py-3">
        <Link href="/" className="btn-ghost !p-2.5" aria-label="Inicio">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex-1" />
        <StaffChip />
        <Logo compacto />
      </header>

      <section className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label !text-neon">PadelReserve · Tenis</p>
          <h1 className="flex items-center gap-3 font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Tenis <PelotaTenis className="size-9 sm:size-12" girando />
          </h1>
          <p className="mt-2 max-w-lg text-white/60">Torneos, ligas y partidos con las reglas de la ITF. Elige la superficie: cada una tiene su cuadro, su anotador y su TV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tenis/jugadores" className="btn-ghost">
            <Trophy className="size-4" /> Jugadores
          </Link>
          <Link href="/tenis/nuevo" onClick={soloStaff} className="btn-neon">
            <Plus className="size-4" /> Nuevo
          </Link>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["DURA", "ARCILLA"] as Superficie[]).map((s, i) => (
          <Puerta key={s} superficie={s} index={i} torneos={torneos.filter((t) => t.superficie === s)} />
        ))}
      </div>

      {vivos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
            <Zap className="size-5 text-neon" /> En cancha ahora
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vivos.map(({ t, p }) => (
              <div key={p.id} style={temaSuperficie(t.superficie)}>
                <PartidoVivoCard torneo={t} partido={p} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Puerta({ superficie, index, torneos }: { superficie: Superficie; index: number; torneos: { estado: string; partidos: { estado: string }[] }[] }) {
  const d = SUPERFICIES[superficie];
  const activos = torneos.filter((t) => t.estado !== "FINALIZADO").length;
  const enCancha = torneos.reduce((n, t) => n + t.partidos.filter((p) => p.estado === "EN_JUEGO").length, 0);
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * 0.08 }}>
      <Link href={`/tenis/${slugDe(superficie)}`} className="group block active:scale-[0.99]">
        <FondoSuperficie superficie={superficie} className="rounded-[2rem] p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition group-hover:ring-white/30 sm:p-8">
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">{d.ingles}</p>
              <h2 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{d.nombre}</h2>
              <p className="mt-1 font-semibold text-white/85">
                {d.lema}
              </p>
            </div>
            <span className={enCancha ? "chip shrink-0 border-white/30 bg-white/15 text-white" : "chip shrink-0 border-white/20 text-white/80"}>
              {enCancha ? (
                <>
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#dcf03c] opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#dcf03c]" />
                  </span>
                  {enCancha} en cancha
                </>
              ) : (
                `${activos} torneo${activos === 1 ? "" : "s"}`
              )}
            </span>
          </div>
          <div className="relative mx-auto mt-4 max-w-md [perspective:900px]">
            <div className="transition duration-700 [transform:rotateX(38deg)] group-hover:[transform:rotateX(28deg)]">
              <Cancha superficie={superficie} className="drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
            {d.datos.map((x) => (
              <div key={x.titulo} className="rounded-2xl bg-black/20 px-2 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">{x.titulo}</p>
                <p className="mt-0.5 text-xs font-semibold leading-tight sm:text-sm">{x.valor}</p>
              </div>
            ))}
          </div>
          <span className="relative mt-5 flex items-center gap-2 text-sm font-semibold text-white/90">
            Entrar <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </span>
        </FondoSuperficie>
      </Link>
    </motion.div>
  );
}
