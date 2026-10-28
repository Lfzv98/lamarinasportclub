"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Coffee, Maximize, Minimize, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { Cronometro, MarcadorRonda } from "@/components/Cronometro";
import { enEspera } from "@/components/EnEspera";
import { Leaderboard } from "@/components/Leaderboard";
import { PistaLabel } from "@/components/PistaLabel";
import { QR } from "@/components/QR";
import { QRPopup, useUrlRanking } from "@/components/QRPopup";
import { VallasTV } from "@/components/Vallas";
import { useReloj } from "@/hooks/useReloj";
import { ANCHO_ESTRECHO, Escenario, Reloj, useCursorOculto, useFullscreenYWakeLock, useLienzo, useVertical } from "@/components/Pantalla";
import { categoriaLabel } from "@/lib/categories";
import { horaRonda } from "@/lib/horarios";
import { calcularTabla, fotoDeDupla, ganador, nombreCompleto, nombresCompletosDeFila } from "@/lib/scoring";
import { useAmericanos, useEvento } from "@/lib/store";
import type { EventoAmericano, Partido } from "@/types/americano";

const FILAS_POR_PAGINA = 10;
const SEGUNDOS_POR_PAGINA = 12;

export default function ModoTVPage() {
  const { id } = useParams<{ id: string }>();
  const evento = useEvento(id);
  const hidratado = useAmericanos((s) => s.hidratado);

  if (!evento)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {hidratado ? <Link href="/americanos" className="btn-neon">Evento no encontrado · Volver</Link> : <div className="size-12 animate-spin rounded-full border-2 border-white/10 border-t-neon" />}
      </main>
    );
  return <TV evento={evento} />;
}

function TV({ evento }: { evento: EventoAmericano }) {
  const { full, alternar, puede } = useFullscreenYWakeLock();
  const vertical = useVertical();
  const lienzo = useLienzo(vertical);
  const estrecho = lienzo.ancho < ANCHO_ESTRECHO;
  const cursorOculto = useCursorOculto();
  const vallas = useAmericanos((s) => s.club.vallas);
  const tabla = useMemo(() => calcularTabla(evento), [evento]);
  const terminado = evento.estado === "FINALIZADO";
  const filasPorPagina = vertical ? 9 : estrecho ? FILAS_POR_PAGINA : terminado ? 9 : 8;
  const ronda = evento.rondas.find((r) => r.numero === evento.rondaActual);
  const conReloj = evento.cronometro !== false;
  const reloj = useReloj(!terminado && conReloj ? ronda : undefined, evento.duracionRondaMin);

  // Paginación automática del ranking cuando hay muchos jugadores.
  const paginas = Math.max(1, Math.ceil(tabla.filas.length / filasPorPagina));
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    if (paginas <= 1) return setPagina(0);
    const t = setInterval(() => setPagina((p) => (p + 1) % paginas), SEGUNDOS_POR_PAGINA * 1000);
    return () => clearInterval(t);
  }, [paginas]);
  const tablaPagina = { ...tabla, filas: tabla.filas.slice(pagina * filasPorPagina, (pagina + 1) * filasPorPagina) };
  const espera = ronda ? enEspera(evento, ronda) : [];
  // Vallas publicitarias: columna a la izquierda en una TV; en vertical o en un celular, franja arriba.
  const vallasEnFila = vertical || estrecho;

  const ranking = (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-3 font-display text-4xl font-bold">
          {terminado && <Trophy className="size-9 text-neon" />}
          {terminado ? "Resultado final" : "Ranking en vivo"}
        </h2>
        {paginas > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: paginas }, (_, i) => (
              <span key={i} className={clsx("h-2.5 rounded-full transition-all", i === pagina ? "w-10 bg-neon" : "w-2.5 bg-white/20")} />
            ))}
          </div>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={pagina} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          <Leaderboard tabla={tablaPagina} nombresPorFila={(f) => nombresCompletosDeFila(evento, f)} modoTV estrecho={estrecho} />
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return (
    <Escenario oculto={cursorOculto} lienzo={lienzo} marcaAgua>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-[18rem] flex-1">
          <h1 className="truncate font-display text-4xl font-bold xl:text-5xl">{evento.nombre}</h1>
          <p className="text-xl text-white/55">
            {categoriaLabel(evento.categoria)} · {evento.pistas} pistas
          </p>
        </div>
        <SeguirQR evento={evento} />
        <Reloj />
        <div className={clsx("flex gap-2 transition-opacity", cursorOculto && "opacity-0")}>
          <Link href={`/evento/${evento.id}`} className="btn-ghost !p-3" aria-label="Salir del modo TV">
            <ArrowLeft className="size-5" />
          </Link>
          {puede && (
            <button className="btn-ghost !p-3" onClick={alternar} aria-label="Pantalla completa">
              {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          )}
        </div>
      </header>

      <div className={clsx("grid min-h-0 flex-1 gap-8", vallasEnFila ? "grid-cols-1 grid-rows-[auto_minmax(0,1fr)]" : "grid-cols-[15rem_minmax(0,1fr)]")}>
        <VallasTV vallas={vallas} fila={vallasEnFila} className={vallasEnFila ? (estrecho ? "h-32" : "h-44") : undefined} />
        <AnimatePresence mode="wait">
          {terminado ? (
            <motion.section key="final" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-0 flex-col">
              {ranking}
            </motion.section>
          ) : (
            <motion.section key="vivo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx("grid min-h-0 gap-8", lienzo.desplaza && vallasEnFila ? "grid-cols-1" : vertical ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1.2fr)]" : estrecho ? "grid-cols-1" : "grid-cols-[minmax(0,0.75fr)_minmax(0,1.35fr)]")}>
              <div className="flex min-h-0 flex-col gap-5">
                <div className="glass flex items-center gap-6 rounded-[2rem] p-5">
                  {conReloj ? (
                    <Cronometro restantes={reloj.restantes} progreso={reloj.progreso} corriendo={reloj.corriendo} size={150} />
                  ) : (
                    ronda && <MarcadorRonda ronda={ronda} total={evento.totalRondas} size={150} />
                  )}
                  <div>
                    <p className="text-xl font-semibold uppercase tracking-[0.25em] text-white/40">Ronda</p>
                    <p className="font-display text-7xl font-bold leading-none">
                      {evento.rondaActual}
                      <span className="text-4xl text-white/30">/{evento.totalRondas}</span>
                    </p>
                    {ronda && conReloj && <p className="mt-2 text-xl text-white/50">Inicio {horaRonda(evento, ronda.numero)}</p>}
                  </div>
                </div>
                <div className={clsx("grid min-h-0 flex-1 gap-4", !lienzo.desplaza && "auto-rows-fr", (ronda?.partidos.length ?? 0) > (vertical ? 2 : 4) ? "grid-cols-2" : "grid-cols-1")}>
                  {ronda?.partidos.map((p) => <PistaTV key={p.id} partido={p} evento={evento} compacto={(ronda?.partidos.length ?? 0) > 2} />)}
                </div>
                {espera.length > 0 && (
                  <div className="glass flex items-center gap-5 rounded-[2rem] border-amber-300/20 px-6 py-4">
                    <p className="flex shrink-0 items-center gap-3 font-display text-2xl font-bold text-amber-200">
                      <Coffee className="size-7" /> {evento.modalidad === "DUPLA_FIJA" ? "En espera" : "Descansan"}
                    </p>
                    <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-2">
                      {espera.map((e) => (
                        <span key={e.id} className="flex items-center gap-2 text-xl">
                          <span className="font-semibold text-white/90">{e.completo}</span>
                          {e.vuelve && <span className="text-base text-white/40">→ R{e.vuelve}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {ranking}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </Escenario>
  );
}

function PistaTV({ partido, evento, compacto = false }: { partido: Partido; evento: EventoAmericano; compacto?: boolean }) {
  const porId = new Map(evento.jugadores.map((j) => [j.id, j]));
  const res = partido.resultado;
  const g = res ? ganador(evento.puntuacion, res) : null;
  const lado = (l: "A" | "B") => {
    const par = l === "A" ? partido.parejaA : partido.parejaB;
    const nombres = par.jugadorIds.map((id) => nombreCompleto(porId.get(id)));
    const gana = g === (l === "A" ? 1 : -1);
    return (
      <div className={clsx("flex items-center gap-4", res && !gana && "opacity-50")}>
        <AvatarPareja nombres={nombres} fotos={par.jugadorIds.map((id) => porId.get(id)?.fotoUrl)} dupla={fotoDeDupla(evento, par.id)} size={compacto ? 40 : 52} />
        <div className="min-w-0 flex-1">
          {nombres.map((n, i) => (
            <p key={i} className={clsx("break-words font-semibold leading-tight", compacto ? "text-lg" : "text-2xl")}>
              {n}
            </p>
          ))}
        </div>
        {res && <span className={clsx("font-display font-bold tabular", compacto ? "text-4xl" : "text-5xl", gana ? "text-neon" : "text-white")}>{l === "A" ? res.puntosA : res.puntosB}</span>}
      </div>
    );
  };
  return (
    <motion.div layout className={clsx("glass flex min-h-0 flex-col justify-center rounded-[2rem]", compacto ? "gap-1.5 p-4" : "gap-3 p-6", partido.estado === "FINALIZADO" && "border-neon/30")}>
      <div className="flex items-center justify-between">
        <PistaLabel evento={evento} numero={partido.pista} className="text-xl tracking-[0.25em]" icono="size-5" />
        {partido.estado === "FINALIZADO" ? (
          <span className="text-lg font-semibold text-neon">Final</span>
        ) : partido.estado === "EN_JUEGO" ? (
          <span className="flex items-center gap-2 text-lg text-white/60">
            <span className="size-2.5 animate-pulse rounded-full bg-neon" /> En juego
          </span>
        ) : null}
      </div>
      {lado("A")}
      <div className="h-px bg-white/10" />
      {lado("B")}
    </motion.div>
  );
}

function SeguirQR({ evento }: { evento: EventoAmericano }) {
  const instagram = useAmericanos((s) => s.club.contacto.instagram);
  const url = useUrlRanking(evento.id);
  const [grande, setGrande] = useState(false);
  if (!url) return null;
  return (
    <>
      <button className="glass flex items-center gap-4 rounded-2xl py-2 pl-2 pr-5 text-left transition hover:bg-white/10" onClick={() => setGrande(true)} aria-label="Agrandar QR">
        <QR texto={url} size={104} className="rounded-xl" />
        <div className="leading-tight">
          <p className="text-lg font-semibold">Sigue el ranking</p>
          <p className="text-lg text-white/50">desde tu celular</p>
          {instagram && <p className="mt-1 text-lg font-semibold text-neon">@{instagram}</p>}
        </div>
      </button>
      <QRPopup evento={evento} abierto={grande} onClose={() => setGrande(false)} />
    </>
  );
}
