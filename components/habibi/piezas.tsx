"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Crown, Medal, Trophy } from "lucide-react";
import { useMemo } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { nombrePista } from "@/lib/horarios";
import { CORTO_FASE, cruces, NOMBRE_FASE, configRonda, idsQueClasifican, infoLlave, podio, semillaDe, type CruceLlave } from "@/lib/habibi";
import { calcularTabla, ganador, nombreCompleto } from "@/lib/scoring";
import { vibrar } from "@/lib/feedback";
import type { EmparejarLlave, EventoAmericano, FaseLlave, InicioLlave, Jugador, Pareja } from "@/types/americano";

/* ---------- piezas del asistente ---------- */

export function Paso({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
      <p className="mb-8 mt-2 text-white/50">{sub}</p>
      {children}
    </div>
  );
}

export function Opcion({ activo, onClick, children, className, disabled }: { activo: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      onClick={() => {
        vibrar(10);
        onClick();
      }}
      aria-pressed={activo}
      className={clsx(
        "relative rounded-2xl border-2 p-4 text-left transition",
        activo ? "seleccion sobre-marca" : "glass border-transparent hover:border-white/20",
        disabled && "cursor-not-allowed opacity-40 hover:border-transparent",
        className,
      )}
    >
      {activo && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-lima text-noche shadow-[0_0_12px_rgba(207,243,91,0.6)]">
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      )}
      {children}
    </motion.button>
  );
}

/* ---------- nombres ---------- */

export function nombresPareja(p: Pareja | null | undefined, porId: Map<string, Jugador>, completo = false): string[] {
  if (!p) return [];
  return p.jugadorIds.map((id) => {
    const j = porId.get(id);
    return completo ? nombreCompleto(j) : j ? `${j.nombre}${j.apellido ? ` ${j.apellido.charAt(0)}.` : ""}` : "?";
  });
}

/* ---------- tabla de un grupo ---------- */

/**
 * Tabla de posiciones de un grupo con la línea de clasificación. En dupla fija, las
 * duplas que pasan a la llave llevan su semilla (1A, 2A…); en individual se marcan
 * los jugadores que hoy pasarían (con ellos se forman las duplas de la llave).
 */
export function TablaGrupo({ grupo, inicio, emparejar, tv = false, limite }: { grupo: EventoAmericano; inicio: InicioLlave; emparejar?: EmparejarLlave; tv?: boolean; limite?: number }) {
  const tabla = useMemo(() => calcularTabla(grupo), [grupo]);
  const pasan = useMemo(() => idsQueClasifican(grupo, inicio, emparejar), [grupo, inicio, emparejar]);
  const porId = new Map(grupo.jugadores.map((j) => [j.id, j]));
  const individual = grupo.modalidad !== "DUPLA_FIJA";
  const letra = grupo.habibi?.rol === "GRUPO" ? grupo.habibi.letra : "";
  const parejas = new Map(grupo.parejas.map((p) => [p.id, p]));
  let activos = 0;
  const filas = tabla.filas.map((f) => ({ f, semilla: f.retirado ? null : ++activos }));
  const vista = limite ? filas.slice(0, limite) : filas;
  // Línea de corte: después del último que pasa, si los que pasan van seguidos.
  const ultimo = Math.max(-1, ...vista.map(({ f }, i) => (pasan.has(f.entidadId) ? i : -1)));
  const seguidos = vista.slice(0, ultimo + 1).every(({ f }) => pasan.has(f.entidadId));
  return (
    <div className={clsx("overflow-hidden", tv ? "rounded-[2rem]" : "rounded-2xl")}>
      <div className={clsx("grid items-center gap-2 px-3 font-semibold uppercase tracking-wider text-white/40", tv ? "grid-cols-[3.5rem_1fr_3.5rem_3.5rem_4.5rem_5rem] py-2 text-lg" : "grid-cols-[2.25rem_1fr_2rem_2rem_2.75rem_3rem] py-1.5 text-[10px]")}>
        <span>#</span>
        <span>{individual ? "Jugador" : "Dupla"}</span>
        <span className="text-center">PJ</span>
        <span className="text-center">PG</span>
        <span className="text-center">+/-</span>
        <span className="text-right">PTS</span>
      </div>
      {vista.map(({ f, semilla }, i) => {
        const pasa = pasan.has(f.entidadId);
        const j = porId.get(f.entidadId);
        const nombres = individual ? [tv ? nombreCompleto(j) : (j?.nombre ?? f.nombre) + (j?.apellido ? ` ${j.apellido.charAt(0)}.` : "")] : nombresPareja(parejas.get(f.entidadId), porId, tv);
        const corte = seguidos && i === ultimo && i < vista.length - 1;
        return (
          <motion.div
            layout
            key={f.entidadId}
            className={clsx(
              "grid items-center gap-2 px-3",
              tv ? "grid-cols-[3.5rem_1fr_3.5rem_3.5rem_4.5rem_5rem] py-3" : "grid-cols-[2.25rem_1fr_2rem_2rem_2.75rem_3rem] py-2",
              i % 2 === 0 && "bg-white/[0.03]",
              corte && "border-b-2 border-dashed border-neon/40",
              f.retirado && "opacity-40",
            )}
          >
            <span
              className={clsx(
                "inline-flex items-center justify-center rounded-full font-display font-bold tabular",
                tv ? "size-12 text-xl" : "size-8 text-[11px]",
                pasa ? "bg-neon text-noche" : "bg-white/5 text-white/60",
              )}
              title={pasa ? (individual ? "Pasa a la llave" : `Clasifica como ${semilla}${letra}`) : undefined}
            >
              {semilla ? (individual ? semilla : `${semilla}${letra}`) : "–"}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              {/* En el celular no hay lugar para fotos y nombres: se priorizan los nombres. */}
              <span className={clsx(!tv && "hidden sm:flex")}>
                <AvatarPareja nombres={nombres} fotos={f.fotoUrls} size={tv ? 52 : 30} />
              </span>
              <span className="min-w-0">
                {nombres.map((n, k) => (
                  <span key={k} className={clsx("block truncate leading-tight", tv ? "text-2xl font-semibold" : "text-sm font-medium")}>
                    {n}
                  </span>
                ))}
              </span>
            </span>
            <span className={clsx("text-center tabular text-white/70", tv ? "text-2xl" : "text-sm")}>{f.pj}</span>
            <span className={clsx("text-center tabular text-white/70", tv ? "text-2xl" : "text-sm")}>{f.pg}</span>
            <span className={clsx("text-center tabular", tv ? "text-2xl" : "text-sm", f.diferencia > 0 ? "text-neon" : f.diferencia < 0 ? "text-coral" : "text-white/50")}>
              {f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia}
            </span>
            <span className={clsx("text-right font-display font-bold tabular", tv ? "text-4xl" : "text-lg")}>{f.puntos}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------- llave ---------- */

export function useCruces(llave: EventoAmericano) {
  return useMemo(() => cruces(llave), [llave]);
}

/** Tarjeta de un cruce de la llave. */
export function CruceCard({
  llave,
  cruce,
  porId,
  onClick,
  tv = false,
}: {
  llave: EventoAmericano;
  cruce: CruceLlave;
  porId: Map<string, Jugador>;
  onClick?: () => void;
  tv?: boolean;
}) {
  const ronda = llave.rondas.find((r) => r.fase === cruce.fase);
  const cfg = configRonda(llave, ronda);
  const p = cruce.partido;
  const res = p?.resultado ?? null;
  const g = res ? ganador(cfg, res) : null;
  const armada = !!infoLlave(llave)?.armadaEn;
  const listo = !!cruce.parejaA && !!cruce.parejaB;
  const enJuego = p?.estado === "EN_JUEGO";
  const pista = listo ? llave.rondas.flatMap((r) => r.partidos).find((x) => x.id === cruce.id)?.pista : undefined;

  const lado = (l: "A" | "B") => {
    const par = l === "A" ? cruce.parejaA : cruce.parejaB;
    const origen = l === "A" ? cruce.origenA : cruce.origenB;
    const semilla = par ? semillaDe(llave, par.id) : null;
    const gana = g === (l === "A" ? 1 : -1);
    const nombres = nombresPareja(par, porId, tv);
    const valor = res ? (l === "A" ? res.puntosA : res.puntosB) : null;
    return (
      <div className={clsx("flex items-center gap-2", tv ? "min-h-16 px-4 py-2" : "min-h-12 px-3 py-1.5", gana && "bg-neon/10", res && !gana && "opacity-55")}>
        <span className={clsx("shrink-0 rounded-md font-bold tabular", tv ? "w-12 text-center text-lg" : "w-8 text-center text-[10px]", semilla ? "bg-white/5 text-white/60" : "text-white/30")}>{semilla ?? ""}</span>
        {par ? (
          <>
            <AvatarPareja nombres={nombres} fotos={par.jugadorIds.map((id) => porId.get(id)?.fotoUrl)} size={tv ? 44 : 28} />
            <span className="min-w-0 flex-1">
              {nombres.map((n, k) => (
                <span key={k} className={clsx("block truncate leading-tight", tv ? "text-xl" : "text-[13px]", gana ? "font-bold" : "font-medium")}>
                  {n}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className={clsx("flex-1 italic text-white/40", tv ? "text-lg" : "text-xs")}>{armada ? origen : semillaTexto(origen)}</span>
        )}
        {gana && <Crown className={clsx("shrink-0 text-neon", tv ? "size-6" : "size-4")} />}
        {valor !== null && (
          <span className={clsx("shrink-0 font-display font-bold tabular", tv ? "text-4xl" : "text-xl", gana ? "text-neon" : "text-white/70")}>
            {valor}
            {res?.desempate && res.puntosA === res.puntosB && gana && <span className={clsx("ml-0.5 align-top", tv ? "text-base" : "text-[9px]")}>★</span>}
          </span>
        )}
      </div>
    );
  };

  const Contenedor = onClick && listo ? motion.button : motion.div;
  return (
    <Contenedor
      layout
      {...(onClick && listo ? { onClick, whileTap: { scale: 0.98 }, type: "button" as const } : {})}
      className={clsx(
        "glass block w-full overflow-hidden text-left",
        tv ? "rounded-3xl" : "rounded-2xl",
        cruce.fase === "FINAL" && "ring-2 ring-neon/50",
        enJuego && "border-neon/40",
        onClick && listo && "transition hover:border-neon/40",
      )}
    >
      <div className={clsx("flex items-center justify-between border-b border-white/5 font-semibold uppercase tracking-wider text-white/45", tv ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-[10px]")}>
        <span>
          {cruce.fase === "FINAL" || cruce.fase === "TERCER_PUESTO" ? NOMBRE_FASE[cruce.fase] : `${CORTO_FASE[cruce.fase]} ${cruce.indice + 1}`}
          {pista !== undefined && ` · ${nombrePista(llave, pista)}`}
        </span>
        {p?.estado === "FINALIZADO" ? (
          <span className="text-neon">Final{res?.sets?.length ? ` ${res.sets.map((s) => `${s.a}-${s.b}`).join(" ")}` : ""}</span>
        ) : enJuego ? (
          <span className="flex items-center gap-1 text-neon">
            <span className="size-1.5 animate-pulse rounded-full bg-neon" /> En juego
          </span>
        ) : listo ? (
          <span>Por jugar</span>
        ) : null}
      </div>
      {lado("A")}
      <div className="h-px bg-white/5" />
      {lado("B")}
    </Contenedor>
  );
}

/** "1A" → "1º del grupo A" mientras los grupos siguen en juego. */
function semillaTexto(origen: string) {
  const m = /^(\d+)([A-Z])$/.exec(origen);
  return m ? `${m[1]}º del grupo ${m[2]}` : origen;
}

/**
 * La llave completa en columnas (una por fase), con los cruces alineados como un
 * cuadro de tenis. En el celular se desliza de lado.
 */
export function Llave({ llave, onPartido, tv = false }: { llave: EventoAmericano; onPartido?: (c: CruceLlave) => void; tv?: boolean }) {
  const lista = useCruces(llave);
  const porId = new Map(llave.jugadores.map((j) => [j.id, j]));
  const info = infoLlave(llave);
  if (!info) return null;
  const fases = [...new Set(lista.map((c) => c.fase))].filter((f) => f !== "TERCER_PUESTO") as FaseLlave[];
  const tercero = lista.find((c) => c.fase === "TERCER_PUESTO");
  return (
    <div className={clsx("no-scrollbar overflow-x-auto", tv ? "" : "-mx-4 px-4 pb-2 sm:mx-0 sm:px-0")}>
      <div className={clsx("grid", tv ? "gap-6" : "gap-3")} style={{ gridTemplateColumns: `repeat(${fases.length}, minmax(${tv ? "16rem" : "14.5rem"}, 1fr))` }}>
        {fases.map((fase) => (
          <div key={fase} className="flex flex-col">
            <p className={clsx("mb-2 text-center font-semibold uppercase tracking-[0.2em]", tv ? "text-lg text-white/60" : "text-[11px] text-white/45", fase === "FINAL" && "!text-neon")}>
              {NOMBRE_FASE[fase]}
            </p>
            <div className={clsx("flex flex-1 flex-col justify-around", tv ? "gap-4" : "gap-3")}>
              {lista
                .filter((c) => c.fase === fase)
                .map((c) => (
                  <CruceCard key={c.id} llave={llave} cruce={c} porId={porId} tv={tv} onClick={onPartido ? () => onPartido(c) : undefined} />
                ))}
              {fase === "FINAL" && tercero && (
                <div className={tv ? "mt-6" : "mt-4"}>
                  <CruceCard llave={llave} cruce={tercero} porId={porId} tv={tv} onClick={onPartido ? () => onPartido(tercero) : undefined} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- podio ---------- */

export function PodioHabibi({ llave, tv = false, className }: { llave: EventoAmericano; tv?: boolean; className?: string }) {
  const lugares = podio(llave);
  const porId = new Map(llave.jugadores.map((j) => [j.id, j]));
  if (!lugares.length) return null;
  const campeon = lugares[0];
  const resto = lugares.slice(1);
  const nombres = nombresPareja(campeon.pareja, porId, true);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={clsx("glass relative overflow-hidden text-center", tv ? "rounded-[2.5rem] p-10" : "rounded-3xl p-6", className)}>
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-neon/20 blur-3xl" />
      <motion.div className="relative" animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
        <Trophy className={clsx("mx-auto text-neon", tv ? "size-24" : "size-12")} />
      </motion.div>
      <p className={clsx("relative mt-3 font-semibold uppercase tracking-[0.3em] text-white/50", tv ? "text-xl" : "text-[11px]")}>Campeones</p>
      <div className="relative mt-4 flex justify-center">
        <AvatarPareja nombres={nombres} fotos={campeon.pareja.jugadorIds.map((id) => porId.get(id)?.fotoUrl)} size={tv ? 110 : 64} />
      </div>
      <p className={clsx("relative mt-3 font-display font-bold leading-tight", tv ? "text-5xl" : "text-2xl")}>{nombres.join(" / ")}</p>
      {resto.length > 0 && (
        <div className={clsx("relative mx-auto mt-6 grid gap-3 text-left", tv ? "max-w-3xl grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
          {resto.map((x) => (
            <div key={x.pareja.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
              <Medal className={clsx("shrink-0", x.lugar === 2 ? "text-slate-300" : "text-orange-400", tv ? "size-8" : "size-5")} />
              <div className="min-w-0">
                <p className={clsx("font-semibold uppercase tracking-wider text-white/40", tv ? "text-sm" : "text-[10px]")}>{x.lugar}º lugar</p>
                <p className={clsx("truncate font-semibold", tv ? "text-xl" : "text-sm")}>{nombresPareja(x.pareja, porId).join(" / ")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
