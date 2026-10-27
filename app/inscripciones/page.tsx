"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Inbox, Settings2, Ticket, Trophy } from "lucide-react";
import { Logo } from "@/components/Logo";
import { MenuApp } from "@/components/MenuApp";
import { StaffChip } from "@/components/StaffGate";
import { EstadoTorneoBadge, rangoFechas } from "@/components/torneo/TorneoShell";
import { aperturaInscripcion } from "@/lib/inscripcion";
import { useEsStaff } from "@/lib/store";
import { useListaTorneos, useTorneos } from "@/lib/torneosStore";

/**
 * Inscripciones: la puerta fija a la inscripción online. Los jugadores ven los torneos con
 * la inscripción abierta; el staff, además, entra al panel de inscripciones de cada torneo.
 */
export default function InscripcionesPage() {
  const torneos = useListaTorneos();
  const hidratado = useTorneos((s) => s.hidratado);
  const esStaff = useEsStaff();
  const abiertos = torneos.filter((t) => aperturaInscripcion(t).abierta);
  const activos = torneos.filter((t) => t.estado !== "FINALIZADO");

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2 py-3">
        <Link href="/" className="btn-ghost !p-2.5" aria-label="Inicio">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex-1" />
        <StaffChip />
        <Logo compacto />
        <MenuApp />
      </header>

      <section className="glass relative mt-4 overflow-hidden rounded-[2rem] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-marca-2/30 blur-3xl" />
        <p className="label relative !text-neon">PadelReserve · Inscripciones</p>
        <h1 className="relative max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Inscríbete en el <span className="text-lima">próximo torneo</span>.
        </h1>
        <p className="relative mt-4 max-w-lg text-white/60">
          Elige el torneo, registra tu dupla, paga y sube el comprobante. El club confirma tu cupo y te avisa.
        </p>
      </section>

      <section className="mt-10">
        <p className="label">Inscripciones abiertas</p>
        {abiertos.length ? (
          <div className="space-y-3">
            {abiertos.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/inscripcion/${t.id}`} className="seleccion group flex items-center gap-4 rounded-[1.75rem] border p-4 transition active:scale-[0.99] sm:p-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lima text-marino-2">
                    <Ticket className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold text-blanco sm:text-xl">{t.nombre}</span>
                    <span className="block text-sm text-blanco/60">
                      {rangoFechas(t)}
                      {t.inscripcion?.cierre ? ` · Cierra el ${t.inscripcion.cierre.split("-").reverse().join("/")}` : ""}
                    </span>
                  </span>
                  <span className="hidden text-sm font-semibold text-blanco/80 group-hover:text-lima min-[400px]:block">Inscríbete</span>
                  <ArrowRight className="size-5 shrink-0 text-lima transition group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass flex items-center gap-4 rounded-[1.75rem] p-5 text-white/60">
            <Inbox className="size-6 shrink-0 text-white/40" />
            <p>{hidratado ? "Ahora mismo no hay torneos con la inscripción abierta. Vuelve pronto." : "Cargando torneos…"}</p>
          </div>
        )}
      </section>

      {esStaff && (
        <section id="staff" className="mt-10 scroll-mt-6">
          <p className="label">Staff · Panel de inscripciones</p>
          <p className="mb-3 text-sm text-white/50">
            Confirma pagos y pasa las duplas al torneo. Para abrir la inscripción de un torneo entra a su panel y toca <b>Configurar</b>.
          </p>
          {activos.length ? (
            <ul className="space-y-2">
              {activos.map((t) => (
                <li key={t.id}>
                  <Link href={`/torneos/${t.id}/inscripciones`} className="glass group flex items-center gap-3 rounded-2xl p-4 transition hover:border-neon/40 active:scale-[0.99]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neon">
                      <Trophy className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.nombre}</span>
                      <span className="block text-xs text-white/45">{aperturaInscripcion(t).abierta ? "Inscripción abierta" : "Inscripción cerrada"}</span>
                    </span>
                    <EstadoTorneoBadge estado={t.estado} />
                    <Settings2 className="size-4 text-white/30 group-hover:text-neon" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">
              No hay torneos activos. Crea uno en <Link href="/torneos/nuevo" className="text-neon underline">Nuevo torneo de pádel</Link> o carga los datos de prueba en Ajustes.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
