"use client";

import clsx from "clsx";
import Link from "next/link";
import { use, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Clock, CloudRain, Radio, Timer, Trophy, Tv } from "lucide-react";
import { ImprevistosHoja } from "@/components/torneo/ImprevistosHoja";
import { MatchCard, ResultadoHoja } from "@/components/torneo/piezas";
import { TorneoShell } from "@/components/torneo/TorneoShell";
import { FranjaPatrocinadores } from "@/components/torneo/Patrocinadores";
import { useAhora, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { TarjetaPista } from "@/components/torneo/Pistas";
import { PasosTorneo } from "@/components/torneo/PasosTorneo";
import { useEsMesa } from "@/lib/arbitro";
import { atrasoMinutos, estadoPistas, partidosListos, vencidosWO } from "@/lib/torneo/programacion";
import { suspensionesActivas, textoPistas } from "@/lib/torneo/imprevistos";
import { progresoTorneo } from "@/lib/torneo/torneo";
import { useEsStaff } from "@/lib/store";
import type { Torneo } from "@/types/torneo";

export default function TorneoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TorneoShell id={id}>{(t) => <EnVivo torneo={t} />}</TorneoShell>;
}

function EnVivo({ torneo }: { torneo: Torneo }) {
  useMarcadoresEnVivo(torneo.id);
  const ahora = useAhora(15_000);
  const esStaff = useEsStaff();
  const esMesa = useEsMesa();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [imprevistos, setImprevistos] = useState(false);
  const prog = progresoTorneo(torneo);
  const pistas = estadoPistas(torneo, ahora);
  const suspensiones = suspensionesActivas(torneo, ahora);
  const atraso = atrasoMinutos(torneo, new Date(ahora));
  const vencidos = new Set(vencidosWO(torneo, ahora).map((p) => p.id));
  const asignados = new Set(pistas.map((p) => p.siguiente?.id));
  const proximos = partidosListos(torneo).filter((p) => !asignados.has(p.id)).slice(0, 8);
  const recientes = torneo.categorias
    .flatMap((c) => c.cuadro?.partidos ?? [])
    .filter((p) => p.estado === "FINALIZADO" && !p.bye && p.finEn)
    .sort((a, b) => (b.finEn ?? "").localeCompare(a.finEn ?? ""))
    .slice(0, 6);
  const publicadas = torneo.categorias.filter((c) => c.cuadro?.publicado).length;

  const porRevisar = torneo.categorias.flatMap((c) => c.cuadro?.partidos ?? []).filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR").length;

  return (
    <>
      {esStaff && <PasosTorneo torneo={torneo} />}
      {esMesa && publicadas > 0 && (
        <Link href={`/torneos/${torneo.id}/mesa`} className="glass mt-2 flex items-center gap-3 rounded-2xl p-3.5 transition hover:border-neon/40">
          <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-marino-2">
            <ClipboardCheck className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Mesa técnica</span>
            <span className="block text-xs text-white/50">Pistas, llamados y resultados que envían los árbitros</span>
          </span>
          {porRevisar > 0 && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-bold text-marino-2">{porRevisar} por revisar</span>}
        </Link>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Trophy, v: `${prog.jugados}/${prog.total}`, l: "Partidos jugados" },
          { icon: Radio, v: prog.enJuego, l: "En juego ahora" },
          { icon: Timer, v: prog.duplas, l: "Duplas" },
          { icon: Clock, v: atraso >= 5 ? `+${atraso}′` : "En hora", l: atraso >= 5 ? "Atraso" : "Programación", alerta: atraso >= 15 },
        ].map((s) => (
          <div key={s.l} className={clsx("glass rounded-2xl p-4", s.alerta && "!border-coral/40")}>
            <s.icon className={clsx("size-4", s.alerta ? "text-coral" : "text-neon")} />
            <p className={clsx("mt-2 font-display text-2xl font-bold tabular", s.alerta && "text-coral")}>{s.v}</p>
            <p className="text-xs text-white/50">{s.l}</p>
          </div>
        ))}
      </div>

      {publicadas === 0 ? (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-white/60">
          <p className="font-display text-xl font-semibold text-white">Aún no hay cuadros publicados</p>
          <p className="mt-2 text-sm">{esStaff ? "Inscribe duplas en cada categoría y toca Sorteo para armar y programar el cuadro." : "El staff publicará los cuadros y horarios pronto."}</p>
          {esStaff && (
            <Link href={`/torneos/${torneo.id}/categorias`} className="btn-neon mt-5">
              Ir a inscripciones
            </Link>
          )}
        </div>
      ) : (
        <>
          {suspensiones.map((s) => (
            <div key={s.id} className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm">
              <CloudRain className="size-5 shrink-0 text-amber-200" />
              <p className="flex-1">
                <b>{s.motivo}:</b> {textoPistas(torneo, s.pistas)} sin juego {s.hasta ? `hasta las ${s.hasta.slice(11)}` : "hasta nuevo aviso"}. Los horarios ya están actualizados.
              </p>
              {esStaff && (
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setImprevistos(true)}>
                  Gestionar
                </button>
              )}
            </div>
          ))}
          <div className="mt-8 flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Pistas</h2>
            <div className="flex items-center gap-4">
              {esStaff && (
                <button onClick={() => setImprevistos(true)} className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                  <CloudRain className="size-4" /> Imprevistos
                </button>
              )}
              <Link href={`/torneos/${torneo.id}/tv`} className="flex items-center gap-1.5 text-sm font-semibold text-neon">
                <Tv className="size-4" /> Modo TV
              </Link>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pistas.map((c, i) => (
              <TarjetaPista key={c.numero} torneo={torneo} c={c} ahora={ahora} i={i} mesa={!!esMesa} vencido={vencidos.has(c.llamado?.id ?? "")} onAbrir={setAbierto} />
            ))}
          </div>

          {proximos.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Próximos</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {proximos.map((p) => (
                  <MatchCard key={p.id} torneo={torneo} p={p} compacto onClick={() => setAbierto(p.id)} />
                ))}
              </div>
            </section>
          )}
          {recientes.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Últimos resultados</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recientes.map((p) => (
                  <MatchCard key={p.id} torneo={torneo} p={p} compacto onClick={() => setAbierto(p.id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <FranjaPatrocinadores torneo={torneo} className="mt-10 justify-center border-t border-white/5 pt-6" />
      <ResultadoHoja torneo={torneo} partidoId={abierto} onClose={() => setAbierto(null)} />
      {esStaff && <ImprevistosHoja torneo={torneo} abierta={imprevistos} onClose={() => setImprevistos(false)} />}
    </>
  );
}
