"use client";

import clsx from "clsx";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BarChart3, CalendarClock, Check, CheckCheck, ClipboardCheck, Clock, Inbox, LockKeyhole, MessageCircle, PenLine, Radio, UserRoundX } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ArbitroLogin } from "@/components/torneo/Arbitraje";
import { EstadoConexion } from "@/components/torneo/Conexion";
import { TarjetaPista } from "@/components/torneo/Pistas";
import { MatchCard, ResultadoHoja, Revision, haceCuanto } from "@/components/torneo/piezas";
import { TorneoShell, fechaCorta } from "@/components/torneo/TorneoShell";
import { useAhora, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { toast } from "@/components/ui/Toaster";
import { useEsMesa } from "@/lib/arbitro";
import { sonar, vibrar } from "@/lib/feedback";
import { nombreCorto } from "@/lib/torneo/categorias";
import { relojClub } from "@/lib/torneo/arbitros";
import { pistaCorta } from "@/lib/torneo/imprevistos";
import { atrasoMinutos, estadoPistas, partidosListos, vencidosWO } from "@/lib/torneo/programacion";
import { categoria, dupla, jugador, todosLosPartidos } from "@/lib/torneo/torneo";
import { useAmericanos } from "@/lib/store";
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

function Mesa({ torneo }: { torneo: Torneo }) {
  useMarcadoresEnVivo(torneo.id, 3000);
  const ahora = useAhora(5000);
  const accionPartido = useTorneos((s) => s.accionPartido);
  const [abierto, setAbierto] = useState<string | null>(null);

  const partidos = todosLosPartidos(torneo).filter((p) => !p.bye);
  const porRevisar = partidos.filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR").sort((a, b) => (b.finEn ?? "").localeCompare(a.finEn ?? ""));
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

  const visto = async (p: PartidoTorneo) => {
    vibrar(10);
    const err = await accionPartido(torneo.id, p.id, { accion: "revisar" });
    toast(err ?? `${p.etiqueta}: revisado`, err ? "error" : undefined);
  };
  const todosVistos = async () => {
    if (!confirm(`¿Dar por buenos los ${porRevisar.length} resultados de la bandeja?`)) return;
    for (const p of porRevisar) await accionPartido(torneo.id, p.id, { accion: "revisar" });
    toast("Bandeja al día");
  };

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
              <button className="text-xs font-semibold text-neon" onClick={todosVistos}>
                <CheckCheck className="mr-1 inline size-3.5" /> Todos vistos
              </button>
            )}
          </div>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {porRevisar.map((p) => (
                <TarjetaRevision key={p.id} torneo={torneo} p={p} onVisto={() => visto(p)} onCorregir={() => setAbierto(p.id)} />
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
    </div>
  );
}

function TarjetaRevision({ torneo, p, onVisto, onCorregir }: { torneo: Torneo; p: PartidoTorneo; onVisto: () => void; onCorregir: () => void }) {
  const cat = categoria(torneo, p.categoriaId);
  const min = p.inicioEn && p.finEn ? Math.round((new Date(p.finEn).getTime() - new Date(p.inicioEn).getTime()) / 60_000) : null;
  const pista = p.pistaReal ?? p.programacion?.pista;
  return (
    <motion.div layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="glass rounded-2xl border-amber-300/30 p-3" data-revision={p.id}>
      <p className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
        <span className="font-semibold text-amber-200">{nombreCorto(cat!.categoria)}</span>
        {pista != null && <span>{pistaCorta(torneo, pista)}</span>}
        {min != null && min > 0 && min < 300 && <span>{min} min</span>}
        <span className="ml-auto">{haceCuanto(p.finEn)}</span>
      </p>
      <MatchCard torneo={torneo} p={p} compacto />
      <p className="mt-2 text-xs text-white/55">Lo cerró {p.revision?.cargadoPor ?? "el árbitro de pista"}</p>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button className="btn-neon !py-2" onClick={onVisto}>
          <Check className="size-4" /> Visto
        </button>
        <button className="btn-ghost !py-2" onClick={onCorregir}>
          <PenLine className="size-4" /> Corregir
        </button>
        <Link href={`/torneos/${torneo.id}/partido/${encodeURIComponent(p.id)}`} className="btn-ghost !p-2.5" aria-label="Ver punto a punto" title="Ver punto a punto">
          <BarChart3 className="size-4" />
        </Link>
      </div>
    </motion.div>
  );
}

const AVISADOS = "lamarina-avisos-horario";

/** Teléfono venezolano a formato internacional para WhatsApp ("0414…" → "58414…"). */
function telefonoWhatsapp(tel?: string | null): string | null {
  const t = (tel ?? "").replace(/\D/g, "");
  if (t.length < 10) return null;
  return t.length === 11 && t.startsWith("0") ? `58${t.slice(1)}` : t;
}

/**
 * Partidos publicados que cambiaron de hora (atraso, lluvia, a mano): a quién avisar y con un
 * toque, el WhatsApp con el horario nuevo. En la app los jugadores ya lo ven marcado.
 */
function CambiosHorario({ torneo, onAbrir }: { torneo: Torneo; onAbrir: (id: string) => void }) {
  const [avisados, setAvisados] = useState<string[]>([]);
  useEffect(() => {
    try {
      setAvisados(JSON.parse(localStorage.getItem(AVISADOS) ?? "[]") as string[]);
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const marcar = (clave: string) => {
    const n = [...avisados, clave].slice(-300);
    setAvisados(n);
    try {
      localStorage.setItem(AVISADOS, JSON.stringify(n));
    } catch {
      /* nada */
    }
  };
  const cambios = useMemo(
    () =>
      todosLosPartidos(torneo)
        .filter((p) => p.estado === "PENDIENTE" && !p.bye && p.cambioHorario && p.programacion)
        .sort((a, b) => `${a.programacion!.fecha}${a.programacion!.hora}`.localeCompare(`${b.programacion!.fecha}${b.programacion!.hora}`)),
    [torneo],
  );
  const pendientes = cambios.filter((p) => !avisados.includes(`${p.id}@${p.cambioHorario!.en}`));
  if (!cambios.length) return null;
  return (
    <section className="mt-6" aria-label="Horarios que cambiaron">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/60">
        <CalendarClock className="size-4 text-amber-200" /> Horarios que cambiaron {pendientes.length > 0 && <span className="rounded-full bg-amber-300 px-2 text-xs font-bold text-marino-2">{pendientes.length} por avisar</span>}
      </h3>
      <div className="space-y-2">
        {cambios.map((p) => {
          const clave = `${p.id}@${p.cambioHorario!.en}`;
          const listo = avisados.includes(clave);
          const a = p.cambioHorario!.antes;
          const n = p.programacion!;
          const jugadores = [p.duplaA, p.duplaB].flatMap((d) => dupla(torneo, d)?.jugadorIds ?? []).map((id) => jugador(torneo, id)).filter((j): j is NonNullable<typeof j> => !!j);
          const cat = nombreCorto(categoria(torneo, p.categoriaId)!.categoria);
          const texto = (nombre: string) =>
            `Hola ${nombre}, cambió el horario de tu partido de ${cat} (${p.etiqueta}) en ${torneo.nombre}: ahora es el ${fechaCorta(n.fecha)} a las ${n.hora} en ${pistaCorta(torneo, n.pista)} (antes ${a.hora}). ¡Te esperamos! · La Marina`;
          return (
            <div key={p.id} className={clsx("glass rounded-2xl p-3", listo && "opacity-60")}>
              <button className="w-full text-left" onClick={() => onAbrir(p.id)}>
                <p className="text-sm font-semibold">
                  {p.etiqueta} · {cat}
                </p>
                <p className="text-xs text-white/55">
                  Antes {fechaCorta(a.fecha)} {a.hora} · {pistaCorta(torneo, a.pista)} → <b className="text-white">ahora {fechaCorta(n.fecha)} {n.hora} · {pistaCorta(torneo, n.pista)}</b>
                </p>
              </button>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {jugadores.map((j) => {
                  const tel = telefonoWhatsapp(j.telefono);
                  return tel ? (
                    <a key={j.id} className="chip !text-xs hover:!border-neon/40" href={`https://wa.me/${tel}?text=${encodeURIComponent(texto(j.nombre))}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-3.5 text-neon" /> {j.nombre}
                    </a>
                  ) : (
                    <span key={j.id} className="chip !text-xs text-white/40" title="Sin teléfono cargado">
                      {j.nombre}
                    </span>
                  );
                })}
                {!listo && (
                  <button className="chip ml-auto !text-xs text-neon" onClick={() => marcar(clave)}>
                    <Check className="size-3.5" /> Avisado
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
