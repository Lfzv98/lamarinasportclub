"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { aviso, calcular, esSuperTieBreak, textoPuntos, type Aviso, type EstadoTenis } from "@/lib/tenis/marcador";
import { idsDe, inscrito, nombreInscrito } from "@/lib/tenis/torneo";
import type { Lado, PartidoTenis, SetJugado, TorneoTenis } from "@/types/tenis";
import { PelotaTenis } from "./piezas";

export interface VistaPartido {
  e: EstadoTenis | null;
  aviso: { tipo: Aviso; para: Lado | null } | null;
  puntos: [string, string];
  /** Sets para mostrar: los terminados más el que está en juego. */
  sets: (SetJugado & { enCurso?: boolean; superTb?: boolean })[];
}

export function vistaPartido(t: TorneoTenis, p: PartidoTenis): VistaPartido {
  if (!p.marcador) {
    return { e: null, aviso: null, puntos: ["", ""], sets: (p.resultado?.sets ?? []).map((s, i) => ({ ...s, superTb: esSuperTieBreak(t.reglas, i) })) };
  }
  const ids = idsDe(t, p.a);
  const e = calcular(p.marcador, t.reglas, ids);
  const terminado = e.ganador !== null || !!p.resultado;
  const sets: VistaPartido["sets"] = e.sets.map((s, i) => ({ ...s, superTb: esSuperTieBreak(t.reglas, i) }));
  if (!terminado) sets.push({ a: e.juegos[0], b: e.juegos[1], enCurso: true, superTb: e.superTieBreak, tb: e.superTieBreak ? [e.puntos[0], e.puntos[1]] : null });
  return { e, aviso: terminado ? null : aviso(e, p.marcador, t.reglas, ids), puntos: terminado ? ["", ""] : textoPuntos(e, t.reglas), sets };
}

export function useVistaPartido(t: TorneoTenis | undefined, p: PartidoTenis | undefined) {
  return useMemo(() => (t && p ? vistaPartido(t, p) : null), [t, p]);
}

export const TEXTO_AVISO: Record<Aviso, string> = {
  PUNTO_DE_PARTIDO: "Punto de partido",
  PUNTO_DE_SET: "Punto de set",
  PUNTO_DE_QUIEBRE: "Punto de quiebre",
  PUNTO_DECISIVO: "Punto decisivo",
};

/**
 * Marcador estilo transmisión: una fila por lado, sets, juegos y puntos del juego en curso.
 * `tam` cambia la escala (normal para el celular, tv para pantallas grandes).
 */
export function MarcadorTenis({ torneo: t, partido: p, tam = "normal", compacto = false, className }: { torneo: TorneoTenis; partido: PartidoTenis; tam?: "normal" | "tv"; compacto?: boolean; className?: string }) {
  const v = vistaPartido(t, p);
  const tv = tam === "tv";
  const ganador = p.resultado?.ganador ?? null;
  const fila = (lado: Lado) => {
    const iid = lado === 0 ? p.a : p.b;
    const ins = inscrito(t, iid);
    const saca = v.e && v.e.ganador === null && !p.resultado && v.e.equipoSaca === lado;
    const perdio = ganador !== null && ganador !== lado;
    return (
      <div className={clsx("flex items-center", tv ? "gap-5 py-3" : "gap-2.5 py-2", perdio && "opacity-55")}>
        <span className={clsx("flex shrink-0 items-center justify-center", tv ? "w-10" : "w-5")}>
          <AnimatePresence>{saca && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><PelotaTenis className={tv ? "size-8" : "size-4"} /></motion.span>}</AnimatePresence>
        </span>
        <span className={clsx("min-w-0 flex-1 font-display font-semibold", tv ? "break-words text-5xl leading-tight" : "truncate text-base")}>
          {compacto ? nombreCompacto(t, iid) : nombreInscrito(t, iid, !tv && t.modalidad === "DOBLES")}
          {ins?.siembra ? <span className={clsx("ml-2 font-sans font-medium text-white/40", tv ? "text-3xl" : "text-xs")}>[{ins.siembra}]</span> : null}
          {ganador === lado && <span className={clsx("ml-2", tv ? "text-4xl" : "text-sm")}>🏆</span>}
        </span>
        <span className="flex items-center">
          {v.sets.map((s, i) => {
            const mio = lado === 0 ? s.a : s.b;
            const suyo = lado === 0 ? s.b : s.a;
            const gano = !s.enCurso && mio > suyo;
            const tbMio = s.tb ? (lado === 0 ? s.tb[0] : s.tb[1]) : null;
            return (
              <span
                key={i}
                className={clsx(
                  "relative text-center font-display tabular",
                  tv ? "w-20 text-6xl" : compacto ? "w-6 text-base" : "w-8 text-xl",
                  s.enCurso ? "font-bold text-white" : gano ? "font-bold text-white" : "text-white/45",
                )}
              >
                {s.superTb ? tbMio ?? mio : mio}
                {!s.superTb && s.tb && !s.enCurso && tbMio !== null && tbMio < (lado === 0 ? s.tb[1] : s.tb[0]) && (
                  <sup className={clsx("absolute font-sans font-medium text-white/50", tv ? "-right-0 top-0 text-2xl" : "-right-0.5 top-0 text-[10px]")}>{tbMio}</sup>
                )}
              </span>
            );
          })}
        </span>
        {v.e && !p.resultado && (
          <motion.span
            key={v.puntos[lado] + v.e.juegosJugados}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={clsx(
              "flex items-center justify-center rounded-xl font-display font-bold tabular",
              tv ? "ml-4 h-20 w-28 text-6xl" : compacto ? "ml-1.5 h-7 w-9 text-sm" : "ml-2 h-9 w-12 text-lg",
              v.puntos[lado] === "AD" ? "bg-[var(--sup,#d2ff00)] text-blanco" : "bg-blanco text-noche",
            )}
            style={v.puntos[lado] === "AD" ? undefined : { color: "#0f1a2e" }}
          >
            {v.puntos[lado]}
          </motion.span>
        )}
      </div>
    );
  };
  return (
    <div className={className}>
      {fila(0)}
      <div className="h-px bg-white/10" />
      {fila(1)}
      <AnimatePresence>
        {v.aviso && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={clsx("mt-2 inline-flex items-center gap-2 rounded-full bg-[#dcf03c] font-bold uppercase tracking-wider text-noche", tv ? "px-6 py-2 text-2xl" : "px-3 py-1 text-[11px]")}
            style={{ color: "#0f1a2e" }}
          >
            {TEXTO_AVISO[v.aviso.tipo]}
            {v.aviso.para !== null && <span className="opacity-60">· {nombreInscrito(t, v.aviso.para === 0 ? p.a : p.b, !tv)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "D. Rivas" (o "Rivas / Báez" en dobles) para el cuadro. */
export function nombreCompacto(t: TorneoTenis, iid: string | null) {
  const i = inscrito(t, iid);
  if (!i) return "Por definir";
  if (i.jugadores.length > 1) return nombreInscrito(t, iid, true);
  const partes = i.jugadores[0].nombre.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0][0]}. ${partes.slice(1).join(" ")}` : partes[0];
}

/** Resultado en una línea: "6-4 3-6 [10-7]". */
export function textoResultado(t: TorneoTenis, p: PartidoTenis): string {
  if (!p.resultado) return "";
  if (p.resultado.tipo === "BYE") return "Pasa directo";
  // Desde el lado del ganador, como se dice: "6-4 3-6 [10-7]".
  const b = p.resultado.ganador === 1;
  const sets = p.resultado.sets
    .map((s, i) => {
      const [x, y] = b ? [s.b, s.a] : [s.a, s.b];
      const tb = s.tb ? (b ? [s.tb[1], s.tb[0]] : s.tb) : null;
      if (esSuperTieBreak(t.reglas, i) && tb) return `[${tb[0]}-${tb[1]}]`;
      return tb ? `${x}-${y}(${Math.min(...tb)})` : `${x}-${y}`;
    })
    .join(" ");
  if (p.resultado.tipo === "WO") return sets ? `${sets} W.O.` : "W.O.";
  if (p.resultado.tipo === "RETIRO") return `${sets} ret.`;
  return sets;
}
