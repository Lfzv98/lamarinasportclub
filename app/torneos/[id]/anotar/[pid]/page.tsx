"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, Check, CircleSlash, Flag, MoreHorizontal, Undo2, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StaffGate } from "@/components/StaffGate";
import { Hoja } from "@/components/ui/Hoja";
import { toast } from "@/components/ui/Toaster";
import { TorneoShellMinimo } from "@/components/torneo/minimo";
import { sonar, vibrar } from "@/lib/feedback";
import { nombreCorto } from "@/lib/torneo/categorias";
import {
  ace,
  anotarPunto,
  calcularMarcador,
  deshacer,
  detallarUltimo,
  faltaSaque,
  NOMBRE_GOLPE,
  nuevoMarcador,
  relatoPunto,
  setsFinales,
  statsPartido,
  type Lado,
} from "@/lib/torneo/marcador";
import { resultadoRetiro, textoSets } from "@/lib/torneo/tabla";
import { nombrePista } from "@/lib/torneo/imprevistos";
import { cargarResultado, categoria, dupla, iniciarPartido, nombreDupla, partido, reglasDe } from "@/lib/torneo/torneo";
import { useAmericanos } from "@/lib/store";
import { useMarcador, useTorneos } from "@/lib/torneosStore";
import type { FinPunto, Golpe, JugadorTorneo, MarcadorVivo, PartidoTorneo, Torneo } from "@/types/torneo";

export default function AnotarPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  return (
    <StaffGate>
      <TorneoShellMinimo id={id}>{(t) => <Anotador torneo={t} partidoId={decodeURIComponent(pid)} />}</TorneoShellMinimo>
    </StaffGate>
  );
}

const GOLPES: Golpe[] = ["REMATE", "X3", "X4", "VIBORA", "BANDEJA", "VOLEA", "GLOBO", "CHIQUITA", "BAJADA", "DRIVE", "REVES"];

const corto = (j?: JugadorTorneo) => (j ? j.nombre : "?");

function Anotador({ torneo, partidoId }: { torneo: Torneo; partidoId: string }) {
  const p = partido(torneo, partidoId);
  const marcador = useMarcador(partidoId);
  // Antes de ofrecer "empezar", trae el marcador del servidor: si el partido ya se está
  // anotando en otro teléfono, se sigue desde ahí en vez de empezar de cero.
  const [listo, setListo] = useState(false);
  useEffect(() => {
    useTorneos.getState().sincronizarMarcadores(torneo.id).finally(() => setListo(true));
  }, [torneo.id]);
  if (!p) return <p className="p-10 text-center text-white/60">Partido no encontrado.</p>;
  if (!p.duplaA || !p.duplaB) return <p className="p-10 text-center text-white/60">Todavía no se conocen las dos duplas.</p>;
  if (!marcador && !listo)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );
  if (!marcador) return <Preparar torneo={torneo} p={p} />;
  return <Tablero torneo={torneo} p={p} m={marcador} />;
}

/* ---------- 1. quién saca: dos toques ---------- */

function Preparar({ torneo, p }: { torneo: Torneo; p: PartidoTorneo }) {
  const guardarMarcador = useTorneos((s) => s.guardarMarcador);
  const guardar = useTorneos((s) => s.guardar);
  const staff = useAmericanos((s) => s.staff);
  const dA = dupla(torneo, p.duplaA)!;
  const dB = dupla(torneo, p.duplaB)!;
  const [primero, setPrimero] = useState<{ lado: Lado; id: string } | null>(null);
  const jug = (id: string) => torneo.jugadores.find((j) => j.id === id);
  const pista = p.pistaReal ?? p.programacion?.pista ?? torneo.canchas[0]?.numero ?? 1;

  function empezar(otro: string) {
    if (!primero) return;
    const m = nuevoMarcador({
      partidoId: p.id,
      torneoId: torneo.id,
      categoriaId: p.categoriaId,
      reglas: reglasDe(torneo, p),
      jugadoresA: dA.jugadorIds,
      jugadoresB: dB.jugadorIds,
      sacaPrimero: primero.lado,
      primerA: primero.lado === "A" ? primero.id : otro,
      primerB: primero.lado === "B" ? primero.id : otro,
      pista,
      anotador: staff?.nombre,
    });
    vibrar([10, 40, 10]);
    sonar("ok");
    guardarMarcador(m);
    guardar(iniciarPartido(torneo, p.id, pista));
  }

  const Equipo = ({ lado, ids }: { lado: Lado; ids: string[] }) => {
    const elegible = !primero || primero.lado !== lado;
    return (
      <div className={clsx("glass rounded-3xl p-4 transition", !elegible && "opacity-40")}>
        <p className="mb-3 font-display text-lg font-bold">{nombreDupla(torneo, lado === "A" ? dA : dB)}</p>
        <div className="grid grid-cols-2 gap-3">
          {ids.map((id) => {
            const j = jug(id);
            const sel = primero?.id === id;
            return (
              <button
                key={id}
                disabled={!elegible}
                onClick={() => {
                  vibrar(10);
                  if (!primero) setPrimero({ lado, id });
                  else empezar(id);
                }}
                className={clsx("flex flex-col items-center gap-2 rounded-2xl border p-4 transition active:scale-95", sel ? "seleccion sobre-marca" : "border-white/10 hover:border-neon/40")}
              >
                <Avatar nombre={[j?.nombre, j?.apellido].join(" ")} fotoUrl={j?.fotoUrl} size={56} />
                <span className="text-sm font-semibold">{corto(j)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 py-3">
        <Link href={`/torneos/${torneo.id}`} className="btn-ghost !p-2.5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.etiqueta}</p>
          <p className="text-xs text-white/50">{nombreCorto(categoria(torneo, p.categoriaId)!.categoria)} · {nombrePista(torneo, pista)}</p>
        </div>
      </header>
      <h1 className="mt-4 font-display text-3xl font-bold">{primero ? "¿Y quién saca primero en la otra dupla?" : "¿Quién saca primero?"}</h1>
      <p className="mt-1 text-white/55">{primero ? "Un toque más y empieza el partido." : "Toca al jugador. Con esto el orden de saque y los cambios de lado van solos."}</p>
      <div className="mt-6 space-y-4">
        <Equipo lado="A" ids={dA.jugadorIds} />
        <Equipo lado="B" ids={dB.jugadorIds} />
      </div>
      {primero && (
        <button className="btn-ghost mt-4 w-full" onClick={() => setPrimero(null)}>
          Cambiar sacador
        </button>
      )}
    </main>
  );
}

/* ---------- 2. el tablero: un toque por punto ---------- */

interface Bandeja {
  /** Número del punto al que pertenece (si llega otro, se cierra sola). */
  n: number;
  gana: Lado;
  paso: "COMO" | "GOLPE";
}

function Tablero({ torneo, p, m }: { torneo: Torneo; p: PartidoTorneo; m: MarcadorVivo }) {
  const router = useRouter();
  const guardarMarcador = useTorneos((s) => s.guardarMarcador);
  const guardar = useTorneos((s) => s.guardar);
  const e = useMemo(() => calcularMarcador(m), [m]);
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jug = (id: string) => torneo.jugadores.find((j) => j.id === id);
  const nombreLado = (l: Lado) => nombreDupla(torneo, dupla(torneo, l === "A" ? p.duplaA : p.duplaB));
  const ultimo = e.jugados.at(-1);

  // Partido que se reanuda (suspendido por lluvia, cambio de pista…): vuelve a estar en juego
  // en su pista nueva y sigue con el mismo marcador.
  useEffect(() => {
    if (p.estado === "EN_JUEGO" || p.estado === "FINALIZADO" || m.finalizado) return;
    const pista = p.pistaReal ?? p.programacion?.pista ?? m.pista ?? null;
    guardar(iniciarPartido(torneo, p.id, pista ?? undefined));
    if (pista !== m.pista) guardarMarcador({ ...m, pista, actualizadoEn: new Date().toISOString() });
    if (p.suspendido) toast(`Se reanuda: ${textoSets(setsFinales(e).filter((s) => s.a + s.b > 0)) || "0-0"}`, "info");
    // Solo al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrarLuego = (ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBandeja(null), ms);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // Avisos al anotador: cambio de lado, fin de set.
  const avisado = useRef(m.puntos.length);
  useEffect(() => {
    if (m.puntos.length <= avisado.current) {
      avisado.current = m.puntos.length;
      return;
    }
    avisado.current = m.puntos.length;
    if (ultimo?.evento === "SET") toast(`Set para ${nombreLado(ultimo.gana)}`, "info");
    if (e.cambioDeLado) {
      toast("Cambio de lado", "info");
      vibrar([30, 60, 30]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.puntos.length]);

  function punto(l: Lado) {
    if (e.terminado) return;
    vibrar(15);
    sonar("tap");
    const nuevo = anotarPunto(m, l);
    guardarMarcador(nuevo);
    setBandeja({ n: nuevo.puntos.length, gana: l, paso: "COMO" });
    cerrarLuego(4000);
  }

  function como(fin: FinPunto, jugadorId: string) {
    if (!bandeja || bandeja.n !== m.puntos.length) return;
    vibrar(8);
    guardarMarcador(detallarUltimo(m, { fin, jugadorId }));
    setBandeja({ ...bandeja, paso: "GOLPE" });
    cerrarLuego(3500);
  }

  function golpe(g: Golpe) {
    vibrar(8);
    guardarMarcador(detallarUltimo(m, { golpe: g }));
    setBandeja(null);
  }

  function confirmar(tipo: "NORMAL" | "RETIRO" = "NORMAL", ganador?: Lado) {
    const reglas = reglasDe(torneo, p);
    const resultado =
      tipo === "RETIRO" ? resultadoRetiro(reglas, setsFinales(e).filter((s) => s.a + s.b > 0), ganador!) : { sets: setsFinales(e), ganador: e.ganador!, tipo: "NORMAL" as const };
    guardarMarcador({ ...m, finalizado: true, actualizadoEn: new Date().toISOString() });
    guardar(cargarResultado(torneo, p.id, resultado));
    sonar("ok");
    toast(`Resultado guardado: ${textoSets(resultado.sets)}`);
    router.push(`/torneos/${torneo.id}`);
  }

  const Mitad = ({ lado }: { lado: Lado }) => {
    const i = lado === "A" ? 0 : 1;
    const saca = !e.terminado && e.equipoSaca === lado;
    const ids = lado === "A" ? m.jugadoresA : m.jugadoresB;
    return (
      <button
        onClick={() => punto(lado)}
        disabled={e.terminado}
        className={clsx(
          "relative flex flex-1 select-none flex-col items-center justify-center overflow-hidden rounded-[2rem] border transition active:scale-[0.985]",
          lado === "A" ? "border-lima/25 bg-gradient-to-br from-marino to-marino-2" : "border-cielo/25 bg-gradient-to-br from-[#122a6b] to-marino-2",
        )}
      >
        <span className={clsx("pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full blur-3xl", lado === "A" ? "bg-lima/15" : "bg-cielo/20")} />
        <span className="relative flex items-center gap-2 text-sm font-semibold text-white/75">
          {ids.map((id) => (
            <span key={id} className={clsx("flex items-center gap-1.5 rounded-full px-2 py-0.5", saca && e.sacador === id && "bg-lima text-marino-2")}>
              {saca && e.sacador === id && <Zap className="size-3" />}
              {corto(jug(id))}
            </span>
          ))}
        </span>
        <motion.span key={`${e.texto[i]}-${m.puntos.length}`} initial={{ scale: 0.8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="relative font-display text-[22vw] font-bold leading-none tabular landscape:text-[16vh] sm:text-8xl">
          {e.texto[i]}
        </motion.span>
        <span className="relative mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Toca para punto</span>
      </button>
    );
  };

  const sets = setsFinales(e);

  return (
    <main className="flex h-dvh flex-col gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Marcador */}
      <header className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
        <Link href={`/torneos/${torneo.id}`} className="btn-ghost !p-2" aria-label="Salir">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          {(["A", "B"] as const).map((l) => (
            <div key={l} className="flex items-center gap-2 text-sm">
              <span className={clsx("size-1.5 rounded-full", e.equipoSaca === l && !e.terminado ? "bg-lima" : "bg-transparent")} />
              <span className="min-w-0 flex-1 truncate font-semibold">{nombreLado(l)}</span>
              {sets.map((s, j) => (
                <span key={j} className={clsx("w-5 text-center font-display tabular", j === e.setActual && !e.terminado ? "font-bold text-lima" : "text-white/55")}>
                  {l === "A" ? s.a : s.b}
                </span>
              ))}
            </div>
          ))}
        </div>
        <button className="btn-ghost !p-2" onClick={() => setMenu(true)} aria-label="Más opciones">
          <MoreHorizontal className="size-4" />
        </button>
      </header>

      <AnimatePresence>
        {!e.terminado && (e.puntoDeOro || e.matchPoint || e.setPoint || e.enTie) && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-xs font-bold uppercase tracking-[0.2em] text-lima">
            {e.matchPoint ? `Punto de partido · ${nombreLado(e.matchPoint)}` : e.setPoint ? `Punto de set · ${nombreLado(e.setPoint)}` : e.puntoDeOro ? "Punto de oro" : e.enSuperTie ? "Súper tie-break" : "Tie-break"}
          </motion.p>
        )}
      </AnimatePresence>

      {e.terminado ? (
        <Final torneo={torneo} m={m} nombreLado={nombreLado} onConfirmar={() => confirmar()} onDeshacer={() => guardarMarcador(deshacer(m))} />
      ) : (
        <div className="relative flex flex-1 flex-col gap-2 landscape:flex-row">
          <Mitad lado="A" />
          <Mitad lado="B" />

          {/* Toques 2 y 3, opcionales: no bloquean el siguiente punto. */}
          <AnimatePresence>
            {bandeja && bandeja.n === m.puntos.length && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
                className="glass-strong absolute inset-x-2 bottom-2 rounded-3xl p-3"
                onClick={(ev) => ev.stopPropagation()}
              >
                {bandeja.paso === "COMO" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-lima">Winner de</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(bandeja.gana === "A" ? m.jugadoresA : m.jugadoresB).map((id) => (
                          <button key={id} className="btn-ghost !flex-col !gap-1 !px-1 !py-2 text-xs" onClick={() => como("WINNER", id)}>
                            <Avatar nombre={corto(jug(id))} size={28} />
                            {corto(jug(id))}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-coral">Error de</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(bandeja.gana === "A" ? m.jugadoresB : m.jugadoresA).map((id) => (
                          <div key={id} className="flex flex-col gap-1">
                            <button className="btn-ghost !flex-col !gap-1 !px-1 !py-2 text-xs" onClick={() => como("ERROR_NO_FORZADO", id)}>
                              <Avatar nombre={corto(jug(id))} size={28} />
                              {corto(jug(id))}
                            </button>
                            <button className="rounded-lg bg-white/5 py-1 text-[10px] font-semibold text-white/60" onClick={() => como("ERROR_FORZADO", id)}>
                              forzado
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">¿Con qué golpe? (opcional)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {GOLPES.map((g) => (
                        <button key={g} className="btn-ghost !px-3 !py-2 text-xs capitalize" onClick={() => golpe(g)}>
                          {NOMBRE_GOLPE[g]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <motion.span className="absolute inset-x-6 bottom-1 h-0.5 origin-left rounded-full bg-lima/60" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: bandeja.paso === "COMO" ? 4 : 3.5, ease: "linear" }} key={bandeja.paso} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Saque y deshacer */}
      {!e.terminado && (
        <footer className="grid grid-cols-3 gap-2">
          <button className={clsx("btn-ghost !py-3.5", m.faltaPendiente && "!border-amber-300/60 !text-amber-200")} onClick={() => guardarMarcador(faltaSaque(m))}>
            <CircleSlash className="size-4" /> {m.faltaPendiente ? "2ª falta" : "Falta"}
          </button>
          <button
            className="btn-ghost !py-3.5"
            onClick={() => {
              vibrar(15);
              guardarMarcador(ace(m));
            }}
          >
            <Zap className="size-4" /> Ace
          </button>
          <button
            className="btn-ghost !py-3.5"
            disabled={!m.puntos.length && !m.faltaPendiente}
            onClick={() => {
              vibrar(20);
              setBandeja(null);
              guardarMarcador(deshacer(m));
            }}
          >
            <Undo2 className="size-4" /> Deshacer
          </button>
        </footer>
      )}
      {ultimo && !e.terminado && <p className="truncate text-center text-[11px] text-white/40">{relatoPunto(ultimo, (id) => corto(jug(id)), nombreLado)}</p>}

      <Hoja abierta={menu} onClose={() => setMenu(false)} titulo="Opciones del partido" sub={p.etiqueta}>
        <div className="space-y-2">
          <button
            className="btn-ghost w-full"
            onClick={() => {
              // Rota el orden de saque de una dupla (si se cargó mal quién sacaba).
              const [s0, s1, s2, s3] = m.ordenSaque;
              guardarMarcador({ ...m, ordenSaque: [s2, s1, s0, s3], actualizadoEn: new Date().toISOString() });
              setMenu(false);
              toast("Se cambió el sacador de la primera dupla.", "info");
            }}
          >
            <ArrowLeftRight className="size-4" /> Corregir quién saca (dupla que abrió)
          </button>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              const [s0, s1, s2, s3] = m.ordenSaque;
              guardarMarcador({ ...m, ordenSaque: [s0, s3, s2, s1], actualizadoEn: new Date().toISOString() });
              setMenu(false);
              toast("Se cambió el sacador de la segunda dupla.", "info");
            }}
          >
            <ArrowLeftRight className="size-4" /> Corregir quién saca (otra dupla)
          </button>
          <p className="label !mt-5">Retiro por lesión</p>
          {(["A", "B"] as const).map((l) => (
            <button
              key={l}
              className="btn-ghost w-full !text-coral"
              onClick={() => {
                if (!confirm(`¿Se retira ${nombreLado(l)}? El partido se da a la otra dupla.`)) return;
                confirmar("RETIRO", l === "A" ? "B" : "A");
              }}
            >
              <Flag className="size-4" /> Se retira {nombreLado(l)}
            </button>
          ))}
        </div>
      </Hoja>
    </main>
  );
}

function Final({ torneo, m, nombreLado, onConfirmar, onDeshacer }: { torneo: Torneo; m: MarcadorVivo; nombreLado: (l: Lado) => string; onConfirmar: () => void; onDeshacer: () => void }) {
  const e = calcularMarcador(m);
  const stats = statsPartido(m);
  const jug = (id: string) => torneo.jugadores.find((j) => j.id === id);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="seleccion sobre-marca rounded-[2rem] border p-6 text-center">
        <p className="label !text-lima">Partido terminado</p>
        <p className="font-display text-3xl font-bold">{nombreLado(e.ganador!)}</p>
        <p className="mt-1 font-display text-xl text-white/80">{textoSets(setsFinales(e), e.ganador === "B")}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.jugadorId} className="glass rounded-2xl p-3 text-xs">
            <p className="mb-1 truncate font-semibold">{jug(s.jugadorId)?.nombre}</p>
            <p className="text-white/60">
              {s.winners} winners · {s.erroresNoForzados} ENF · {s.aces} aces
            </p>
          </div>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
        <button className="btn-ghost" onClick={onDeshacer}>
          <Undo2 className="size-4" /> Deshacer
        </button>
        <button className="btn-neon col-span-2 text-base" onClick={onConfirmar}>
          <Check className="size-5" /> Confirmar resultado
        </button>
      </div>
    </div>
  );
}
