"use client";

import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Flag, Settings, Shuffle, Swords, Ticket, Trophy } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";
import { Logo } from "@/components/Logo";
import { MenuApp } from "@/components/MenuApp";
import { ByPadelReserve } from "@/components/Marcas";
import { PieDePagina } from "@/components/PieDePagina";
import { StaffChip } from "@/components/StaffGate";
import { useListaEventos, useListaHabibi } from "@/lib/store";
import { useListaTorneos } from "@/lib/torneosStore";
import { useListaTenis } from "@/lib/tenisStore";
import { PelotaTenis } from "@/components/tenis/piezas";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";

/** Inicio: cuatro puertas, Americanos, Americano Torneo, Torneos y Árbitros, y la entrada a Tenis si el club lo tiene. */
export default function Home() {
  const eventos = useListaEventos();
  const habibis = useListaHabibi();
  const habibiVivos = habibis.filter((e) => e.estado !== "FINALIZADO").length;
  const torneos = useListaTorneos();
  const tenis = useListaTenis();
  const tenisEnCancha = tenis.reduce((n, t) => n + t.partidos.filter((p) => p.estado === "EN_JUEGO").length, 0);
  const americanosVivos = eventos.filter((e) => e.estado === "EN_CURSO").length;
  const torneosVivos = torneos.filter((t) => t.estado === "EN_JUEGO").length;
  const torneosProximos = torneos.filter((t) => t.estado !== "FINALIZADO").length;
  const conInscripcion = torneos.filter((t) => t.inscripcion?.abierta && t.estado === "INSCRIPCION" && (!t.inscripcion.cierre || t.inscripcion.cierre >= new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)));
  const partidosEnJuego = torneos.reduce((n, t) => n + t.categorias.reduce((m, c) => m + (c.cuadro?.partidos.filter((p) => p.estado === "EN_JUEGO").length ?? 0), 0), 0);

  const puertas = [
    {
      href: "/americanos",
      icon: Shuffle,
      titulo: "Americanos",
      lema: "Arma tu americano en 60 segundos.",
      detalle: "Rotación de parejas, cuadro vivo, ranking y Modo TV.",
      chip: americanosVivos ? `${americanosVivos} en vivo` : `${eventos.length} evento${eventos.length === 1 ? "" : "s"}`,
      vivo: americanosVivos > 0,
    },
    {
      href: "/habibi",
      icon: Swords,
      titulo: "Americano Torneo",
      lema: "Grupos A y B, y llave hasta la final.",
      detalle: "Cada grupo juega su americano, individual o en dupla fija; según cómo terminan se arma la llave: octavos, cuartos, semis y la gran final.",
      chip: habibiVivos ? `${habibiVivos} en juego` : `${habibis.length} torneo${habibis.length === 1 ? "" : "s"}`,
      vivo: habibis.some((e) => e.estado === "EN_CURSO"),
      largo: true,
    },
    {
      href: "/torneos",
      icon: Trophy,
      titulo: "Torneos",
      lema: "Del sorteo a la final, solo.",
      detalle: "Todas las categorías, grupos y llaves automáticas, programación por días y marcador punto a punto.",
      chip: torneosVivos ? `${torneosVivos} en juego` : `${torneosProximos} activo${torneosProximos === 1 ? "" : "s"}`,
      vivo: torneosVivos > 0,
    },
    {
      href: "/arbitro",
      icon: Flag,
      titulo: "Árbitros",
      lema: "Anota el partido, punto a punto.",
      detalle: "La tablet de cada pista: un toque por punto. Los televisores y las estadísticas de los atletas se actualizan al instante.",
      chip: partidosEnJuego ? `${partidosEnJuego} partido${partidosEnJuego === 1 ? "" : "s"} en juego` : "Con PIN de árbitro",
      vivo: partidosEnJuego > 0,
    },
  ];

  return (
    <main>
      <div className="sobre-marca relative overflow-hidden bg-marca pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-marca-2/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-neon/15 blur-3xl" />
        <header className="relative mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <InstallButton />
          <StaffChip />
          <Link href="/club" className="btn-ghost !p-2.5" aria-label="Ajustes (staff)" title="Ajustes (staff)">
            <Settings className="size-5" />
          </Link>
          <MenuApp />
        </header>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative mx-auto mt-2 flex max-w-5xl justify-center px-6 sm:mt-6"
        >
          <Logo className="!h-auto max-h-[26svh] w-full max-w-[22rem] object-contain sm:max-w-md" />
        </motion.div>
      </div>

      <div className="relative -mt-8 rounded-t-[2rem] bg-fondo">
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">¿Qué jugamos hoy?</h1>

          {conInscripcion.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Link href={`/inscripcion/${t.id}`} className="seleccion group mt-5 flex items-center gap-4 rounded-[1.75rem] border p-4 transition active:scale-[0.99] sm:p-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lima text-marino-2">
                  <Ticket className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-lima">Inscripciones abiertas</span>
                  <span className="block truncate font-display text-lg font-bold text-blanco sm:text-xl">{t.nombre}</span>
                </span>
                <span className="hidden text-sm font-semibold text-blanco/80 group-hover:text-lima min-[400px]:block">Inscríbete</span>
                <ArrowRight className="size-5 shrink-0 text-lima transition group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
          {!conInscripcion.length && (
            <Link href="/inscripciones" className="glass group mt-5 flex items-center gap-3 rounded-[1.75rem] p-4 transition hover:border-neon/40 active:scale-[0.99]">
              <Ticket className="size-5 shrink-0 text-neon" />
              <span className="min-w-0 flex-1 text-sm text-white/70">
                <span className="font-semibold text-white">Inscripciones a torneos</span> · Mira cuándo abre la próxima
              </span>
              <ArrowRight className="size-4 shrink-0 text-white/40 transition group-hover:translate-x-1 group-hover:text-neon" />
            </Link>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {puertas.map((p, i) => (
              <motion.div key={p.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.07 }}>
                <Link
                  href={p.href}
                  className="glass group relative flex h-full min-h-56 flex-col overflow-hidden rounded-[2rem] p-6 transition hover:border-neon/40 active:scale-[0.99] sm:min-h-72 sm:p-8"
                >
                  <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-marca-2/30 blur-3xl transition group-hover:bg-neon/20" />
                  <div className="relative flex items-start justify-between">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-lima text-marino-2 shadow-[0_10px_30px_-10px_rgba(207,243,91,0.8)] sm:size-16">
                      <p.icon className="size-7 sm:size-8" />
                    </span>
                    <span className={p.vivo ? "chip border-neon/30 bg-neon/10 text-neon" : "chip"}>
                      {p.vivo && (
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon opacity-70" />
                          <span className="relative inline-flex size-2 rounded-full bg-neon" />
                        </span>
                      )}
                      {p.chip}
                    </span>
                  </div>
                  <h2 className={clsx("relative mt-auto pt-8 font-display font-bold tracking-tight", "largo" in p && p.largo ? "text-3xl leading-[1.05] sm:text-4xl" : "text-4xl sm:text-5xl")}>{p.titulo}</h2>
                  <p className="relative mt-1 font-semibold text-neon">{p.lema}</p>
                  <p className="relative mt-2 max-w-sm text-sm text-white/55">{p.detalle}</p>
                  <span className="relative mt-5 flex items-center gap-2 text-sm font-semibold text-white/80 group-hover:text-neon">
                    Entrar <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Tenis: cancha dura y arcilla (solo en clubes con tenis). */}
          {TENIS_ACTIVO && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mt-4">
            <Link href="/tenis" className="sobre-marca group relative grid min-h-56 grid-cols-2 overflow-hidden rounded-[2rem] ring-1 ring-white/10 transition hover:ring-white/30 active:scale-[0.99] sm:min-h-48">
              <span className="relative flex flex-col justify-end bg-gradient-to-br from-[#2f7ff0] to-[#0d3a8c] p-6 sm:p-8">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Hard court</span>
                <span className="font-display text-xl font-bold sm:text-3xl">Cancha dura</span>
              </span>
              <span className="relative flex flex-col items-end justify-end bg-gradient-to-bl from-[#d9653b] to-[#7a2c12] p-6 text-right sm:p-8">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Clay court</span>
                <span className="font-display text-xl font-bold sm:text-3xl">Arcilla</span>
              </span>
              <span className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-5 sm:pt-6">
                <span className="flex items-center gap-3">
                  <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Tenis</h2>
                  <PelotaTenis className="size-9 transition duration-500 group-hover:rotate-180 sm:size-11" />
                </span>
                <span className={tenisEnCancha ? "chip mt-2 border-white/30 bg-white/15 text-white" : "chip mt-2 border-white/20 text-white/80"}>
                  {tenisEnCancha ? `${tenisEnCancha} en cancha` : "Nuevo · Torneos, ligas y partidos"}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/40" />
            </Link>
          </motion.div>
          )}

          <div className="mt-10 flex justify-center">
            <ByPadelReserve />
          </div>
        </div>
      </div>
      <PieDePagina firma={false} />
    </main>
  );
}
