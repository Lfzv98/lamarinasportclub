"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Settings, Plus, Sparkles, Timer, Trophy, Tv } from "lucide-react";
import { EventoCard } from "@/components/EventoCard";
import { InstallButton } from "@/components/InstallButton";
import { Logo } from "@/components/Logo";
import { ModoBadge } from "@/components/ModoBadge";
import { StaffChip } from "@/components/StaffGate";
import { useAmericanos, useEsStaff, useListaEventos } from "@/lib/store";

const FEATURES = [
  { icon: Sparkles, t: "Rotación inteligente", d: "Nadie repite pareja y los descansos se reparten parejo." },
  { icon: Timer, t: "Cuadro vivo", d: "Cronómetro de ronda y marcador táctil por pista." },
  { icon: Trophy, t: "Ranking al instante", d: "La tabla se reordena con cada resultado." },
  { icon: Tv, t: "Modo TV", d: "Pantalla gigante para la terraza y el bar." },
];

export default function Home() {
  const eventos = useListaEventos();
  const hidratado = useAmericanos((s) => s.hidratado);
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  // Sin sesión, "Nuevo Americano" abre el acceso staff en lugar del setup.
  const soloStaff = (e: React.MouseEvent) => {
    if (esStaff) return;
    e.preventDefault();
    setPedirLogin(true);
  };
  const enVivo = eventos.filter((e) => e.estado !== "FINALIZADO");
  const pasados = eventos.filter((e) => e.estado === "FINALIZADO");

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <Logo />
        <div className="flex items-center gap-2">
          <InstallButton />
          <ModoBadge />
          <StaffChip />
          <Link href="/manual" className="btn-ghost !p-2.5" aria-label="Manual del staff" title="Manual del staff">
            <BookOpen className="size-4" />
          </Link>
          <Link href="/club" onClick={soloStaff} className="btn-ghost !p-2.5" aria-label="Mi club" title="Mi club: pistas y horarios">
            <Settings className="size-4" />
          </Link>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-noche-3 via-noche-2 to-noche p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-neon/20 blur-3xl" />
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="label !text-neon">
          PadelReserve · Americanos & Torneos
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          Arma tu americano en <span className="text-neon">60 segundos</span>.
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-4 max-w-md text-white/60">
          Elige categoría, pistas y jugadores. Nosotros armamos las parejas, el cuadro y el ranking en vivo.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 flex flex-wrap gap-3">
          <Link href="/setup" onClick={soloStaff} className="btn-neon animate-pulse-neon text-base">
            <Plus className="size-5" /> Nuevo Americano
          </Link>
          {enVivo[0] && (
            <Link href={`/evento/${enVivo[0].id}/tv`} className="btn-ghost text-base">
              <Tv className="size-5" /> Abrir Modo TV
            </Link>
          )}
        </motion.div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Eventos activos</h2>
          <span className="text-xs text-white/40">{enVivo.length} evento(s)</span>
        </div>
        {!hidratado ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-40 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : enVivo.length === 0 ? (
          <Link href="/setup" onClick={soloStaff} className="glass flex flex-col items-center gap-2 rounded-3xl border-dashed p-10 text-center text-white/60 hover:text-white">
            <Plus className="size-8 text-neon" />
            Aún no hay eventos. ¡Crea el primero!
          </Link>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {enVivo.map((e, i) => (
              <EventoCard key={e.id} evento={e} index={i} />
            ))}
          </div>
        )}
      </section>

      {pasados.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-semibold">Historial</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pasados.map((e, i) => (
              <EventoCard key={e.id} evento={e} index={i} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.t}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4"
          >
            <f.icon className="size-5 text-neon" />
            <p className="mt-3 text-sm font-semibold">{f.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{f.d}</p>
          </motion.div>
        ))}
      </section>
    </main>
  );
}
