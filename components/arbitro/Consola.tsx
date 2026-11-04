"use client";

/**
 * Consola del árbitro: todo el partido en una sola pantalla de la tablet de pista.
 *
 * - Antes de empezar: las dos duplas en su lado real, foto, quién saca, sorteo, cambiar lados,
 *   llamar a pista y W.O., todo a la vista. Un toque por elección, en cualquier orden.
 * - En juego: un toque en la mitad de la dupla que ganó el punto. Falta, ace, deshacer, cambiar
 *   sacador, sanción, atención médica y retiro siempre visibles, sin menús.
 * - Nada pide confirmación: cada toque hace la acción al instante y "Deshacer" vuelve atrás la
 *   última, sea cual sea. El final del partido (o un retiro, W.O. o descalificación) se envía solo a
 *   mesa técnica tras una cuenta regresiva corta que se puede deshacer con un toque.
 * El marcador es el mismo de siempre: la TV de la pista, el Modo TV y el En vivo se actualizan igual.
 */
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, BarChart3, Camera, Check, CircleSlash, Flag, HeartPulse, Megaphone, Play, Send, ShieldAlert, Sparkles, Timer, Trophy, Undo2, UserX, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FotoDupla, TomarFoto } from "@/components/Foto";
import { PelotaPadel } from "@/components/torneo/PelotaPadel";
import { Comparativa } from "@/components/torneo/Comparativa";
import { EstadoConexion } from "@/components/torneo/Conexion";
import { Hoja } from "@/components/ui/Hoja";
import { useAhora } from "@/components/torneo/vivo";
import { toast } from "@/components/ui/Toaster";
import { useArbitro } from "@/lib/arbitro";
import { sonar, vibrar } from "@/lib/feedback";
import { subirFoto, useFotos, useFotosTorneo } from "@/lib/fotos";
import { otroLado, sortear, type LadoPista } from "@/lib/torneo/arbitros";
import { nombreCorto } from "@/lib/torneo/categorias";
import {
  apilar,
  cambiarSacador,
  deshacerUno,
  elegirEnSorteo,
  faltaParaEmpezar,
  ganadorCierre,
  previaVacia,
  proximoDeshacer,
  retocar,
  sellar,
  SEGUNDOS_CIERRE,
  type Cierre,
  type PasoDeshacer,
  type Previa,
} from "@/lib/torneo/consola";
import { filasComparativa } from "@/lib/torneo/estadisticas";
import { nombrePista } from "@/lib/torneo/imprevistos";
import {
  ace,
  anotarPunto,
  atencionEnCurso,
  calcularMarcador,
  cambioDeLadoEnCurso,
  descansoReglamentario,
  detallarUltimo,
  faltaSaque,
  ladoActual,
  NOMBRE_GOLPE,
  NOMBRE_SANCION,
  nuevoMarcador,
  pedirAtencion,
  peloteoTrasSuspension,
  proximaSancion,
  puedeElegirOrden,
  puedePedirAtencion,
  relatoPunto,
  sancionar,
  setsFinales,
  statsPartido,
  type EstadoMarcador,
  type StatsJugador,
  type Lado,
} from "@/lib/torneo/marcador";
import { limiteWO } from "@/lib/torneo/programacion";
import { resultadoRetiro, textoSets } from "@/lib/torneo/tabla";
import { categoria, dupla, nombreDupla, reglasDe } from "@/lib/torneo/torneo";
import { useAmericanos } from "@/lib/store";
import { useMarcador, useTorneos } from "@/lib/torneosStore";
import type { Golpe, JugadorTorneo, MarcadorVivo, PartidoTorneo, Torneo } from "@/types/torneo";

const GOLPES: Golpe[] = ["REMATE", "X3", "X4", "VIBORA", "BANDEJA", "VOLEA", "GLOBO", "CHIQUITA", "BAJADA", "DRIVE", "REVES"];
const MOTIVOS_SANCION = ["Demora en el juego", "Conducta antideportiva", "Obscenidad", "Abuso de pelota", "Abuso de pala o equipo", "Abuso verbal", "Indumentaria", "Consejos fuera de tiempo"];
const DETALLE_GUARDADO = "lamarina-arbitro-detalle";
const mmss = (seg: number) => `${Math.floor(Math.max(0, seg) / 60)}:${String(Math.max(0, seg) % 60).padStart(2, "0")}`;

interface Contexto {
  torneo: Torneo;
  p: PartidoTorneo;
  pista: number;
  jug: (id: string) => JugadorTorneo | undefined;
  nombre: (l: Lado) => string;
  fotoDe: (l: Lado) => string | undefined;
}

/**
 * La consola de un partido. `izquierda` va al inicio de la barra de arriba (volver, o la pista
 * con su menú en el panel del árbitro). `onEnviado` corre cuando el resultado salió a mesa.
 */
export function ConsolaPartido({
  torneo,
  p,
  pista: pistaTablet,
  izquierda,
  onEnviado,
}: {
  torneo: Torneo;
  p: PartidoTorneo;
  /** Pista de la tablet: el partido se juega aquí aunque estuviera programado en otra. */
  pista?: number;
  izquierda?: React.ReactNode;
  onEnviado?: () => void;
}) {
  const m = useMarcador(p.id);
  const arbitro = useArbitro();
  const staff = useAmericanos((s) => s.staff);
  const yo = arbitro?.id ?? "staff";
  const fotos = useFotosTorneo(torneo.id);
  // El marcador del servidor manda: si el partido ya se anota en otra tablet, se sigue desde ahí.
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; boton: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    useTorneos
      .getState()
      .sincronizarMarcadores(torneo.id)
      .finally(() => {
        if (!vivo) return;
        const actual = useTorneos.getState().marcadores[p.id];
        const otro = otroAnotando(actual, yo);
        if (otro) setAviso({ texto: `Lo está anotando ${otro.nombre} (último punto hace ${Math.max(1, Math.round(otro.hace / 1000))} s). Si sigues, tomas el relevo desde el mismo marcador.`, boton: "Tomar el relevo" });
        else if (staff && !arbitro && !actual?.finalizado) setAviso({ texto: "Este marcador lo lleva el árbitro de la pista. Anota tú solo si la pista no tiene árbitro o su tablet falló.", boton: "Anotar en su lugar" });
        setListo(true);
      });
    return () => {
      vivo = false;
    };
  }, [torneo.id, p.id, yo]); // eslint-disable-line react-hooks/exhaustive-deps

  const dA = dupla(torneo, p.duplaA);
  const dB = dupla(torneo, p.duplaB);
  const pista = pistaTablet ?? p.pistaReal ?? p.programacion?.pista ?? m?.pista ?? torneo.canchas[0]?.numero ?? 1;
  const ctx: Contexto = {
    torneo,
    p,
    pista,
    jug: (id) => torneo.jugadores.find((j) => j.id === id),
    nombre: (l) => nombreDupla(torneo, l === "A" ? dA : dB),
    fotoDe: (l) => fotos[(l === "A" ? p.duplaA : p.duplaB) ?? ""],
  };
  if (!dA || !dB) return <Vacio titulo="Todavía no se conocen las dos duplas" texto="Cuando el cuadro las defina, el partido aparece aquí solo." />;
  const cat = categoria(torneo, p.categoriaId);
  const rotulo = `${cat ? nombreCorto(cat.categoria) : ""} · ${p.etiqueta} · ${nombrePista(torneo, pista)}`;
  const bloqueo = aviso ? { ...aviso, soltar: () => (vibrar(10), setAviso(null)) } : null;

  if (p.estado === "FINALIZADO" && (!m || m.finalizado))
    return (
      <div className="flex h-full flex-col gap-2">
        <Barra izquierda={izquierda} rotulo={rotulo} />
        <Vacio titulo="Partido terminado" texto={p.resultado ? `${p.resultado.tipo === "WO" ? "W.O. · " : ""}${textoSets(p.resultado.sets)} · ya está en mesa técnica, que es quien lo corrige si hace falta.` : "Ya está en mesa técnica."} icono={<Trophy className="size-10 text-lima" />} />
      </div>
    );
  if (!listo)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </div>
    );
  return m ? (
    <EnJuego key={p.id} ctx={ctx} m={m} rotulo={rotulo} izquierda={izquierda} bloqueo={bloqueo} onEnviado={onEnviado} />
  ) : (
    <PreviaPartido key={p.id} ctx={ctx} rotulo={rotulo} izquierda={izquierda} bloqueo={bloqueo} onEnviado={onEnviado} />
  );
}

function otroAnotando(m: MarcadorVivo | undefined, yo: string): { nombre: string; hace: number } | null {
  if (!m || m.finalizado) return null;
  const ultimo = m.anotadores?.at(-1);
  if (!ultimo || ultimo.id === yo) return null;
  const hace = Date.now() - new Date(m.actualizadoEn).getTime();
  return hace < 3 * 60_000 ? { nombre: ultimo.nombre, hace } : null;
}

type Bloqueo = { texto: string; boton: string; soltar: () => void } | null;

/* ---------- piezas comunes ---------- */

export function Vacio({ titulo, texto, icono, children }: { titulo: string; texto?: string; icono?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="glass flex h-full flex-col items-center justify-center rounded-[2rem] p-8 text-center">
      {icono ?? <Flag className="size-10 text-white/30" />}
      <p className="mt-4 font-display text-2xl font-bold">{titulo}</p>
      {texto && <p className="mt-1 max-w-md text-sm text-white/55">{texto}</p>}
      {children}
    </div>
  );
}

function Barra({ izquierda, rotulo, children }: { izquierda?: React.ReactNode; rotulo: string; children?: React.ReactNode }) {
  return (
    <header className="glass flex min-h-14 shrink-0 items-center gap-2 rounded-2xl px-2 py-1.5">
      {izquierda}
      <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-white/70">{rotulo}</p>
      <EstadoConexion />
      {children}
    </header>
  );
}

/** Franja fija bajo la barra: lo urgente de este momento. Siempre ocupa lo mismo, nada salta. */
function Franja({ tono = "neutro", children }: { tono?: "neutro" | "lima" | "coral" | "ambar" | "cielo"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex h-16 shrink-0 items-center gap-3 overflow-hidden rounded-2xl border px-3",
        tono === "lima" && "border-lima/50 bg-lima/10",
        tono === "coral" && "border-coral/50 bg-coral/10",
        tono === "ambar" && "border-amber-300/50 bg-amber-300/10",
        tono === "cielo" && "border-cielo/40 bg-cielo/10",
        tono === "neutro" && "border-white/5 bg-white/[0.03]",
      )}
    >
      {children}
    </div>
  );
}

function FranjaBloqueo({ b }: { b: NonNullable<Bloqueo> }) {
  return (
    <Franja tono="ambar">
      <ShieldAlert className="size-6 shrink-0 text-amber-200" />
      <p className="min-w-0 flex-1 text-sm leading-snug text-amber-100">{b.texto}</p>
      <button className="btn-neon shrink-0 !px-5 !py-3" onClick={b.soltar}>
        {b.boton}
      </button>
    </Franja>
  );
}

/** Mini marcador de sets para la barra: una fila por dupla, el set en curso en lima. */
function Sets({ ctx, e }: { ctx: Contexto; e: EstadoMarcador }) {
  const sets = setsFinales(e);
  return (
    <div className="hidden shrink-0 space-y-0.5 sm:block" aria-label="Sets">
      {(["A", "B"] as const).map((l) => (
        <div key={l} className="flex items-center gap-1.5 text-xs">
          <span className={clsx("size-1.5 rounded-full", e.equipoSaca === l && !e.terminado ? "bg-lima" : "bg-transparent")} />
          <span className="w-28 truncate font-semibold text-white/70">{ctx.nombre(l)}</span>
          {sets.map((s, j) => (
            <span key={j} className={clsx("w-4 text-center font-display text-sm tabular", j === e.setActual && !e.terminado ? "font-bold text-lima" : "text-white/55")}>
              {l === "A" ? s.a : s.b}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Columnas de las dos duplas en su lado real de la pista (vistas desde la silla), con la red en medio. */
function Pista({ izquierda, children, red }: { izquierda: Lado; children: (l: Lado) => React.ReactNode; red?: React.ReactNode }) {
  const derecha = otroLado(izquierda);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 landscape:flex-row">
      <motion.div layout key={izquierda} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="flex min-h-0 min-w-0 flex-1">
        {children(izquierda)}
      </motion.div>
      {red}
      <motion.div layout key={derecha} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="flex min-h-0 min-w-0 flex-1">
        {children(derecha)}
      </motion.div>
    </div>
  );
}

const colorLado = (l: Lado) => (l === "A" ? "lima" : "cielo");

/* ---------- 1. previa: todo a la vista ---------- */

function PreviaPartido({ ctx, rotulo, izquierda, bloqueo, onEnviado }: { ctx: Contexto; rotulo: string; izquierda?: React.ReactNode; bloqueo: Bloqueo; onEnviado?: () => void }) {
  const { torneo, p, pista, jug, nombre } = ctx;
  const guardarMarcador = useTorneos((s) => s.guardarMarcador);
  const accionPartido = useTorneos((s) => s.accionPartido);
  const staff = useAmericanos((s) => s.staff);
  const arbitro = useArbitro();
  const ahora = useAhora(1000);
  const [pv, setPv] = useState<Previa>(previaVacia);
  const [girando, setGirando] = useState(false);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [llamando, setLlamando] = useState(false);
  const jugadores = (l: Lado) => (l === "A" ? dupla(torneo, p.duplaA)! : dupla(torneo, p.duplaB)!).jugadorIds as [string, string];

  const limite = p.estado === "LLAMADO" ? limiteWO(torneo, p) : null;
  const quedan = limite === null ? null : Math.ceil((limite - ahora) / 1000);
  const puedeWO = quedan !== null && quedan <= 0;
  const falta = faltaParaEmpezar(pv, nombre);
  const bloqueado = !!bloqueo;
  const izq: Lado = pv.ladoA === "IZQ" ? "A" : "B";

  const cambiar = (f: (x: Previa) => Previa) => {
    vibrar(8);
    setPv(f);
  };

  function lanzarSorteo() {
    if (girando) return;
    setGirando(true);
    sonar("tap");
    vibrar([10, 60, 10, 60, 10]);
    const g = sortear();
    setTimeout(() => {
      setGirando(false);
      sonar("ok");
      vibrar([30, 40, 80]);
      setPv((x) => ({ ...x, sorteo: { gana: g, eligio: null } }));
    }, 1100);
  }

  async function llamar() {
    setLlamando(true);
    vibrar(15);
    const err = await accionPartido(torneo.id, p.id, { accion: "llamar", pista });
    setLlamando(false);
    toast(err ?? "Llamado a pista: la TV de la pista los anuncia y corre la tolerancia.", err ? "error" : "ok");
  }

  function empezar() {
    if (falta || bloqueado || !pv.saca) return;
    const m = nuevoMarcador({
      partidoId: p.id,
      torneoId: torneo.id,
      categoriaId: p.categoriaId,
      reglas: reglasDe(torneo, p),
      jugadoresA: jugadores("A"),
      jugadoresB: jugadores("B"),
      sacaPrimero: pv.saca,
      primerA: pv.primer.A!,
      primerB: pv.primer.B!,
      pista,
      anotador: staff?.nombre ?? arbitro?.nombre,
      arbitroId: staff && !arbitro ? "staff" : arbitro?.id,
      sorteo: pv.sorteo?.eligio ? { gana: pv.sorteo.gana, eligio: pv.sorteo.eligio } : null,
      ladoInicialA: pv.ladoA,
    });
    vibrar([10, 40, 10]);
    sonar("ok");
    guardarMarcador(m);
    accionPartido(torneo.id, p.id, { accion: "iniciar", pista }).then((err) => err && toast(err, "error"));
  }

  function enviarWO(noVino: Lado) {
    accionPartido(torneo.id, p.id, { accion: "wo", ganador: otroLado(noVino) }).then((err) => err && toast(err, "error"));
    sonar("ok");
    toast(`W.O. enviado a mesa técnica: no vino ${nombre(noVino)}.`);
    onEnviado?.();
  }

  const franja = bloqueo ? (
    <FranjaBloqueo b={bloqueo} />
  ) : p.estado === "LLAMADO" ? (
    <Franja tono={puedeWO ? "coral" : "cielo"}>
      <Megaphone className={clsx("size-6 shrink-0", puedeWO ? "text-coral" : "text-cielo")} />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        {quedan === null ? "Llamado a pista." : puedeWO ? "Pasó la tolerancia FIP: si una dupla no está, toca «No vino» en su lado." : "Llamado a pista. Tolerancia FIP: W.O. posible en"}
      </p>
      {quedan !== null && !puedeWO && <span className="font-display text-3xl font-bold tabular text-cielo">{mmss(quedan)}</span>}
    </Franja>
  ) : (
    <Franja>
      <Timer className="size-6 shrink-0 text-white/50" />
      <p className="min-w-0 flex-1 text-sm text-white/70">
        {p.programacion ? <>Programado a las <b className="text-white">{p.programacion.hora}</b>. </> : null}
        Cuando estén las duplas, llama a pista o empieza directo.
      </p>
      <button className="btn-ghost shrink-0 !px-4 !py-3" disabled={llamando} onClick={llamar}>
        <Megaphone className="size-5" /> Llamar a pista
      </button>
    </Franja>
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <Barra izquierda={izquierda} rotulo={`${rotulo} · Antes de empezar`} />
      {franja}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Pista
          izquierda={izq}
          red={
            <div className="relative z-10 -my-5 flex items-center justify-center landscape:-mx-5 landscape:my-0">
              <button
                onClick={() => cambiar((x) => ({ ...x, ladoA: x.ladoA === "IZQ" ? "DER" : "IZQ" }))}
                className="flex items-center gap-2 rounded-full border-4 border-fondo bg-white px-4 py-3 font-semibold text-marino-2 shadow-xl transition active:scale-95 landscape:flex-col landscape:px-3 landscape:py-4"
                aria-label="Cambiar lados"
              >
                <ArrowLeftRight className="size-6 portrait:rotate-90" />
                <span className="text-xs leading-tight">Cambiar lados</span>
              </button>
            </div>
          }
        >
          {(l) => (
            <ColPrevia
              ctx={ctx}
              lado={l}
              ladoPista={l === izq ? "IZQ" : "DER"}
              pv={pv}
              ganoSorteo={pv.sorteo?.gana === l}
              puedeWO={puedeWO && !bloqueado}
              onSaca={() => cambiar((x) => ({ ...x, saca: l }))}
              onPrimer={(id) => cambiar((x) => ({ ...x, primer: { ...x.primer, [l]: id } }))}
              onNoVino={() => {
                vibrar([30, 40, 30]);
                setCierre({ tipo: "WO", noVino: l });
              }}
            />
          )}
        </Pista>
        <AnimatePresence>
          {cierre?.tipo === "WO" && (
            <CuentaCierre
              titulo={`No vino ${nombre(cierre.noVino)}`}
              detalle={`W.O.: gana ${nombre(otroLado(cierre.noVino))}`}
              boton="Deshacer W.O."
              onDeshacer={() => (vibrar(20), setCierre(null))}
              onEnviar={() => {
                setCierre(null);
                enviarWO(cierre.noVino);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Sorteo, a la vista y opcional */}
      <div className="glass flex min-h-20 shrink-0 flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
        <span className="label !m-0 shrink-0">Sorteo</span>
        {!pv.sorteo ? (
          <>
            <button onClick={lanzarSorteo} disabled={girando} className="flex items-center gap-2 rounded-2xl bg-lima/15 px-3 py-2 font-semibold text-lima transition active:scale-95" aria-label="Sortear con la pelota">
              <motion.span animate={girando ? { rotate: 720, y: [0, -10, 0, -6, 0] } : { rotate: 0 }} transition={{ duration: 1 }} className="size-9">
                <PelotaPadel className="size-full" />
              </motion.span>
              {girando ? "La pelota decide…" : "Sortear"}
            </button>
            <span className="hidden text-xs text-white/40 sm:inline">o, si lo sortearon con moneda o raqueta:</span>
            {(["A", "B"] as const).map((l) => (
              <button key={l} className="btn-ghost !px-3 !py-2 text-sm" disabled={girando} onClick={() => cambiar((x) => ({ ...x, sorteo: { gana: l, eligio: null } }))}>
                Ganó {nombre(l)}
              </button>
            ))}
          </>
        ) : (
          <>
            <span className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-marino-2", pv.sorteo.gana === "A" ? "bg-lima" : "bg-cielo")}>
              <Trophy className="size-4" /> Ganó {nombre(pv.sorteo.gana)}
            </span>
            <span className="text-sm text-white/55">eligió</span>
            {(["SACAR", "RESTAR", "LADO"] as const).map((x) => (
              <button
                key={x}
                className={clsx("btn-ghost !px-4 !py-2.5 text-sm", pv.sorteo?.eligio === x && "seleccion !text-lima")}
                onClick={() => cambiar((v) => elegirEnSorteo(v, x))}
              >
                {x === "SACAR" ? "Sacar" : x === "RESTAR" ? "Restar" : "Lado"}
              </button>
            ))}
            <span className="hidden min-w-0 flex-1 text-xs text-white/45 sm:block">
              {pv.sorteo.eligio === "LADO" ? `Pon a ${nombre(pv.sorteo.gana)} en su lado con «Cambiar lados»; ${nombre(otroLado(pv.sorteo.gana))} elige sacar o restar.` : pv.sorteo.eligio ? `${nombre(otroLado(pv.sorteo.gana))} elige el lado: usa «Cambiar lados».` : "FIP: el ganador elige sacar, restar o el lado."}
            </span>
            <button className="shrink-0 rounded-full p-2 text-white/40" onClick={() => cambiar((x) => ({ ...x, sorteo: null }))} aria-label="Borrar sorteo">
              <X className="size-4" />
            </button>
          </>
        )}
      </div>

      <button className={clsx("flex min-h-[4.5rem] shrink-0 items-center justify-center gap-3 rounded-2xl text-xl font-bold transition", !falta && !bloqueado ? "btn-neon" : "border border-white/10 bg-white/[0.04] text-white/50")} disabled={!!falta || bloqueado} onClick={empezar}>
        {falta && !bloqueado ? (
          <span className="text-base font-semibold">{falta}</span>
        ) : (
          <>
            <Play className="size-7" /> Empezar partido
          </>
        )}
      </button>
    </div>
  );
}

function ColPrevia({
  ctx,
  lado,
  ladoPista,
  pv,
  ganoSorteo,
  puedeWO,
  onSaca,
  onPrimer,
  onNoVino,
}: {
  ctx: Contexto;
  lado: Lado;
  ladoPista: LadoPista;
  pv: Previa;
  ganoSorteo: boolean;
  puedeWO: boolean;
  onSaca: () => void;
  onPrimer: (id: string) => void;
  onNoVino: () => void;
}) {
  const { torneo, p, jug, nombre } = ctx;
  const d = dupla(torneo, lado === "A" ? p.duplaA : p.duplaB)!;
  const foto = ctx.fotoDe(lado);
  const saca = pv.saca === lado;
  const c = colorLado(lado);
  return (
    <div className={clsx("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border p-3", c === "lima" ? "border-lima/25 bg-gradient-to-br from-marino to-marino-2" : "border-cielo/25 bg-gradient-to-br from-[#122a6b] to-marino-2")}>
      {foto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-25" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-marino-2/30 via-marino-2/70 to-marino-2/95" />
        </>
      )}
      <div className="relative flex items-center gap-2">
        <span className={clsx("h-8 w-1.5 shrink-0 rounded-full", c === "lima" ? "bg-lima" : "bg-cielo")} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">{nombre(lado)}</p>
          <p className="text-xs text-white/50">{ladoPista === "IZQ" ? "Lado izquierdo" : "Lado derecho"} de tu silla{ganoSorteo ? " · ganó el sorteo" : ""}</p>
        </div>
        <TomarFoto
          className="relative shrink-0 overflow-hidden rounded-2xl"
          etiqueta={foto ? `Repetir foto de ${nombre(lado)}` : `Foto de ${nombre(lado)}`}
          onFoto={async (img) => {
            const r = await subirFoto(torneo.id, "dupla", d.id, img);
            if (r.url) {
              useFotos.getState().poner(torneo.id, d.id, r.url);
              toast("Foto lista: ya se ve en la TV");
            } else toast(r.error!, "error");
          }}
        >
          <FotoDupla url={foto} nombres={d.jugadorIds.map((id) => jug(id)?.nombre ?? "?")} fotos={d.jugadorIds.map((id) => jug(id)?.fotoUrl)} className="h-12 w-16 rounded-2xl" avatar={22} />
          <span className="absolute bottom-0.5 right-0.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
            <Camera className="size-3.5" />
          </span>
        </TomarFoto>
      </div>

      <button
        onClick={onSaca}
        aria-pressed={saca}
        className={clsx(
          "relative mt-2 flex min-h-12 sm:mt-3 sm:min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold transition active:scale-[0.98]",
          saca ? "border-lima bg-lima text-marino-2" : "border-dashed border-white/20 text-white/70",
        )}
      >
        <Zap className="size-5" /> {saca ? "Saca primero" : "Saca primero esta dupla"}
      </button>

      <p className="relative mt-3 hidden text-center text-xs font-semibold uppercase tracking-[0.15em] text-white/45 sm:block">¿Quién saca primero en esta dupla?</p>
      <div className="relative mt-2 grid min-h-14 flex-1 grid-cols-2 gap-2">
        {d.jugadorIds.map((id) => {
          const j = jug(id);
          const sel = pv.primer[lado] === id;
          return (
            <button
              key={id}
              onClick={() => onPrimer(id)}
              aria-pressed={sel}
              className={clsx("relative flex min-h-0 items-center justify-center gap-2 rounded-2xl border p-2 transition active:scale-95 sm:flex-col sm:gap-1.5", sel ? "seleccion sobre-marca border-lima" : "border-white/10 bg-white/[0.04]")}
            >
              <span className="sm:hidden">
                <Avatar nombre={[j?.nombre, j?.apellido].join(" ")} fotoUrl={j?.fotoUrl} size={32} />
              </span>
              <span className="hidden sm:block">
                <Avatar nombre={[j?.nombre, j?.apellido].join(" ")} fotoUrl={j?.fotoUrl} size={56} />
              </span>
              <span className="min-w-0 text-left sm:text-center">
                <span className="block truncate font-display text-lg font-bold leading-none">{j?.nombre ?? "?"}</span>
                <span className="block truncate text-xs text-white/45">{j?.apellido}</span>
              </span>
              {sel && (
                <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-lima px-1.5 py-0.5 text-[11px] font-bold text-marino-2 sm:right-2 sm:top-2 sm:px-2">
                  <Zap className="size-3" /> <span className="hidden sm:inline">Saca</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {puedeWO && (
        <button className="relative mt-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-coral/40 bg-coral/10 font-semibold text-coral active:scale-[0.98]" onClick={onNoVino}>
          <UserX className="size-5" /> No vino {nombre(lado)}
        </button>
      )}
    </div>
  );
}

/* ---------- 2. en juego: un toque por punto, todo a la vista ---------- */

interface Bandeja {
  /** Cantidad de puntos cuando se abrió: si llega otro punto, se cierra sola. */
  n: number;
  gana: Lado;
  paso: "COMO" | "GOLPE";
}

function EnJuego({ ctx, m, rotulo, izquierda, bloqueo, onEnviado }: { ctx: Contexto; m: MarcadorVivo; rotulo: string; izquierda?: React.ReactNode; bloqueo: Bloqueo; onEnviado?: () => void }) {
  const { torneo, p, jug, nombre } = ctx;
  const guardarMarcador = useTorneos((s) => s.guardarMarcador);
  const accionPartido = useTorneos((s) => s.accionPartido);
  const e = useMemo(() => calcularMarcador(m), [m]);
  const ahora = useAhora(1000);
  const [pila, setPila] = useState<PasoDeshacer[]>([]);
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [verStats, setVerStats] = useState(false);
  const stats = useMemo(() => statsPartido(m), [m]);
  const [abierto, setAbierto] = useState<{ lado: Lado; que: "SANCION" | "MEDICO" } | null>(null);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [detalle, setDetalle] = useState(true);
  const bloqueado = !!bloqueo;
  const corto = (id: string) => jug(id)?.nombre ?? "?";

  useEffect(() => {
    try {
      setDetalle(localStorage.getItem(DETALLE_GUARDADO) !== "0");
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const alternarDetalle = () => {
    const v = !detalle;
    setDetalle(v);
    vibrar(8);
    try {
      localStorage.setItem(DETALLE_GUARDADO, v ? "1" : "0");
    } catch {
      /* nada */
    }
  };

  // Partido que se reanuda (lluvia, cambio de pista…): vuelve a estar en juego en su pista y sigue igual.
  useEffect(() => {
    if (p.estado === "EN_JUEGO" || p.estado === "FINALIZADO" || m.finalizado) return;
    const pista = ctx.pista;
    accionPartido(torneo.id, p.id, { accion: "iniciar", pista });
    if (pista !== m.pista) guardarMarcador({ ...m, pista, actualizadoEn: new Date().toISOString() });
    if (p.suspendido) {
      const min = Math.round((Date.now() - new Date(p.suspendido.en).getTime()) / 60_000);
      const peloteo = peloteoTrasSuspension(min);
      toast(`Se reanuda: ${textoSets(setsFinales(e).filter((s) => s.a + s.b > 0)) || "0-0"} · ${peloteo ? `${peloteo} min de peloteo` : "sin peloteo"}`, "info");
    }
    // Solo al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de lado: sonido y vibración al aparecer (las duplas ya se cambian solas en la pantalla).
  const avisado = useRef(m.puntos.length);
  useEffect(() => {
    if (m.puntos.length > avisado.current && e.cambioDeLado) {
      sonar("ok");
      vibrar([30, 60, 30]);
    }
    avisado.current = m.puntos.length;
  }, [m.puntos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Terminó jugando: arranca solo la cuenta para enviar a mesa.
  useEffect(() => {
    if (e.terminado && !m.finalizado && !cierre) setCierre({ tipo: "NORMAL" });
    if (!e.terminado && cierre?.tipo === "NORMAL") setCierre(null);
  }, [e.terminado]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Toda acción pasa por aquí: se guarda al instante y queda lista para deshacer. */
  function hacer(nuevo: MarcadorVivo, que: string) {
    if (bloqueado || nuevo === m) return;
    const s = sellar(m, nuevo);
    setPila((x) => apilar(x, m, s, que));
    guardarMarcador(s);
  }
  function retoque(nuevo: MarcadorVivo) {
    const s = sellar(m, nuevo);
    setPila((x) => retocar(x, m, s));
    guardarMarcador(s);
  }
  function deshacerAhora() {
    const r = deshacerUno(pila, m);
    if (!r) return;
    vibrar(25);
    sonar("tap");
    setBandeja(null);
    setAbierto(null);
    setPila(r.pila);
    guardarMarcador(r.m);
  }

  function punto(l: Lado) {
    if (e.terminado || bloqueado) return;
    vibrar(15);
    sonar("tap");
    setAbierto(null);
    setBandeja(null);
    hacer(anotarPunto(m, l), `Punto de ${nombre(l)}`);
  }

  /** Un toque = punto + estadística: el winner suma para su dupla; el error, para la otra. */
  function puntoCon(lado: Lado, jugadorId: string, fin: "WINNER" | "ERROR_NO_FORZADO" | "ERROR_FORZADO") {
    if (e.terminado || bloqueado) return;
    vibrar(15);
    sonar("tap");
    setAbierto(null);
    const gana = fin === "WINNER" ? lado : otroLado(lado);
    const nuevo = anotarPunto(m, gana, { fin, jugadorId });
    hacer(nuevo, `${NOMBRE_STAT[fin]} de ${corto(jugadorId)}`);
    setBandeja(detalle ? { n: nuevo.puntos.length, gana, paso: "GOLPE" } : null);
  }

  function enviar(c: Cierre) {
    const reglas = reglasDe(torneo, p);
    const base = c.tipo === "DESCALIFICACION" ? c.marcador : m;
    const est = base === m ? e : calcularMarcador(base);
    if (c.tipo === "WO") return;
    const ganador = ganadorCierre(c, est.ganador)!;
    const resultado =
      c.tipo === "NORMAL" ? { sets: setsFinales(est), ganador, tipo: "NORMAL" as const } : { ...resultadoRetiro(reglas, setsFinales(est).filter((s) => s.a + s.b > 0), ganador), tipo: c.tipo };
    guardarMarcador({ ...sellar(m, base), finalizado: true, actualizadoEn: new Date(Math.max(Date.now(), new Date(m.actualizadoEn).getTime() + 1)).toISOString() });
    accionPartido(torneo.id, p.id, { accion: "resultado", resultado }).then((err) => {
      if (err) toast(err, "error");
      else if (useTorneos.getState().offline) toast("Sin señal: el resultado quedó guardado en la tablet y se envía solo al volver la conexión.", "info");
    });
    sonar("ok");
    vibrar([20, 40, 20]);
    toast(`Enviado a mesa técnica: ${textoSets(resultado.sets)}`);
    setCierre(null);
    onEnviado?.();
  }

  function sancion(lado: Lado, motivo: string, directa = false) {
    const r = sancionar(m, { lado, motivo, directa });
    setAbierto(null);
    vibrar([40, 40, 40]);
    if (r.nivel === "DESCALIFICACION") {
      setCierre({ tipo: "DESCALIFICACION", descalificado: lado, marcador: r.marcador });
      return;
    }
    hacer(r.marcador, `${NOMBRE_SANCION[r.nivel]} a ${nombre(lado)}`);
    toast(`${NOMBRE_SANCION[r.nivel]} a ${nombre(lado)}${r.nivel === "PUNTO" ? ": punto para la otra dupla" : ""}`, r.nivel === "PUNTO" ? "error" : "info");
  }

  const izq: Lado = ladoActual(m, e, "A") === "IZQ" ? "A" : "B";
  const ultimo = e.jugados.at(-1);
  const atencion = atencionEnCurso(m, ahora);
  const cambio = !e.terminado && !atencion ? cambioDeLadoEnCurso(e, ahora) : null;
  const descanso = descansoReglamentario(e);
  const quedaDescanso = descanso && ultimo ? Math.ceil((new Date(ultimo.t).getTime() + descanso.segundos * 1000 - ahora) / 1000) : 0;
  const eligeOrden = puedeElegirOrden(e);
  const esMixto = categoria(torneo, p.categoriaId)?.categoria.rama === "MIXTO";
  const queDeshace = proximoDeshacer(pila, m);
  const bandejaViva = detalle && bandeja && bandeja.n === m.puntos.length && !e.terminado ? bandeja : null;
  const alerta = e.terminado ? null : e.matchPoint ? `Punto de partido · ${nombre(e.matchPoint)}` : e.setPoint ? `Punto de set · ${nombre(e.setPoint)}` : e.puntoDeOro ? "Punto de oro" : e.enSuperTie ? "Súper tie-break" : e.enTie ? "Tie-break" : e.breakPoint ? "Break point" : null;

  const franja = bloqueo ? (
    <FranjaBloqueo b={bloqueo} />
  ) : e.terminado ? (
    <Franja tono="lima">
      <Trophy className="size-6 shrink-0 text-lima" />
      <p className="min-w-0 flex-1 font-semibold">
        Partido terminado · ganó {nombre(e.ganador ?? "A")} {textoSets(setsFinales(e), e.ganador === "B")}
      </p>
    </Franja>
  ) : cambio ? (
    <FranjaCambio cambio={cambio} />
  ) : atencion ? (
    <Franja tono="coral">
      <HeartPulse className="size-6 shrink-0 text-coral" />
      <p className="min-w-0 flex-1 font-semibold">
        {atencion.atencion.tipo === "LESION" ? "Atención médica" : "Accidente"} · {corto(atencion.atencion.jugadorId)}
      </p>
      <span className="font-display text-3xl font-bold tabular text-coral">{mmss(atencion.quedan)}</span>
    </Franja>
  ) : eligeOrden ? (
    <Franja tono="cielo">
      <ArrowLeftRight className="size-6 shrink-0 text-cielo" />
      <p className="min-w-0 flex-1 text-sm font-semibold">Empieza el set {e.setActual + 1}: cada dupla puede cambiar quién saca. Toca «Cambiar sacador» en su lado si lo piden.</p>
    </Franja>
  ) : alerta ? (
    <Franja tono="lima">
      <Sparkles className="size-6 shrink-0 text-lima" />
      <p className="font-display text-xl font-bold uppercase tracking-wide text-lima">{alerta}</p>
      {e.puntoDeOro && <p className="min-w-0 flex-1 text-xs text-white/60">{esMixto ? "Resta el jugador del mismo sexo que el sacador." : "La dupla que resta elige de qué lado recibe."}</p>}
    </Franja>
  ) : descanso && descanso.segundos >= 90 && quedaDescanso > 0 ? (
    <Franja>
      <Timer className="size-6 shrink-0 text-lima" />
      <p className="min-w-0 flex-1 text-sm font-semibold text-white/75">{descanso.motivo}</p>
      <span className="font-display text-2xl font-bold tabular">{mmss(quedaDescanso)}</span>
    </Franja>
  ) : (
    <Franja>
      <Zap className="size-5 shrink-0 text-lima" />
      <p className="min-w-0 flex-1 truncate text-sm text-white/70">
        Saca <b className="text-white">{corto(e.sacador)}</b> ({nombre(e.equipoSaca)}){m.faltaPendiente ? " · 2º saque" : ""}
      </p>
    </Franja>
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <Barra izquierda={izquierda} rotulo={rotulo}>
        <Sets ctx={ctx} e={e} />
        <button onClick={() => (vibrar(8), setVerStats(true))} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-2 text-xs font-semibold text-white/80" aria-label="Estadísticas del partido">
          <BarChart3 className="size-4 text-lima" /> <span className="hidden sm:inline">Estadísticas</span>
        </button>
        <button onClick={alternarDetalle} aria-pressed={detalle} className={clsx("shrink-0 rounded-xl border px-2.5 py-2 text-xs font-semibold", detalle ? "border-lima/40 text-lima" : "border-white/10 text-white/45")} title="Preguntar con qué golpe después de un winner o un error">
          Golpe {detalle ? "sí" : "no"}
        </button>
      </Barra>
      {franja}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Pista izquierda={izq}>
          {(l) => (
            <ColJuego
              ctx={ctx}
              lado={l}
              m={m}
              e={e}
              bloqueado={bloqueado || !!cierre}
              abierto={abierto?.lado === l ? abierto.que : null}
              onPunto={() => punto(l)}
              onStat={(id, fin) => puntoCon(l, id, fin)}
              stats={stats}
              onAbrir={(que) => (vibrar(8), setAbierto((x) => (x?.lado === l && x.que === que ? null : { lado: l, que })))}
              onCerrar={() => setAbierto(null)}
              onSacador={() => {
                vibrar(10);
                hacer(cambiarSacador(m, l), `Cambio de sacador en ${nombre(l)}`);
              }}
              onSancion={(motivo, directa) => sancion(l, motivo, directa)}
              onAtencion={(id, tipo) => {
                setAbierto(null);
                hacer(pedirAtencion(m, id, tipo), `${tipo === "LESION" ? "Atención médica" : "Accidente"} de ${corto(id)}`);
              }}
              onRetiro={() => {
                vibrar([30, 40, 30]);
                setAbierto(null);
                setCierre({ tipo: "RETIRO", seRetira: l });
              }}
            />
          )}
        </Pista>
        <AnimatePresence>
          {cierre && cierre.tipo !== "WO" && (
            <CuentaCierre
              titulo={
                cierre.tipo === "NORMAL"
                  ? `Ganó ${nombre(e.ganador ?? "A")}`
                  : cierre.tipo === "RETIRO"
                    ? `Se retira ${nombre(cierre.seRetira)}`
                    : `Descalificación de ${nombre(cierre.descalificado)}`
              }
              detalle={
                cierre.tipo === "NORMAL"
                  ? textoSets(setsFinales(e), e.ganador === "B")
                  : `Gana ${nombre(ganadorCierre(cierre, null)!)} · ${textoSets(setsFinales(e).filter((s) => s.a + s.b > 0)) || "0-0"}`
              }
              boton={cierre.tipo === "NORMAL" ? "Deshacer último punto" : cierre.tipo === "RETIRO" ? "Deshacer retiro" : "Deshacer descalificación"}
              onDeshacer={() => {
                if (cierre.tipo === "NORMAL") deshacerAhora();
                else {
                  vibrar(20);
                  setCierre(null);
                }
              }}
              onEnviar={() => enviar(cierre)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Detalle del punto: fijo, nunca tapa los botones de punto, y no frena el siguiente. */}
      <div className="glass flex h-[5.5rem] shrink-0 items-center gap-2 overflow-hidden rounded-2xl px-3">
        {bandejaViva?.paso === "GOLPE" ? (
          <>
            {m.puntos.at(-1)?.fin?.startsWith("ERROR") &&
              (["RED", "AFUERA"] as const).map((z) => (
                <button
                  key={z}
                  className={clsx("btn-ghost shrink-0 !px-3 !py-3 text-sm", m.puntos.at(-1)?.zona === z && "seleccion !text-lima")}
                  onClick={() => (vibrar(8), retoque(detallarUltimo(m, { zona: m.puntos.at(-1)?.zona === z ? null : z })))}
                >
                  {z === "RED" ? "A la red" : "Afuera"}
                </button>
              ))}
            <span className="label !m-0 hidden shrink-0 sm:block">¿Con qué golpe?</span>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
              {GOLPES.map((g) => (
                <button key={g} className="btn-ghost shrink-0 !px-4 !py-3 text-sm capitalize" onClick={() => (vibrar(8), retoque(detallarUltimo(m, { golpe: g })), setBandeja(null))}>
                  {NOMBRE_GOLPE[g]}
                </button>
              ))}
            </div>
            <button className="shrink-0 rounded-full p-2 text-white/40" onClick={() => setBandeja(null)} aria-label="Sin golpe">
              <X className="size-5" />
            </button>
          </>
        ) : (
          <StatsRapidas m={m} relato={ultimo ? relatoPunto(ultimo, corto, nombre) : "Toca la mitad de la dupla que ganó el punto, o el winner / error del jugador."} onVer={() => (vibrar(8), setVerStats(true))} />
        )}
      </div>

      {/* Saque y deshacer: siempre en el mismo lugar. */}
      <footer className="grid shrink-0 grid-cols-4 gap-2">
        <button
          className={clsx("btn-ghost min-h-16 !flex-col !gap-0.5 !py-2 text-base", m.faltaPendiente && "!border-amber-300/70 !bg-amber-300/10 !text-amber-200")}
          disabled={bloqueado || e.terminado}
          onClick={() => {
            vibrar(12);
            const doble = !!m.faltaPendiente;
            hacer(faltaSaque(m), doble ? `Doble falta de ${corto(e.sacador)}` : "Falta de saque");
          }}
        >
          <CircleSlash className="size-5" /> {m.faltaPendiente ? "2ª falta = punto" : "Falta"}
        </button>
        <button className="btn-ghost min-h-16 !flex-col !gap-0.5 !py-2 text-base" disabled={bloqueado || e.terminado} onClick={() => (vibrar(15), hacer(ace(m), `Ace de ${corto(e.sacador)}`))}>
          <Zap className="size-5" /> <span className="whitespace-nowrap">Ace<span className="hidden sm:inline"> de {corto(e.sacador)}</span></span>
        </button>
        <button
          className="col-span-2 flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 border-white/25 bg-white/[0.07] px-4 font-bold transition active:scale-[0.98] active:bg-white/15 disabled:opacity-40"
          disabled={bloqueado || !queDeshace}
          onClick={deshacerAhora}
        >
          <Undo2 className="size-7 shrink-0" />
          <span className="min-w-0 text-left">
            <span className="block text-lg leading-tight">Deshacer</span>
            <span className="block truncate text-xs font-semibold text-white/55">{queDeshace ?? "Nada por deshacer"}</span>
          </span>
        </button>
      </footer>

      <Hoja abierta={verStats} onClose={() => setVerStats(false)} titulo="Estadísticas del partido" sub={`${e.jugados.length} puntos · ${textoSets(setsFinales(e).filter((x) => x.a + x.b > 0)) || "0-0"}`}>
        <Comparativa m={m} nombres={[nombre("A"), nombre("B")]} />
        <p className="label !mt-6">Por jugador</p>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((x) => (
            <div key={x.jugadorId} className={clsx("rounded-2xl border p-3 text-xs", x.lado === "A" ? "border-lima/25" : "border-cielo/25")}>
              <p className="mb-1 truncate text-sm font-semibold">{corto(x.jugadorId)}</p>
              <p className="text-white/65">
                {x.winners} winners · {x.erroresNoForzados} ENF · {x.erroresForzados} EF
              </p>
              <p className="text-white/45">
                {x.aces} aces · {x.doblesFaltas} dobles faltas
              </p>
            </div>
          ))}
        </div>
      </Hoja>
    </div>
  );
}

const NOMBRE_STAT = { WINNER: "Winner", ERROR_NO_FORZADO: "Error no forzado", ERROR_FORZADO: "Error forzado" } as const;

/** Lo principal del partido siempre a la vista, como el grafismo de la transmisión. */
function StatsRapidas({ m, relato, onVer }: { m: MarcadorVivo; relato: string; onVer: () => void }) {
  const filas = useMemo(() => filasComparativa(m, true), [m]);
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {filas.map((f) => (
          <div key={f.t} className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-2 py-1.5 text-center">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/45">{f.t}</p>
            <p className="font-display text-lg font-bold leading-tight tabular">
              <span className="text-lima">{f.ta ?? f.a}</span> <span className="text-white/25">·</span> <span className="text-cielo">{f.tb ?? f.b}</span>
            </p>
          </div>
        ))}
        <p className="hidden max-w-[14rem] shrink truncate text-xs text-white/40 xl:block">{relato}</p>
      </div>
      <button className="btn-ghost shrink-0 !px-3 !py-3 text-sm" onClick={onVer} aria-label="Ver todas las estadísticas">
        <BarChart3 className="size-4" /> <span className="hidden sm:inline">Todas</span>
      </button>
    </>
  );
}

function ColJuego({
  ctx,
  lado,
  m,
  e,
  bloqueado,
  abierto,
  onPunto,
  onStat,
  stats,
  onAbrir,
  onCerrar,
  onSacador,
  onSancion,
  onAtencion,
  onRetiro,
}: {
  ctx: Contexto;
  lado: Lado;
  m: MarcadorVivo;
  e: EstadoMarcador;
  bloqueado: boolean;
  abierto: "SANCION" | "MEDICO" | null;
  onPunto: () => void;
  onStat: (jugadorId: string, fin: "WINNER" | "ERROR_NO_FORZADO" | "ERROR_FORZADO") => void;
  stats: StatsJugador[];
  onAbrir: (q: "SANCION" | "MEDICO") => void;
  onCerrar: () => void;
  onSacador: () => void;
  onSancion: (motivo: string, directa?: boolean) => void;
  onAtencion: (id: string, tipo: "LESION" | "ACCIDENTE") => void;
  onRetiro: () => void;
}) {
  const { jug, nombre } = ctx;
  const i = lado === "A" ? 0 : 1;
  const saca = !e.terminado && e.equipoSaca === lado;
  const ids = lado === "A" ? m.jugadoresA : m.jugadoresB;
  const foto = ctx.fotoDe(lado);
  const c = colorLado(lado);
  const games = lado === "A" ? e.games.a : e.games.b;
  const proxima = proximaSancion(m, lado);
  const sanciones = (m.sanciones ?? []).filter((s) => s.lado === lado);
  return (
    <div className={clsx("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border", c === "lima" ? "border-lima/25 bg-gradient-to-br from-marino to-marino-2" : "border-cielo/25 bg-gradient-to-br from-[#122a6b] to-marino-2", saca && "ring-2 ring-lima/40")}>
      <button
        onClick={onPunto}
        disabled={bloqueado || e.terminado}
        aria-label={`Punto para ${nombre(lado)}`}
        className="relative flex min-h-0 flex-1 select-none flex-col items-center justify-center overflow-hidden px-3 transition active:bg-white/[0.06] disabled:opacity-60"
      >
        {foto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-25" />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-marino-2/40 via-marino-2/70 to-marino-2/95" />
          </>
        )}
        <span className={clsx("pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full blur-3xl", c === "lima" ? "bg-lima/15" : "bg-cielo/20")} />
        <span className={clsx("relative max-w-full truncate rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-[0.18em]", c === "lima" ? "bg-lima/15 text-lima" : "bg-cielo/15 text-cielo")}>{nombre(lado)}</span>
        <span className="relative mt-2 flex items-center gap-2 text-base font-semibold text-white/80">
          {ids.map((id) => (
            <span key={id} className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-0.5", saca && e.sacador === id && "bg-lima text-marino-2")}>
              {saca && e.sacador === id && <Zap className="size-3.5" />}
              {jug(id)?.nombre ?? "?"}
            </span>
          ))}
        </span>
        <motion.span
          key={`${e.texto[i]}-${m.puntos.length}`}
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative font-display text-[clamp(4.5rem,21vh,13rem)] font-bold leading-none tabular portrait:text-[clamp(4rem,12vh,10rem)] max-sm:!text-[4.25rem]"
        >
          {e.texto[i]}
        </motion.span>
        <span className="relative mt-1 flex items-center gap-3 text-sm font-semibold text-white/55">
          <span>
            Games <b className="font-display text-lg text-white tabular">{games}</b>
          </span>
          {sanciones.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-200">
              <ShieldAlert className="size-3" /> {sanciones.length}
            </span>
          )}
        </span>
        <span className="relative mt-1 hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 sm:block">Toca para punto</span>
      </button>

      {/* Cómo terminó el punto, jugador por jugador: un toque anota el punto y la estadística. */}
      <div className="relative grid shrink-0 grid-cols-2 gap-1.5 border-t border-white/10 bg-marino-2/40 p-1.5">
        {ids.map((id) => {
          const st = stats.find((x) => x.jugadorId === id);
          return (
            <div key={id} className="min-w-0">
              <p className="truncate px-1 pb-0.5 text-[11px] font-semibold text-white/60">{jug(id)?.nombre ?? "?"}</p>
              <div className="grid grid-cols-3 gap-1">
                <BotonStat tono="lima" texto="Winner" corto="W" n={st?.winners ?? 0} titulo={`Winner de ${jug(id)?.nombre}: punto para ${nombre(lado)}`} onClick={() => onStat(id, "WINNER")} disabled={bloqueado || e.terminado} />
                <BotonStat tono="coral" texto="E. no forz." corto="ENF" n={st?.erroresNoForzados ?? 0} titulo={`Error no forzado de ${jug(id)?.nombre}: punto para la otra dupla`} onClick={() => onStat(id, "ERROR_NO_FORZADO")} disabled={bloqueado || e.terminado} />
                <BotonStat tono="ambar" texto="E. forzado" corto="EF" n={st?.erroresForzados ?? 0} titulo={`Error forzado de ${jug(id)?.nombre}: punto para la otra dupla`} onClick={() => onStat(id, "ERROR_FORZADO")} disabled={bloqueado || e.terminado} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones de esta dupla: siempre visibles, fuera de la zona de punto. */}
      <div className="relative grid shrink-0 grid-cols-4 gap-1.5 border-t border-white/10 bg-marino-2/60 p-1.5">
        <AccionDupla icono={<ArrowLeftRight className="size-4" />} texto="Cambiar sacador" corto="Sacador" onClick={onSacador} disabled={bloqueado || e.terminado} />
        <AccionDupla icono={<ShieldAlert className="size-4 text-amber-200" />} texto="Sanción" sub={NOMBRE_SANCION[proxima]} activo={abierto === "SANCION"} onClick={() => onAbrir("SANCION")} disabled={bloqueado || e.terminado} />
        <AccionDupla icono={<HeartPulse className="size-4 text-coral" />} texto="Médico" activo={abierto === "MEDICO"} onClick={() => onAbrir("MEDICO")} disabled={bloqueado || e.terminado} />
        <AccionDupla icono={<Flag className="size-4 text-coral" />} texto="Se retira" corto="Retiro" onClick={onRetiro} disabled={bloqueado || e.terminado} />
      </div>

      {/* Sanción o médico: se abre dentro de la misma columna, un toque más y listo. */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
            className="glass-strong absolute inset-x-1.5 bottom-[4.25rem] z-10 max-h-[calc(100%-5rem)] overflow-y-auto rounded-3xl p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold">
                {abierto === "SANCION" ? (
                  <>
                    {NOMBRE_SANCION[proxima]} a {nombre(lado)} <span className="font-normal text-white/50">· toca el motivo</span>
                  </>
                ) : (
                  <>Atención médica (FIP) · {nombre(lado)}</>
                )}
              </p>
              <button className="rounded-full bg-white/10 p-2" onClick={onCerrar} aria-label="Cerrar">
                <X className="size-4" />
              </button>
            </div>
            {abierto === "SANCION" ? (
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_SANCION.map((mo) => (
                  <button key={mo} className="btn-ghost !px-3 !py-2.5 text-sm" onClick={() => onSancion(mo)}>
                    {mo}
                  </button>
                ))}
                <button className="btn-ghost !px-3 !py-2.5 text-sm !text-coral" onClick={() => onSancion("Infracción muy grave", true)}>
                  <ShieldAlert className="size-4" /> Muy grave: descalificación
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {ids.map((id) => {
                  const usada = !puedePedirAtencion(m, id, "LESION");
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate font-semibold">{jug(id)?.nombre}</span>
                      <button className="btn-ghost flex-1 !py-2.5 text-sm" disabled={usada} onClick={() => onAtencion(id, "LESION")}>
                        <HeartPulse className="size-4" /> {usada ? "Lesión ya usada" : "Lesión · 3 min"}
                      </button>
                      <button className="btn-ghost flex-1 !py-2.5 text-sm" onClick={() => onAtencion(id, "ACCIDENTE")}>
                        Accidente · 15 min
                      </button>
                    </div>
                  );
                })}
                <p className="text-[11px] text-white/45">Lesión: 3 min una vez por jugador. El accidente ajeno al juego no cuenta.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BotonStat({ tono, texto, corto, n, titulo, onClick, disabled }: { tono: "lima" | "coral" | "ambar"; texto: string; corto: string; n: number; titulo: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={titulo}
      title={titulo}
      className={clsx(
        "flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1 leading-tight transition active:scale-95 disabled:opacity-40",
        tono === "lima" && "border-lima/35 bg-lima/10 text-lima",
        tono === "coral" && "border-coral/35 bg-coral/10 text-coral",
        tono === "ambar" && "border-amber-300/35 bg-amber-300/10 text-amber-200",
      )}
    >
      <span className="truncate text-[11px] font-bold sm:text-xs">
        <span className="hidden lg:inline">{texto}</span>
        <span className="lg:hidden">{corto}</span>
      </span>
      <span className="font-display text-sm font-bold tabular text-white/80">{n}</span>
    </button>
  );
}

function AccionDupla({ icono, texto, corto, sub, onClick, disabled, activo }: { icono: React.ReactNode; texto: string; corto?: string; sub?: string; onClick: () => void; disabled?: boolean; activo?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx("flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1 text-[11px] font-semibold leading-tight text-white/80 transition active:scale-95 disabled:opacity-40 sm:text-xs", activo ? "bg-white/15" : "bg-white/[0.05]")}
    >
      <span className="flex items-center gap-1">
        {icono}
        <span className={clsx("truncate", corto && "hidden sm:inline")}>{texto}</span>
        {corto && <span className="truncate sm:hidden">{corto}</span>}
      </span>
      {sub && <span className="hidden truncate text-[10px] font-normal text-white/45 sm:block">Próx.: {sub}</span>}
    </button>
  );
}

/** Cambio de lado reglamentario en la franja: cuenta regresiva grande (FIP Regla 2). */
function FranjaCambio({ cambio }: { cambio: NonNullable<ReturnType<typeof cambioDeLadoEnCurso>> }) {
  const tiempo = !cambio.directo && cambio.quedan <= 0;
  const aviso = useRef(false);
  useEffect(() => {
    if (tiempo && !aviso.current) {
      aviso.current = true;
      sonar("alarma");
      vibrar([80, 60, 80]);
    }
  }, [tiempo]);
  return (
    <Franja tono={tiempo ? "coral" : "lima"}>
      <motion.span animate={{ x: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 1.2 }} className={clsx("flex size-11 shrink-0 items-center justify-center rounded-full text-marino-2", tiempo ? "bg-coral" : "bg-lima")}>
        <ArrowLeftRight className="size-6" />
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className={clsx("font-display text-xl font-bold leading-tight", tiempo ? "text-coral" : "text-lima")}>{tiempo ? "¡Tiempo! A jugar" : cambio.directo ? "Cambien de lado ya" : "Cambio de lado"}</p>
        <p className="truncate text-xs text-white/60">
          {cambio.directo ? "Primer game del set: sin descanso." : `${cambio.motivo} · máximo ${mmss(cambio.segundos)}`} Las duplas ya se cambiaron en la pantalla.
        </p>
      </div>
      {!cambio.directo && <span className={clsx("font-display text-4xl font-bold tabular", tiempo ? "text-coral" : "text-white")}>{mmss(cambio.quedan)}</span>}
    </Franja>
  );
}

/**
 * Cierre del partido: lo que se envía a mesa, con una cuenta regresiva corta y "Deshacer" grande.
 * Si nadie toca nada, se envía solo al terminar la cuenta.
 */
function CuentaCierre({ titulo, detalle, boton, onDeshacer, onEnviar }: { titulo: string; detalle: string; boton: string; onDeshacer: () => void; onEnviar: () => void }) {
  const [quedan, setQuedan] = useState(SEGUNDOS_CIERRE);
  const enviar = useRef(onEnviar);
  enviar.current = onEnviar;
  useEffect(() => {
    sonar("ok");
    const fin = Date.now() + SEGUNDOS_CIERRE * 1000;
    const t = setInterval(() => {
      const q = Math.ceil((fin - Date.now()) / 1000);
      setQuedan(q);
      if (q <= 0) {
        clearInterval(t);
        enviar.current();
      }
    }, 200);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-fondo/85 p-4 backdrop-blur">
      <motion.div initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} className="seleccion sobre-marca w-full max-w-xl rounded-[2rem] border p-6 text-center">
        <p className="label !text-lima">Partido terminado</p>
        <p className="font-display text-3xl font-bold leading-tight">{titulo}</p>
        <p className="mt-1 font-display text-2xl text-white/80">{detalle}</p>
        <div className="mx-auto mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: SEGUNDOS_CIERRE, ease: "linear" }} className="h-full bg-lima" />
        </div>
        <p className="mt-2 text-sm text-white/60">Se envía solo a mesa técnica en {Math.max(0, quedan)} s</p>
        <div className="mt-5 grid grid-cols-5 gap-2">
          <button className="col-span-3 flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 text-lg font-bold active:scale-[0.98]" onClick={onDeshacer}>
            <Undo2 className="size-6" /> {boton}
          </button>
          <button className="btn-neon col-span-2 min-h-16 text-lg" onClick={onEnviar}>
            <Send className="size-5" /> Enviar ya
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/45">
          <Check className="size-3.5" /> Si hay que corregir después, lo hace la mesa técnica.
        </p>
      </motion.div>
    </motion.div>
  );
}
