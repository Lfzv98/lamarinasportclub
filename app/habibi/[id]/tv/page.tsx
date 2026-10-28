"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Maximize, Minimize } from "lucide-react";
import { useState } from "react";
import { CruceCard, PodioHabibi, TablaGrupo, useCruces } from "@/components/habibi/piezas";
import { ANCHO_ESTRECHO, Escenario, Reloj, useCursorOculto, useFullscreenYWakeLock, useLienzo, useVertical } from "@/components/Pantalla";
import { QR } from "@/components/QR";
import { QRPopup, useUrlRanking } from "@/components/QRPopup";
import { categoriaLabel } from "@/lib/categories";
import { CLASIFICAN, infoLlave, NOMBRE_FASE, pendientesGrupos } from "@/lib/habibi";
import { useAmericanos, useEvento } from "@/lib/store";
import type { EventoAmericano, FaseLlave } from "@/types/americano";

export default function HabibiTVPage() {
  const { id } = useParams<{ id: string }>();
  const llave = useEvento(id);
  const hidratado = useAmericanos((s) => s.hidratado);
  if (!llave || !infoLlave(llave))
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {hidratado ? (
          <Link href="/habibi" className="btn-neon">
            Torneo no encontrado · Volver
          </Link>
        ) : (
          <div className="size-12 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
        )}
      </main>
    );
  return <TV llave={llave} />;
}

/**
 * Modo TV del Americano HABIBI: el logo del club va grande y difuminado de fondo
 * (sin logo arriba) y la información con letra grande para verse desde el bar.
 * Fase de grupos: las dos tablas lado a lado. Llave: la ronda en juego en grande y
 * el camino a la final al costado. Al terminar: campeones.
 */
function TV({ llave }: { llave: EventoAmericano }) {
  const info = infoLlave(llave)!;
  const eventos = useAmericanos((s) => s.eventos);
  const grupos = info.grupos.map((g) => eventos[g.eventoId]).filter((g): g is EventoAmericano => !!g && !g.eliminado);
  const { full, alternar, puede } = useFullscreenYWakeLock();
  const vertical = useVertical();
  const lienzo = useLienzo(vertical);
  const estrecho = lienzo.ancho < ANCHO_ESTRECHO;
  const cursorOculto = useCursorOculto();
  const lista = useCruces(llave);
  const porId = new Map(llave.jugadores.map((j) => [j.id, j]));
  const armada = !!info.armadaEn;
  const terminado = llave.estado === "FINALIZADO";
  const faseActual = llave.rondas.find((r) => r.numero === llave.rondaActual)?.fase ?? "FINAL";
  // El 3er puesto se juega junto con la final: en la TV salen juntos.
  const enPantalla = (f: FaseLlave) => (faseActual === "TERCER_PUESTO" || faseActual === "FINAL" ? f === "TERCER_PUESTO" || f === "FINAL" : f === faseActual);
  const actuales = lista.filter((c) => enPantalla(c.fase));
  // Al costado, solo la ronda que sigue y la final (todo más no cabe con letra legible).
  const despues = fasesDespues(llave, faseActual);
  const siguientes = [...new Set<FaseLlave | undefined>([despues[0], despues.length > 1 ? "FINAL" : undefined])].filter((f): f is FaseLlave => !!f && !enPantalla(f));
  const pendientes = pendientesGrupos(grupos);

  const subtitulo = terminado ? "¡Tenemos campeones!" : armada ? NOMBRE_FASE[faseActual] : pendientes ? "Fase de grupos" : "Grupos terminados · se arma la llave";

  return (
    <Escenario oculto={cursorOculto} lienzo={lienzo}>
      {/* Logo del club, grande y difuminado de fondo: se reconoce sin tapar la información. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="" className="w-[70%] max-w-[1400px] opacity-[0.07] blur-[6px]" />
      </div>

      <header className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-[18rem] flex-1">
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-neon">{subtitulo}</p>
          <h1 className="truncate font-display text-5xl font-bold">{llave.nombre}</h1>
          <p className="text-xl text-white/55">{categoriaLabel(llave.categoria)}</p>
        </div>
        <SeguirQR llave={llave} />
        <Reloj />
        <div className={clsx("flex gap-2 transition-opacity", cursorOculto && "opacity-0")}>
          <Link href={`/habibi/${llave.id}`} className="btn-ghost !p-3" aria-label="Salir del modo TV">
            <ArrowLeft className="size-5" />
          </Link>
          {puede && (
            <button className="btn-ghost !p-3" onClick={alternar} aria-label="Pantalla completa">
              {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {terminado ? (
          <motion.section key="fin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={clsx("relative z-10 grid min-h-0 flex-1 items-center gap-8", vertical || estrecho ? "grid-cols-1" : "grid-cols-[1.2fr_1fr]")}>
            <PodioHabibi llave={llave} tv />
            <div className="flex flex-col gap-4">
              {lista
                .filter((c) => c.fase === "FINAL" || c.fase === "TERCER_PUESTO" || c.fase === "SEMIS")
                .reverse()
                .map((c) => (
                  <CruceCard key={c.id} llave={llave} cruce={c} porId={porId} tv />
                ))}
            </div>
          </motion.section>
        ) : armada ? (
          <motion.section key={`llave-${faseActual}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx("relative z-10 grid min-h-0 flex-1 gap-8", vertical || estrecho || !siguientes.length ? "grid-cols-1" : "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
            <div className="flex min-h-0 flex-col">
              <h2 className="mb-4 font-display text-4xl font-bold">{faseActual === "TERCER_PUESTO" || faseActual === "FINAL" ? "Gran final" : NOMBRE_FASE[faseActual]}</h2>
              <div className={clsx("grid flex-1 content-center gap-5", actuales.length > 2 && !estrecho ? "grid-cols-2" : "grid-cols-1")}>
                {actuales.map((c) => (
                  <CruceCard key={c.id} llave={llave} cruce={c} porId={porId} tv />
                ))}
              </div>
            </div>
            {siguientes.length > 0 && (
              <div className="flex min-h-0 flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-white/70">Camino a la final</h2>
                {siguientes.map((f) => (
                  <div key={f}>
                    <p className="mb-2 text-lg font-semibold uppercase tracking-[0.2em] text-white/45">{NOMBRE_FASE[f]}</p>
                    <div className="flex flex-col gap-2">
                      {lista
                        .filter((c) => c.fase === f)
                        .map((c) => (
                          <CruceCard key={c.id} llave={llave} cruce={c} porId={porId} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section key="grupos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx("relative z-10 grid min-h-0 flex-1 gap-8", vertical || estrecho ? "grid-cols-1" : "grid-cols-2")}>
            {grupos.map((g) => {
              const letra = g.habibi?.rol === "GRUPO" ? g.habibi.letra : "?";
              return (
                <div key={g.id} className="glass flex min-h-0 flex-col rounded-[2rem] bg-noche/40 p-5">
                  <div className="mb-3 flex items-baseline justify-between px-2">
                    <h2 className="font-display text-4xl font-bold">Grupo {letra}</h2>
                    <span className="text-xl text-white/50">{g.estado === "FINALIZADO" ? "Terminado" : `Ronda ${Math.min(g.rondaActual, g.totalRondas)} de ${g.totalRondas}`}</span>
                  </div>
                  <TablaGrupo grupo={g} clasifican={CLASIFICAN[info.inicio]} tv />
                </div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>
    </Escenario>
  );
}

function fasesDespues(llave: EventoAmericano, fase: FaseLlave): FaseLlave[] {
  const orden = llave.rondas.map((r) => r.fase!).filter(Boolean);
  return orden.slice(orden.indexOf(fase) + 1).filter((f) => f !== "TERCER_PUESTO");
}

function SeguirQR({ llave }: { llave: EventoAmericano }) {
  const instagram = useAmericanos((s) => s.club.contacto.instagram);
  const ruta = `/habibi/${llave.id}`;
  const url = useUrlRanking(llave.id, ruta);
  const [grande, setGrande] = useState(false);
  if (!url) return null;
  return (
    <>
      <button className="glass flex items-center gap-4 rounded-2xl py-2 pl-2 pr-5 text-left transition hover:bg-white/10" onClick={() => setGrande(true)} aria-label="Agrandar QR">
        <QR texto={url} size={104} className="rounded-xl" />
        <div className="leading-tight">
          <p className="text-xl font-semibold">Sigue el torneo</p>
          <p className="text-xl text-white/50">desde tu celular</p>
          {instagram && <p className="mt-1 text-xl font-semibold text-neon">@{instagram}</p>}
        </div>
      </button>
      <QRPopup evento={llave} abierto={grande} onClose={() => setGrande(false)} ruta={ruta} />
    </>
  );
}
