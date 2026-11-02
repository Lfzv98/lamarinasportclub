"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarClock, Inbox, Ticket, Users } from "lucide-react";
import { LogoMenu } from "@/components/LogoMenu";
import { EstadoTorneoBadge, rangoFechas } from "@/components/torneo/TorneoShell";
import { aperturaInscripcion } from "@/lib/inscripcion";
import { fechaHoraLocal } from "@/lib/torneo/programacion";
import { useAmericanos, useListaEventos } from "@/lib/store";
import { useListaTorneos, useTorneos } from "@/lib/torneosStore";

/** Un americano "en curso" que no se movió en este tiempo se da por abandonado (pruebas, olvidos). */
const AMERICANO_VIGENTE_MS = 12 * 60 * 60 * 1000;

/**
 * ¿Cuándo juego?: la dirección del QR fijo del club para jugadores. Es igual para todos (staff
 * incluido) y nunca muestra herramientas del staff.
 * - Un solo torneo o americano en juego: entra directo a sus horarios (el torneo pide su clave
 *   de participantes, como siempre).
 * - Varios: el jugador elige.
 * - Ninguno: "vuelve pronto", con el atajo a inscripciones si hay alguna abierta.
 * Se decide con datos recién traídos del servidor, no con la copia guardada en el teléfono.
 */
export default function CuandoJuegoPage() {
  const router = useRouter();
  const torneos = useListaTorneos();
  const eventos = useListaEventos();
  const syncTorneos = useTorneos((s) => s.ultimoSync);
  const syncAmericanos = useAmericanos((s) => s.ultimoSync);
  const listo = Boolean(syncTorneos && syncAmericanos);

  const hoy = fechaHoraLocal(Date.now()).fecha;
  const enJuego = torneos
    .filter((t) => t.estado === "EN_JUEGO" || (t.estado === "PROGRAMADO" && t.dias.some((d) => d.fecha >= hoy)))
    .sort((a, b) => (a.estado === "EN_JUEGO" ? 0 : 1) - (b.estado === "EN_JUEGO" ? 0 : 1));
  const americanos = eventos.filter((e) => e.estado === "EN_CURSO" && Date.now() - new Date(e.actualizadoEn).getTime() < AMERICANO_VIGENTE_MS);
  const abiertos = torneos.filter((t) => aperturaInscripcion(t).abierta);

  const destinos = [
    ...enJuego.map((t) => ({ href: `/torneos/${t.id}/programacion` })),
    ...americanos.map((e) => ({ href: `/evento/${e.id}` })),
  ];
  const unico = listo && destinos.length === 1 ? destinos[0].href : null;

  useEffect(() => {
    if (unico) router.replace(unico);
  }, [unico, router]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2 py-3">
        <Link href="/" className="btn-ghost !p-2.5" aria-label="Inicio">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex-1" />
        <LogoMenu />
      </header>

      <section className="glass relative mt-4 overflow-hidden rounded-[2rem] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-marca-2/30 blur-3xl" />
        <p className="label relative !text-neon">La Marina · Jugadores</p>
        <h1 className="relative font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          ¿Cuándo <span className="text-lima">juego</span>?
        </h1>
        <p className="relative mt-4 max-w-lg text-white/60">Elige tu torneo y busca tu nombre en Horarios: verás tu hora y tu pista.</p>
      </section>

      <section className="mt-10">
        {!listo || unico ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-20 animate-pulse rounded-[1.75rem]" />
            ))}
          </div>
        ) : destinos.length ? (
          <div className="space-y-3">
            <p className="label">En juego ahora</p>
            {enJuego.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/torneos/${t.id}/programacion`} className="seleccion group flex items-center gap-4 rounded-[1.75rem] border p-4 transition active:scale-[0.99] sm:p-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lima text-marino-2">
                    <CalendarClock className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold text-blanco sm:text-xl">{t.nombre}</span>
                    <span className="block text-sm text-blanco/60">{rangoFechas(t)}</span>
                  </span>
                  <EstadoTorneoBadge estado={t.estado} />
                  <ArrowRight className="size-5 shrink-0 text-lima transition group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
            {americanos.map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (enJuego.length + i) * 0.05 }}>
                <Link href={`/evento/${e.id}`} className="glass group flex items-center gap-4 rounded-[1.75rem] p-4 transition hover:border-neon/40 active:scale-[0.99] sm:p-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-neon">
                    <Users className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold">{e.nombre}</span>
                    <span className="block text-sm text-white/55">Americano · Ronda {e.rondaActual} de {e.totalRondas}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-neon transition group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
            <p className="pt-2 text-xs text-white/45">Los torneos piden su clave de participantes: te la da el staff de La Marina.</p>
          </div>
        ) : (
          <div className="glass rounded-[1.75rem] p-5">
            <div className="flex items-center gap-4 text-white/60">
              <Inbox className="size-6 shrink-0 text-white/40" />
              <p>Ahora mismo no hay ningún torneo en juego. Cuando empiece el próximo, este mismo QR te lleva a tus horarios.</p>
            </div>
            {abiertos.length > 0 && (
              <Link href="/inscripciones" className="btn-neon mt-5 flex w-full !rounded-2xl text-sm">
                <Ticket className="size-4" /> Inscríbete en el próximo torneo
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
