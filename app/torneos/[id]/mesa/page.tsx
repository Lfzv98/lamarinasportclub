"use client";

import clsx from "clsx";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BarChart3, Check, CheckCheck, ClipboardCheck, Clock, CloudRain, Inbox, LockKeyhole, PenLine, Radio, UserRoundX } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ArbitroLogin } from "@/components/torneo/Arbitraje";
import { EstadoConexion } from "@/components/torneo/Conexion";
import { TarjetaPista } from "@/components/torneo/Pistas";
import { MatchCard, ResultadoHoja, Revision, haceCuanto } from "@/components/torneo/piezas";
import { CambiosHorario } from "@/components/torneo/CambiosHorario";
import { ImprevistosHoja } from "@/components/torneo/ImprevistosHoja";
import { TorneoShell } from "@/components/torneo/TorneoShell";
import { useAhora, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { toast } from "@/components/ui/Toaster";
import { useEsMesa } from "@/lib/arbitro";
import { sonar, vibrar } from "@/lib/feedback";
import { nombreCorto } from "@/lib/torneo/categorias";
import { relojClub } from "@/lib/torneo/arbitros";
import { pistaCorta } from "@/lib/torneo/imprevistos";
import { atrasoMinutos, estadoPistas, partidosListos, vencidosWO } from "@/lib/torneo/programacion";
import { categoria, todosLosPartidos } from "@/lib/torneo/torneo";
import { useAmericanos, useEsStaff } from "@/lib/store";
import { useTorneos } from "@/lib/torneosStore";
import type { PartidoTorneo, Torneo } from "@/types/torneo";

/**
 * Mesa técnica: la pantalla del árbitro principal. Ve todas las pistas en vivo, llama partidos y
 * recibe cada resultado que cierra un árbitro de pista para darlo por bueno o corregirlo.
 * El marcador lo llevan los árbitros de pista; aquí no se anota, se controla.
 */
export default function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MesaGate torneoId={id}>
      <TorneoShell id={id} ancho="max-w-7xl">
        {(t) => <Mesa torneo={t} />}
      </TorneoShell>
    </MesaGate>
  );
}

function MesaGate({ torneoId, children }: { torneoId: string; children: React.ReactNode }) {
  const esMesa = useEsMesa();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  if (esMesa === undefined)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );
  if (esMesa) return <>{children}</>;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo compacto className="size-14" />
      <span className="flex size-16 items-center justify-center rounded-2xl bg-lima text-marino-2">
        <LockKeyhole className="size-8" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold">Mesa técnica</h1>
        <p className="mt-1 max-w-sm text-sm text-white/55">Para el árbitro principal y el staff. Entra con tu nombre y tu código. El staff marca quién es el árbitro principal en Ajustes → Árbitros del club.</p>
      </div>
      <ArbitroLogin />
      <div className="flex gap-3">
        <Link href={`/torneos/${torneoId}`} className="btn-ghost">
          <ArrowLeft className="size-4" /> Torneo
        </Link>
        <button className="btn-ghost" onClick={() => setPedirLogin(true)}>
          Soy staff
        </button>
      </div>
    </main>
  );
}

/** Minutos que un resultado puede esperar en la bandeja antes de pintarse en rojo. */
const ESPERA_ALERTA = 10;

function Mesa({ torneo }: { torneo: Torneo }) {
  const esStaff = useEsStaff();
  useMarcadoresEnVivo(torneo.id, 3000);
  const ahora = useAhora(5000);
  const accionPartido = useTorneos((s) => s.accionPartido);
  const [abierto, setAbierto] = useState<string | null>(null);

  const partidos = todosLosPartidos(torneo).filter((p) => !p.bye);
  // Primero lo que más pesa: finales y llave (deciden quién avanza), y dentro de eso lo que lleva más tiempo esperando.
  const porRevisar = partidos
    .filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR")
    .sort((a, b) => prioridadRevision(torneo, b) - prioridadRevision(torneo, a) || (a.finEn ?? "").localeCompare(b.finEn ?? ""));
  const demorados = porRevisar.filter((p) => minutosEsperando(p, ahora) >= ESPERA_ALERTA).length;
  const revisados = partidos
    .filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "VISTO")
    .sort((a, b) => (b.revision?.en ?? "").localeCompare(a.revision?.en ?? ""))
    .slice(0, 6);
  const pistas = estadoPistas(torneo, ahora);
  const vencidos = new Set(vencidosWO(torneo, ahora).map((p) => p.id));
  const asignados = new Set(pistas.map((p) => p.siguiente?.id));
  const proximos = partidosListos(torneo).filter((p) => !asignados.has(p.id)).slice(0, 6);
  const atraso = atrasoMinutos(torneo, new Date(ahora));
  const enJuego = partidos.filter((p) => p.estado === "EN_JUEGO").length;
  const hoy = relojClub(ahora).fecha;
  const hayTurnosHoy = (torneo.arbitros?.turnos ?? []).some((x) => x.fecha === hoy);
  const jugandoHoy = pistas.some((c) => c.enJuego || c.llamado || c.siguiente);

  // Aviso (sonido y vibración) cuando llega un resultado nuevo a la bandeja.
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(porRevisar.map((p) => p.id));
    if (vistos.current && [...ids].some((id) => !vistos.current!.has(id))) {
      sonar("ok");
      vibrar([20, 60, 20]);
      toast("Llegó un resultado nuevo a la bandeja");
    }
    vistos.current = ids;
  }, [porRevisar.map((p) => p.id).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un toque = un envío: mientras viaja, el botón queda tomado (evita dobles «Visto» con el dedo nervioso).
  const [enviando, setEnviando] = useState<Set<string>>(new Set());
  const marcar = (id: string, on: boolean) =>
    setEnviando((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const visto = async (p: PartidoTorneo) => {
    if (enviando.has(p.id)) return;
    vibrar(10);
    marcar(p.id, true);
    const err = await accionPartido(torneo.id, p.id, { accion: "revisar" });
    marcar(p.id, false);
    toast(err ?? `${p.etiqueta}: revisado`, err ? "error" : undefined);
  };
  const todosVistos = async () => {
    const lista = porRevisar.filter((p) => !enviando.has(p.id));
    if (!lista.length || !confirm(`¿Dar por buenos los ${lista.length} resultados de la bandeja?`)) return;
    lista.forEach((p) => marcar(p.id, true));
    const fallas: string[] = [];
    for (const p of lista) {
      const err = await accionPartido(torneo.id, p.id, { accion: "revisar" });
      marcar(p.id, false);
      if (err) fallas.push(`${p.etiqueta}: ${err}`);
    }
    if (fallas.length) toast(`${fallas.length} sin revisar. ${fallas[0]}`, "error");
    else toast("Bandeja al día");
  };
  const [imprevistos, setImprevistos] = useState(false);

  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-lima text-marino-2">
          <ClipboardCheck className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold leading-tight">Mesa técnica</h2>
          <p className="text-xs text-white/50">Los árbitros anotan en su pista; aquí llegan solos los resultados.</p>
        </div>
        <EstadoConexion siempre />
        {esStaff && (
          <button className="btn-ghost !py-2 !text-amber-200" onClick={() => setImprevistos(true)} title="Lluvia, pistas fuera de servicio, cambio de sede o de día" data-imprevistos>
            <CloudRain className="size-4" /> Imprevistos / clima
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Inbox, v: porRevisar.length, l: "Por revisar", alerta: porRevisar.length > 0 },
          { icon: Radio, v: enJuego, l: "En juego" },
          { icon: Clock, v: atraso >= 5 ? `+${atraso}′` : "En hora", l: atraso >= 5 ? "Atraso" : "Programación", alerta: atraso >= 15 },
        ].map((s) => (
          <div key={s.l} className={clsx("glass rounded-2xl p-3 sm:p-4", s.alerta && "!border-amber-300/40")}>
            <s.icon className={clsx("size-4", s.alerta ? "text-amber-200" : "text-neon")} />
            <p className={clsx("mt-1.5 font-display text-2xl font-bold tabular", s.alerta && "text-amber-200")}>{s.v}</p>
            <p className="text-xs text-white/50">{s.l}</p>
          </div>
        ))}
      </div>
      {demorados > 0 && (
        <p className="mt-2 flex items-center gap-2 rounded-2xl border border-coral/40 bg-coral/10 p-3 text-sm font-semibold text-coral" role="alert" data-alerta-bandeja>
          <Inbox className="size-4 shrink-0" />
          {demorados === 1 ? "1 resultado espera" : `${demorados} resultados esperan`} hace más de {ESPERA_ALERTA} min: revísalos para que el cuadro avance.
        </p>
      )}
      {atraso >= 15 && (
        <p className="mt-2 text-xs text-amber-200">
          Hay atraso: el staff puede tocar «Reacomodar desde ahora» en{" "}
          <Link className="underline" href={`/torneos/${torneo.id}/programacion`}>
            Horarios
          </Link>{" "}
          y la app avisa a los jugadores afectados.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-5" aria-label="Resultados por revisar">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h3 className="font-display text-xl font-semibold">Resultados por revisar</h3>
            {porRevisar.length > 1 && (
              <button className="text-xs font-semibold text-neon disabled:opacity-40" onClick={todosVistos} disabled={enviando.size > 0}>
                <CheckCheck className="mr-1 inline size-3.5" /> Todos vistos
              </button>
            )}
          </div>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {porRevisar.map((p) => (
                <TarjetaRevision key={p.id} torneo={torneo} p={p} ahora={ahora} enviando={enviando.has(p.id)} onVisto={() => visto(p)} onCorregir={() => setAbierto(p.id)} />
              ))}
            </AnimatePresence>
            {!porRevisar.length && (
              <div className="glass rounded-2xl p-6 text-center">
                <Check className="mx-auto size-8 text-neon" />
                <p className="mt-2 font-semibold">Todo revisado</p>
                <p className="mt-1 text-xs text-white/50">Cuando un árbitro cierre un partido en su tablet, el resultado aparece aquí al instante, con sonido.</p>
              </div>
            )}
          </div>

          {revisados.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-white/60">Revisados hace poco</h3>
              <div className="space-y-2">
                {revisados.map((p) => (
                  <button key={p.id} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left" onClick={() => setAbierto(p.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {p.etiqueta} · {nombreCorto(categoria(torneo, p.categoriaId)!.categoria)}
                      </span>
                      <span className="block truncate text-xs text-white/50">
                        {p.revision?.correcciones?.length ? `Corregido: ${p.revision.correcciones.at(-1)!.despues} (${p.revision.correcciones.at(-1)!.motivo})` : `Visto por ${p.revision?.por ?? "mesa técnica"} ${haceCuanto(p.revision?.en)}`}
                      </span>
                    </span>
                    {p.revision?.correcciones?.length ? <PenLine className="size-4 text-amber-200" /> : <Check className="size-4 text-neon" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="lg:col-span-7" aria-label="Pistas">
          <h3 className="mb-3 font-display text-xl font-semibold">Pistas</h3>
          {!hayTurnosHoy && jugandoHoy && (
            <p className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
              <UserRoundX className="mt-px size-4 shrink-0" />
              Hoy no hay turnos de árbitros cargados, así que la app no puede avisar qué pista está sin árbitro. El staff los reparte en Árbitros y turnos.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pistas.map((c, i) => (
              <TarjetaPista key={c.numero} torneo={torneo} c={c} ahora={ahora} i={i} mesa vencido={vencidos.has(c.llamado?.id ?? "")} onAbrir={setAbierto} />
            ))}
          </div>

          <CambiosHorario torneo={torneo} onAbrir={setAbierto} />

          {proximos.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-white/60">Después, en orden</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {proximos.map((p) => (
                  <MatchCard key={p.id} torneo={torneo} p={p} compacto onClick={() => setAbierto(p.id)} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <ResultadoHoja torneo={torneo} partidoId={abierto} onClose={() => setAbierto(null)} />
      {esStaff && <ImprevistosHoja torneo={torneo} abierta={imprevistos} onClose={() => setImprevistos(false)} />}
    </div>
  );
}

/** Minutos desde que el árbitro cerró el partido. */
function minutosEsperando(p: PartidoTorneo, ahora: number): number {
  return p.finEn ? Math.max(0, Math.floor((ahora - new Date(p.finEn).getTime()) / 60_000)) : 0;
}

/** Final > semifinal > resto de la llave > grupos: lo que decide quién avanza se revisa primero. */
function prioridadRevision(t: Torneo, p: PartidoTorneo): number {
  if (p.fase !== "LLAVE") return 0;
  const rondas = Math.max(...todosLosPartidos(t).filter((x) => x.categoriaId === p.categoriaId && x.fase === "LLAVE").map((x) => x.ronda));
  const desdeFinal = rondas - p.ronda;
  return desdeFinal === 0 ? 3 : desdeFinal === 1 ? 2 : 1;
}

function TarjetaRevision({
  torneo,
  p,
  ahora,
  enviando,
  onVisto,
  onCorregir,
}: {
  torneo: Torneo;
  p: PartidoTorneo;
  ahora: number;
  enviando: boolean;
  onVisto: () => void;
  onCorregir: () => void;
}) {
  const cat = categoria(torneo, p.categoriaId);
  const espera = minutosEsperando(p, ahora);
  const demorado = espera >= ESPERA_ALERTA;
  const peso = prioridadRevision(torneo, p);
  const min = p.inicioEn && p.finEn ? Math.round((new Date(p.finEn).getTime() - new Date(p.inicioEn).getTime()) / 60_000) : null;
  const pista = p.pistaReal ?? p.programacion?.pista;
  return (
    <motion.div layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className={clsx("glass rounded-2xl p-3", demorado ? "!border-coral/50" : "border-amber-300/30")} data-revision={p.id} data-demorado={demorado || undefined}>
      <p className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
        <span className="font-semibold text-amber-200">{nombreCorto(cat!.categoria)}</span>
        {peso >= 2 && <span className="rounded-full bg-lima px-1.5 text-[10px] font-bold uppercase text-marino-2">{peso === 3 ? "Final" : "Semifinal"}</span>}
        {pista != null && <span>{pistaCorta(torneo, pista)}</span>}
        {min != null && min > 0 && min < 300 && <span>{min} min</span>}
        <span className={clsx("ml-auto", demorado && "font-semibold text-coral")}>{demorado ? `Espera hace ${espera} min` : haceCuanto(p.finEn)}</span>
      </p>
      <MatchCard torneo={torneo} p={p} compacto />
      <p className="mt-2 text-xs text-white/55">Lo cerró {p.revision?.cargadoPor ?? "el árbitro de pista"}</p>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button className="btn-neon !py-2" onClick={onVisto} disabled={enviando} data-visto>
          {enviando ? <span className="size-4 animate-spin rounded-full border-2 border-noche/30 border-t-noche" /> : <Check className="size-4" />} {enviando ? "Guardando" : "Visto"}
        </button>
        <button className="btn-ghost !py-2" onClick={onCorregir} disabled={enviando}>
          <PenLine className="size-4" /> Corregir
        </button>
        <Link href={`/torneos/${torneo.id}/partido/${encodeURIComponent(p.id)}`} className="btn-ghost !p-2.5" aria-label="Ver punto a punto" title="Ver punto a punto">
          <BarChart3 className="size-4" />
        </Link>
      </div>
    </motion.div>
  );
}
