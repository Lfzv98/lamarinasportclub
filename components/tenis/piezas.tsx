"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { iniciales } from "@/components/Avatar";
import { SUPERFICIES } from "@/lib/tenis/torneo";
import type { Superficie, TorneoTenis } from "@/types/tenis";

/** "dura" / "arcilla" en las rutas. */
export const slugDe = (s: Superficie) => (s === "DURA" ? "dura" : "arcilla");
export const superficieDe = (slug: string): Superficie | null => (slug === "dura" ? "DURA" : slug === "arcilla" ? "ARCILLA" : null);

/** Variables de color de la superficie: --sup, --sup-claro y --sup-oscuro. */
export function temaSuperficie(s: Superficie): React.CSSProperties {
  const d = SUPERFICIES[s];
  return { ["--sup" as string]: d.color, ["--sup-claro" as string]: d.claro, ["--sup-oscuro" as string]: d.oscuro };
}

export const fechaTenis = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });

/** Pelota de tenis amarilla con su costura. */
export function PelotaTenis({ className, girando = false }: { className?: string; girando?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={clsx("shrink-0", className)}
      aria-hidden
      animate={girando ? { rotate: 360 } : undefined}
      transition={girando ? { repeat: Infinity, duration: 2.4, ease: "linear" } : undefined}
    >
      <circle cx="12" cy="12" r="11" fill="#dcf03c" stroke="#b5c91f" strokeWidth="0.6" />
      <path d="M3.2 6.2c3.4 1.7 4.8 4 4.8 5.8s-1.4 4.1-4.8 5.8M20.8 6.2c-3.4 1.7-4.8 4-4.8 5.8s1.4 4.1 4.8 5.8" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </motion.svg>
  );
}

export function ChipSuperficie({ superficie, className }: { superficie: Superficie; className?: string }) {
  const d = SUPERFICIES[superficie];
  return (
    <span className={clsx("chip !border-transparent font-semibold !text-blanco", className)} style={{ background: `linear-gradient(135deg, ${d.color}, ${d.oscuro})` }}>
      <span className="size-2 rounded-full" style={{ background: d.claro }} />
      {d.nombre}
    </span>
  );
}

export function EstadoTenisBadge({ estado }: { estado: TorneoTenis["estado"] }) {
  if (estado === "EN_JUEGO")
    return (
      <span className="chip border-neon/30 bg-neon/10 text-neon">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-neon" />
        </span>
        En juego
      </span>
    );
  if (estado === "FINALIZADO") return <span className="chip">Finalizado</span>;
  return <span className="chip text-amber-200">Por empezar</span>;
}

/* ---------- La cancha vista desde arriba ---------- */

const L = 2377; // largo (cm)
const W = 1097; // ancho de dobles
const S = 137; // pasillo de dobles
const SL = 640; // línea de saque desde la red
const RED = L / 2;
const MEDIO = W / 2;

export interface JugadorEnCancha {
  nombre: string;
  /** Equipo (0 = A, 1 = B) para el color. */
  equipo: 0 | 1;
}

/**
 * Cancha reglamentaria (23,77 × 10,97 m) con los colores de su superficie. Opcional: los jugadores
 * en cada lado, quién saca, desde qué lado y a qué cuadro debe ir el saque.
 */
export function Cancha({
  superficie,
  izquierda = [],
  derecha = [],
  saque,
  className,
  animar = true,
}: {
  superficie: Superficie;
  izquierda?: JugadorEnCancha[];
  derecha?: JugadorEnCancha[];
  saque?: { lado: "IZQ" | "DER"; desde: "DERECHA" | "IZQUIERDA"; jugador?: number } | null;
  className?: string;
  animar?: boolean;
}) {
  const arcilla = superficie === "ARCILLA";
  const interior = arcilla ? "#cf5f35" : "#2f6fd6";
  const exterior = arcilla ? "#b9532d" : "#2e7a4f";
  const linea = "#fbfbf7";
  const M = 260;
  // Cuadro de saque al que debe ir la pelota (en diagonal).
  let cuadro: { x: number; y: number } | null = null;
  let sacador: { x: number; y: number } | null = null;
  if (saque) {
    const abajo = (saque.lado === "IZQ") === (saque.desde === "DERECHA");
    sacador = { x: saque.lado === "IZQ" ? -70 : L + 70, y: abajo ? MEDIO + 260 : MEDIO - 260 };
    cuadro = { x: saque.lado === "IZQ" ? RED : RED - SL, y: abajo ? S : MEDIO };
  }
  const posiciones = (lista: JugadorEnCancha[], lado: "IZQ" | "DER") =>
    lista.map((j, i) => {
      const esSacador = saque?.lado === lado && (saque.jugador ?? 0) === i;
      if (esSacador && sacador) return { j, ...sacador, saca: true };
      const x = lado === "IZQ" ? (lista.length > 1 && i === 1 ? RED - 380 : 120) : lista.length > 1 && i === 1 ? RED + 380 : L - 120;
      const y = lista.length === 1 ? MEDIO : i === 0 ? MEDIO + (lado === "IZQ" ? 270 : -270) : MEDIO - (lado === "IZQ" ? 270 : -270);
      // El que resta se para en diagonal al sacador.
      if (saque && saque.lado !== lado && i === 0 && sacador) return { j, x: lado === "IZQ" ? 60 : L - 60, y: W - sacador.y, saca: false };
      return { j, x, y, saca: false };
    });
  const jugadores = [...posiciones(izquierda, "IZQ"), ...posiciones(derecha, "DER")];
  return (
    <svg viewBox={`${-M} ${-M} ${L + 2 * M} ${W + 2 * M}`} className={clsx("block w-full", className)} role="img" aria-label="Cancha de tenis">
      <defs>
        <pattern id={`grano-${superficie}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="transparent" />
          {arcilla ? <circle cx="8" cy="12" r="2.2" fill="#000" opacity="0.06" /> : <circle cx="20" cy="20" r="1.5" fill="#fff" opacity="0.05" />}
          {arcilla && <circle cx="28" cy="30" r="1.6" fill="#fff" opacity="0.07" />}
        </pattern>
      </defs>
      <rect x={-M} y={-M} width={L + 2 * M} height={W + 2 * M} rx="60" fill={exterior} />
      <rect x={-M} y={-M} width={L + 2 * M} height={W + 2 * M} rx="60" fill={`url(#grano-${superficie})`} />
      <rect x={0} y={0} width={L} height={W} fill={interior} />
      {arcilla && (
        // Marcas de la rastra en la arcilla.
        <g opacity="0.08" stroke="#3b1406" strokeWidth="6">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M ${-M + 40} ${-M + 60 + i * 120} q ${L / 2} 40 ${L + 2 * M - 80} 0`} fill="none" />
          ))}
        </g>
      )}
      {cuadro && (
        <motion.rect
          x={cuadro.x}
          y={cuadro.y}
          width={SL}
          height={MEDIO - S}
          fill="#dcf03c"
          initial={animar ? { opacity: 0 } : false}
          animate={{ opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        />
      )}
      <g stroke={linea} strokeWidth="9" fill="none">
        <rect x={0} y={0} width={L} height={W} />
        <line x1={0} y1={S} x2={L} y2={S} />
        <line x1={0} y1={W - S} x2={L} y2={W - S} />
        <line x1={RED - SL} y1={S} x2={RED - SL} y2={W - S} />
        <line x1={RED + SL} y1={S} x2={RED + SL} y2={W - S} />
        <line x1={RED - SL} y1={MEDIO} x2={RED + SL} y2={MEDIO} />
        <line x1={0} y1={MEDIO} x2={18} y2={MEDIO} />
        <line x1={L - 18} y1={MEDIO} x2={L} y2={MEDIO} />
      </g>
      {/* Red */}
      <line x1={RED} y1={-91} x2={RED} y2={W + 91} stroke="#0b0f19" strokeWidth="16" opacity="0.55" />
      <line x1={RED} y1={-91} x2={RED} y2={W + 91} stroke="#fff" strokeWidth="5" strokeDasharray="10 10" />
      <circle cx={RED} cy={-91} r="14" fill="#e5e7eb" />
      <circle cx={RED} cy={W + 91} r="14" fill="#e5e7eb" />
      {jugadores.map(({ j, x, y, saca }, i) => (
        <motion.g key={`${j.nombre}-${i}`} initial={false} animate={{ x, y }} transition={{ type: "spring", stiffness: 140, damping: 20 }}>
          <circle r="92" fill={j.equipo === 0 ? "#0f1a2e" : "#ffffff"} stroke={j.equipo === 0 ? "#dcf03c" : "#0f1a2e"} strokeWidth="14" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="78" fontWeight="700" fill={j.equipo === 0 ? "#ffffff" : "#0f1a2e"} fontFamily="var(--font-display)">
            {iniciales(j.nombre) || "?"}
          </text>
          {saca && (
            <g transform="translate(78 -78)">
              <circle r="42" fill="#dcf03c" stroke="#fff" strokeWidth="8" />
            </g>
          )}
        </motion.g>
      ))}
    </svg>
  );
}

/** Fondo de pantalla con el color de la superficie (encabezados y TV). */
export function FondoSuperficie({ superficie, className, children }: { superficie: Superficie; className?: string; children?: React.ReactNode }) {
  const d = SUPERFICIES[superficie];
  return (
    <div className={clsx("sobre-marca relative overflow-hidden", className)} style={{ background: `radial-gradient(60rem 30rem at 100% 0%, ${d.claro}55, transparent 60%), linear-gradient(160deg, ${d.color} 0%, ${d.oscuro} 70%, #0b0f19 130%)` }}>
      {superficie === "ARCILLA" ? (
        <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.10]" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M -5 ${i * 9} Q 50 ${i * 9 + 4} 105 ${i * 9}`} stroke="#fff" strokeWidth="0.25" fill="none" />
          ))}
        </svg>
      ) : (
        <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.05]" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
          <rect x="8" y="14" width="84" height="72" stroke="#fff" strokeWidth="0.35" fill="none" />
          <line x1="50" y1="8" x2="50" y2="92" stroke="#fff" strokeWidth="0.35" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="#fff" strokeWidth="0.2" />
        </svg>
      )}
      {children}
    </div>
  );
}
