"use client";

import clsx from "clsx";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Crown, Minus, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { sonar, vibrar } from "@/lib/feedback";
import { descripcionPuntuacion, empateTieBreak, finalesDeSet, ganador, indiceSuperTie, metaDe, modoDe, normalizarResultado, tieConDiferencia, validarResultado, validarSet, validarTie } from "@/lib/scoring";
import type { ConfigPuntuacion, Jugador, Partido, Resultado, SetScore } from "@/types/americano";

interface Props {
  partido: Partido | null;
  config: ConfigPuntuacion;
  nombrePista: string;
  jugadores: Jugador[];
  onClose: () => void;
  onGuardar: (r: Resultado) => void;
  onBorrar: () => void;
}

function inicial(p: Partido | null, cfg: ConfigPuntuacion): Resultado {
  if (p?.resultado) return { ...p.resultado, sets: p.resultado.sets?.map((s) => ({ ...s })) };
  if (cfg.metodo === "SETS_CORTOS") return { puntosA: 0, puntosB: 0, sets: [{ a: 0, b: 0 }] };
  return { puntosA: 0, puntosB: 0 };
}

/** Modal táctil (bottom sheet) para cargar el marcador de un partido. */
export function ScoreModal({ partido, config, nombrePista, jugadores, onClose, onGuardar, onBorrar }: Props) {
  const [r, setR] = useState<Resultado>(() => inicial(partido, config));
  const [autoCompletar, setAutoCompletar] = useState(true);

  useEffect(() => {
    setR(inicial(partido, config));
    // Solo al abrir otro partido: una sincronización no debe borrar lo que se está cargando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido?.id]);

  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const nombres = (ids: string[]) => ids.map((id) => porId.get(id)?.nombre ?? "?");
  const fotos = (ids: string[]) => ids.map((id) => porId.get(id)?.fotoUrl);

  const normal = normalizarResultado(config, r);
  const error = validarResultado(config, r);
  const g = error ? null : ganador(config, normal);
  const total = metaDe(config);
  const maxGames = metaDe(config);
  const modo = modoDe(config);
  const autoTotal = config.metodo === "PUNTOS_TOTALES" && modo === "TOTAL";
  const empate = empateTieBreak(config);
  const enTie = empate !== null && Math.max(r.puntosA, r.puntosB) === empate + 1 && Math.min(r.puntosA, r.puntosB) === empate;
  const superTie = indiceSuperTie(config);
  const conDif = tieConDiferencia(config);
  // Sin diferencia de 2, nadie pasa del número del tie.
  const maxTie = (meta?: number | null) => (conDif ? 99 : meta ?? 99);
  const maxSet = (i: number) => (i === superTie ? maxTie(config.superTie) : maxGames >= 5 ? maxGames + 1 : maxGames);
  const setTerminado = (z: SetScore, i: number) => (i === superTie ? !validarTie(config.superTie!, z.a, z.b, conDif) : validarSet(maxGames, z.a, z.b));
  // Atajos de marcador final para games.
  const finalesGames: [number, number][] =
    modo === "TOTAL"
      ? [
          ...Array.from({ length: maxGames + 1 }, (_, k): [number, number] => [maxGames - k, k]).filter(([a, b]) => a > b),
          ...(empate !== null && 2 * empate === maxGames ? [[empate + 1, empate] as [number, number]] : []),
        ]
      : Array.from({ length: maxGames }, (_, k): [number, number] => [maxGames, k]);

  function setPuntos(lado: "A" | "B", v: number) {
    vibrar(8);
    sonar("tap");
    setR((x) => {
      const n = Math.max(0, v);
      if (autoTotal) {
        const val = Math.min(total, n);
        if (autoCompletar) return lado === "A" ? { puntosA: val, puntosB: total - val } : { puntosA: total - val, puntosB: val };
        return lado === "A" ? { ...x, puntosA: val } : { ...x, puntosB: val };
      }
      const val = Math.min(config.metodo === "PUNTOS_TOTALES" ? total : maxGames, n);
      // Cambiar los games invalida el tie-break cargado.
      return lado === "A" ? { puntosA: val, puntosB: x.puntosB } : { puntosA: x.puntosA, puntosB: val };
    });
  }

  function setSet(i: number, s: SetScore) {
    vibrar(8);
    sonar("tap");
    setR((x) => {
      const sets = [...(x.sets ?? [])];
      sets[i] = s;
      // Si alguien ya ganó los sets necesarios, recorta; si no, ofrece el siguiente set.
      const necesarios = Math.floor((config.setsMaximos ?? 3) / 2) + 1;
      const resumen = sets
        .slice(0, i + 1)
        .reduce((acc, z, j) => (setTerminado(z, j) ? { a: acc.a + (z.a > z.b ? 1 : 0), b: acc.b + (z.b > z.a ? 1 : 0) } : acc), { a: 0, b: 0 });
      const decidido = resumen.a >= necesarios || resumen.b >= necesarios;
      if (decidido) sets.length = i + 1;
      else if (setTerminado(s, i) && i === sets.length - 1 && sets.length < (config.setsMaximos ?? 3)) sets.push({ a: 0, b: 0 });
      return { ...x, sets };
    });
  }

  const [guardando, setGuardando] = useState(false);
  useEffect(() => setGuardando(false), [partido?.id]);

  function guardar() {
    if (guardando) return;
    if (error) {
      vibrar([30, 40, 30]);
      return;
    }
    setGuardando(true);
    sonar("ok");
    vibrar([15, 30, 15]);
    onGuardar(r);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <AnimatePresence>
      {partido && (
        <>
          <motion.div
            key="fondo"
            className="fixed inset-0 z-50 bg-marino-2/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="hoja"
            role="dialog"
            aria-modal
            aria-label={`Marcador ${nombrePista}`}
            className="glass-strong fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-[2rem] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:bottom-6 sm:rounded-[2rem]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neon">{nombrePista} · Ronda {partido.rondaNumero}</p>
                <p className="text-sm text-white/50">
                  {descripcionPuntuacion(config)}
                </p>
              </div>
              <button className="btn-ghost !p-2.5" onClick={onClose} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>

            {config.metodo !== "SETS_CORTOS" ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {(["A", "B"] as const).map((lado) => {
                  const par = lado === "A" ? partido.parejaA : partido.parejaB;
                  const valor = lado === "A" ? r.puntosA : r.puntosB;
                  const gana = g === (lado === "A" ? 1 : -1);
                  const max = config.metodo === "PUNTOS_TOTALES" ? total : maxGames;
                  return (
                    <div key={lado} className={clsx("relative rounded-3xl border-2 p-4 text-center transition", gana ? "border-neon bg-neon/10" : "border-white/10 bg-white/[0.03]")}>
                      <AnimatePresence>
                        {gana && (
                          <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neon p-1.5 text-noche">
                            <Crown className="size-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <div className="flex justify-center">
                        <AvatarPareja nombres={nombres(par.jugadorIds)} fotos={fotos(par.jugadorIds)} size={40} />
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold">{nombres(par.jugadorIds).join(" / ")}</p>
                      <motion.p key={valor} initial={{ scale: 1.25, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="my-3 font-display text-7xl font-bold tabular">
                        {valor}
                      </motion.p>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn-ghost h-14 !rounded-2xl !p-0" onClick={() => setPuntos(lado, valor - 1)} disabled={valor <= 0} aria-label="Restar">
                          <Minus className="size-6" />
                        </button>
                        <button className="btn-neon h-14 !rounded-2xl !p-0" onClick={() => setPuntos(lado, valor + 1)} disabled={valor >= max} aria-label="Sumar">
                          <Plus className="size-6" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold text-white/60">
                  <span className="truncate">{nombres(partido.parejaA.jugadorIds).join(" / ")}</span>
                  <span />
                  <span className="truncate">{nombres(partido.parejaB.jugadorIds).join(" / ")}</span>
                </div>
                {(r.sets ?? []).map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3">
                    <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">
                      {i === superTie ? `Super tie a ${config.superTie}` : `Set ${i + 1}`}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <SetStepper valor={s.a} max={maxSet(i)} onChange={(a) => setSet(i, { ...s, a })} gana={setTerminado(s, i) && s.a > s.b} />
                      <span className="text-white/30">–</span>
                      <SetStepper valor={s.b} max={maxSet(i)} onChange={(b) => setSet(i, { ...s, b })} gana={setTerminado(s, i) && s.b > s.a} />
                    </div>
                    {i !== superTie && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        {finalesDeSet(maxGames).map(([w, l]) => (
                          <button key={`a${w}-${l}`} className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60 hover:bg-neon/20 hover:text-neon" onClick={() => setSet(i, { a: w, b: l })}>
                            {w}-{l}
                          </button>
                        ))}
                        {finalesDeSet(maxGames).map(([w, l]) => (
                          <button key={`b${w}-${l}`} className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60 hover:bg-neon/20 hover:text-neon" onClick={() => setSet(i, { a: l, b: w })}>
                            {l}-{w}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {autoTotal && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-white/60">
                  <input type="checkbox" checked={autoCompletar} onChange={(e) => setAutoCompletar(e.target.checked)} className="size-4 accent-[#2b3bd6]" />
                  Autocompletar hasta {total}
                </label>
                <span className={clsx("font-semibold tabular", r.puntosA + r.puntosB === total ? "text-neon" : "text-white/50")}>
                  {r.puntosA + r.puntosB}/{total}
                </span>
              </div>
            )}

            {config.metodo === "GAMES_PUNTO_ORO" && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {finalesGames.map(([w, l]) => (
                  <button key={`a${w}-${l}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-neon/20 hover:text-neon" onClick={() => setR({ puntosA: w, puntosB: l })}>
                    {w}-{l}
                  </button>
                ))}
                {finalesGames.map(([w, l]) => (
                  <button key={`b${w}-${l}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-neon/20 hover:text-neon" onClick={() => setR({ puntosA: l, puntosB: w })}>
                    {l}-{w}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {enTie && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass mt-4 rounded-2xl p-3">
                    <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">Tie-break a {config.tieBreak}
                      {conDif ? "" : " sin diferencia de 2"} · opcional
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <SetStepper valor={r.tieBreak?.a ?? 0} max={maxTie(config.tieBreak)} onChange={(a) => setR((x) => ({ ...x, tieBreak: { a, b: x.tieBreak?.b ?? 0 } }))} gana={false} />
                      <span className="text-white/30">–</span>
                      <SetStepper valor={r.tieBreak?.b ?? 0} max={maxTie(config.tieBreak)} onChange={(b) => setR((x) => ({ ...x, tieBreak: { a: x.tieBreak?.a ?? 0, b } }))} gana={false} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (r.puntosA > 0 || r.puntosB > 0 || (r.sets ?? []).some((s) => s.a || s.b)) && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-center text-sm text-coral">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 flex gap-2">
              {partido.resultado ? (
                <button className="btn-ghost text-coral" onClick={onBorrar}>
                  <Trash2 className="size-4" /> Borrar
                </button>
              ) : (
                <button className="btn-ghost" onClick={() => setR(inicial(null, config))} aria-label="Reiniciar marcador">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button className="btn-neon flex-1 py-4 text-base" onClick={guardar} disabled={!!error || guardando}>
                <Save className="size-5" /> Guardar resultado
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SetStepper({ valor, max, onChange, gana }: { valor: number; max: number; onChange: (v: number) => void; gana: boolean }) {
  return (
    <div className={clsx("flex items-center justify-center gap-2 rounded-xl p-1 transition", gana && "bg-neon/10")}>
      <button className="btn-ghost size-10 !rounded-xl !p-0" onClick={() => onChange(Math.max(0, valor - 1))} disabled={valor <= 0} aria-label="Restar game">
        <Minus className="size-4" />
      </button>
      <span className={clsx("w-8 text-center font-display text-3xl font-bold tabular", gana && "text-neon")}>{valor}</span>
      <button className="btn-ghost size-10 !rounded-xl !p-0" onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max} aria-label="Sumar game">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
