"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Plus, Swords, Trophy, Tv, Users } from "lucide-react";
import { EstadoBadge } from "@/components/EventoCard";
import { InstallButton } from "@/components/InstallButton";
import { Logo } from "@/components/Logo";
import { ModoBadge } from "@/components/ModoBadge";
import { StaffChip } from "@/components/StaffGate";
import { categoriaLabel } from "@/lib/categories";
import { CRUCES, NOMBRE_FASE, infoLlave, podio } from "@/lib/habibi";
import { useAmericanos, useEsStaff, useListaHabibi } from "@/lib/store";
import type { EventoAmericano } from "@/types/americano";

const PASOS = [
  { t: "Fase de grupos", d: "Grupo A y grupo B juegan su americano, individual (cambian de pareja cada ronda) o en dupla fija: el staff elige. Con cuadro vivo y ranking." },
  { t: "Se arma la llave", d: "Según cómo terminó cada grupo, la app cruza a las duplas: octavos, cuartos o semis directo. En individual, las duplas se forman con el ranking del grupo." },
  { t: "Hasta la gran final", d: "El ganador de cada cruce avanza solo. Semis, 3er puesto si lo quieren y la gran final." },
];

export default function HabibiInicio() {
  const torneos = useListaHabibi();
  const hidratado = useAmericanos((s) => s.hidratado);
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const soloStaff = (e: React.MouseEvent) => {
    if (esStaff) return;
    e.preventDefault();
    setPedirLogin(true);
  };
  const activos = torneos.filter((t) => t.estado !== "FINALIZADO");
  const pasados = torneos.filter((t) => t.estado === "FINALIZADO");

  return (
    <main className="pb-24">
      <div className="sobre-marca relative overflow-hidden bg-marca pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-marca-2/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-neon/15 blur-3xl" />
        <header className="relative mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <Link href="/" className="btn-ghost mr-auto !p-2.5" aria-label="Inicio">
            <ArrowLeft className="size-4" />
          </Link>
          <InstallButton />
          <ModoBadge />
          <StaffChip />
        </header>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative mx-auto mt-2 flex max-w-5xl justify-center px-6 sm:mt-6">
          <Logo className="!h-auto max-h-[22svh] w-full max-w-[20rem] object-contain sm:max-w-sm" />
        </motion.div>
      </div>

      <div className="relative -mt-8 rounded-t-[2rem] bg-fondo">
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <section className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-marca-2/30 blur-3xl" />
            <p className="label relative !text-neon">La Marina · Torneo recreativo</p>
            <h1 className="relative max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Americano <span className="text-marca">HABIBI</span> Tournament
            </h1>
            <p className="relative mt-4 max-w-lg text-white/60">Dos grupos juegan su americano y los mejores se cruzan en una llave eliminatoria hasta la gran final.</p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link href="/habibi/nuevo" onClick={soloStaff} className="btn-neon animate-pulse-neon text-base">
                <Plus className="size-5" /> Nuevo Americano HABIBI
              </Link>
              {activos[0] && (
                <Link href={`/habibi/${activos[0].id}/tv`} className="btn-ghost text-base">
                  <Tv className="size-5" /> Abrir Modo TV
                </Link>
              )}
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-xl font-semibold">Torneos activos</h2>
              <span className="text-xs text-white/40">{activos.length} torneo(s)</span>
            </div>
            {!hidratado ? (
              <div className="glass h-40 animate-pulse rounded-3xl" />
            ) : activos.length === 0 ? (
              <Link href="/habibi/nuevo" onClick={soloStaff} className="glass flex flex-col items-center gap-2 rounded-3xl border-dashed p-10 text-center text-white/60 hover:text-white">
                <Plus className="size-8 text-neon" />
                Aún no hay torneos. ¡Arma el primero!
              </Link>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activos.map((t, i) => (
                  <HabibiCard key={t.id} llave={t} index={i} />
                ))}
              </div>
            )}
          </section>

          {pasados.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-display text-xl font-semibold">Historial</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pasados.map((t, i) => (
                  <HabibiCard key={t.id} llave={t} index={i} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-semibold">¿Cómo se juega?</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {PASOS.map((p, i) => (
                <motion.div key={p.t} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-4">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-lima font-display font-bold text-marino-2">{i + 1}</span>
                  <p className="mt-3 text-sm font-semibold">{p.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{p.d}</p>
                </motion.div>
              ))}
            </div>
            <div className="glass mt-3 rounded-2xl p-4">
              <p className="text-sm font-semibold">Octavos con 8 duplas por grupo (o 16 jugadores en individual)</p>
              <p className="mt-1 text-xs text-white/50">Los cruces vecinos se enfrentan en cuartos; 1A y 1B solo se pueden ver en la final.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CRUCES.OCTAVOS.map(([a, b], i) => (
                  <span key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-center text-sm font-semibold tabular">
                    {a} <span className="text-white/35">vs</span> {b}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function HabibiCard({ llave, index }: { llave: EventoAmericano; index: number }) {
  const info = infoLlave(llave)!;
  const eventos = useAmericanos((s) => s.eventos);
  const grupos = info.grupos.map((g) => eventos[g.eventoId]).filter(Boolean);
  const duplas = grupos.reduce((n, g) => n + g.parejas.filter((p) => !p.retirada).length, 0);
  const porId = new Map(llave.jugadores.map((j) => [j.id, j]));
  const campeon = podio(llave)[0];
  const fase = !info.armadaEn ? "Fase de grupos" : llave.estado === "FINALIZADO" ? "Terminado" : NOMBRE_FASE[llave.rondas.find((r) => r.numero === llave.rondaActual)?.fase ?? "FINAL"];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <Link href={`/habibi/${llave.id}`} className="glass group block rounded-3xl p-5 transition hover:border-neon/30 active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={info.armadaEn || grupos.some((g) => g.estado !== "BORRADOR") ? llave.estado === "FINALIZADO" ? "FINALIZADO" : "EN_CURSO" : "BORRADOR"} />
              <span className="chip">{categoriaLabel(llave.categoria)}</span>
            </div>
            <h3 className="truncate font-display text-lg font-semibold">{llave.nombre}</h3>
            <p className="mt-1 text-sm text-white/50">
              <Swords className="mr-1 inline size-3.5" /> {fase}
            </p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-neon" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> {duplas} duplas · {info.grupos.length} grupos
          </span>
          <span>Llave desde {NOMBRE_FASE[info.inicio].toLowerCase()}</span>
          {campeon && (
            <span className="ml-auto flex items-center gap-1.5 font-semibold text-neon">
              <Trophy className="size-3.5" /> {campeon.pareja.jugadorIds.map((id) => porId.get(id)?.nombre).join(" / ")}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
