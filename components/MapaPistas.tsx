"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Sun, Warehouse } from "lucide-react";
import { vibrar } from "@/lib/feedback";
import type { PistaClub } from "@/types/americano";

/**
 * Mapa del club en perspectiva (como en el sistema de reservas): las techadas
 * bajo la estructura y las de aire libre al lado. Tocar una pista en el mapa o
 * en su tarjeta la suma o la quita del evento.
 */
export function MapaPistas({ pistas, seleccion, onToggle }: { pistas: PistaClub[]; seleccion: number[]; onToggle: (numero: number) => void }) {
  const tocar = (n: number) => {
    vibrar(10);
    onToggle(n);
  };
  return (
    <div>
      <Isometrico pistas={pistas} seleccion={seleccion} onToggle={tocar} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-pista" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-pista-sel ring-2 ring-lima" /> En el evento
        </span>
        <span className="flex items-center gap-1.5">
          <Warehouse className="size-3 text-cielo" /> Techada
        </span>
        <span className="flex items-center gap-1.5">
          <Sun className="size-3 text-amber-300" /> Al aire libre
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {pistas.map((c) => {
          const on = seleccion.includes(c.numero);
          return (
            <motion.button
              key={c.numero}
              type="button"
              layout
              whileTap={{ scale: 0.96 }}
              onClick={() => tocar(c.numero)}
              aria-pressed={on}
              aria-label={`${c.nombre} ${c.techada ? "techada" : "al aire libre"}`}
              className={clsx("flex items-center gap-3 rounded-2xl border p-3 text-left transition", on ? "seleccion sobre-marca" : "glass hover:border-white/20")}
            >
              <span
                className={clsx(
                  "flex size-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold transition",
                  on ? "bg-lima text-noche shadow-[0_0_0_4px_rgba(207,243,91,0.25)]" : "bg-pista text-blanco",
                )}
              >
                {on ? <Check className="size-5" strokeWidth={3} /> : c.numero}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{c.nombre}</span>
                <span className={clsx("flex items-center gap-1 text-xs", on ? "font-semibold text-lima" : "text-white/50")}>
                  {c.techada ? <Warehouse className="size-3" /> : <Sun className="size-3" />}
                  {on ? "En el evento" : c.techada ? "Techada" : "Aire libre"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- dibujo isométrico ---------- */

// Medidas en metros: una pista de pádel mide 20 × 10. Cada pista ocupa ANCHO en x y LARGO en y.
const LARGO = 20;
const ANCHO = 10;
const GAP = 3;
const GROSOR = 1.1;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

type P = [number, number];
const iso = (x: number, y: number, z = 0): P => [(x - y) * COS, (x + y) * SIN - z];
const pts = (...ps: P[]) => ps.map((p) => p.map((n) => n.toFixed(2)).join(",")).join(" ");
const rect = (x: number, y: number, w: number, h: number, z = 0) => pts(iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z));

/** Dónde va cada pista. La Marina tiene su distribución real; otros clubes, en cuadrícula. */
function distribucion(pistas: PistaClub[]) {
  const techadas = pistas.filter((p) => p.techada);
  const libres = pistas.filter((p) => !p.techada);
  const PASO_X = ANCHO + 8;
  const PASO_Y = LARGO + GAP;
  const pos = new Map<number, { x: number; y: number }>();
  const laMarina = techadas.length === 4 && [1, 2, 3, 4].every((n) => techadas.some((p) => p.numero === n));
  // Bajo techo: 1 al fondo, 3 a la izquierda, 2 a la derecha y 4 adelante.
  const LA_MARINA: Record<number, [number, number]> = { 1: [0, 0], 2: [1, 0], 3: [0, 1], 4: [1, 1] };
  techadas.forEach((p, i) => {
    const [c, f] = laMarina ? LA_MARINA[p.numero] : [i % 2, Math.floor(i / 2)];
    pos.set(p.numero, { x: c * PASO_X, y: f * PASO_Y });
  });
  const cols = techadas.length > 1 ? 2 : techadas.length;
  // Aire libre: afuera, a la derecha de la nave y un poco hacia el frente (bajo la vela blanca).
  const xLibre = cols ? (cols - 1) * PASO_X + ANCHO + 12 : 0;
  libres.forEach((p, i) => pos.set(p.numero, { x: xLibre, y: (techadas.length ? 6 : 0) + i * PASO_Y }));
  return pos;
}

function Isometrico({ pistas, seleccion, onToggle }: { pistas: PistaClub[]; seleccion: number[]; onToggle: (n: number) => void }) {
  const pos = distribucion(pistas);
  const esquinas = [...pos.values()].flatMap(({ x, y }) => [iso(x - 3, y - 3, 12), iso(x + ANCHO + 8, y - 3, 12), iso(x - 3, y + LARGO + 3, -4), iso(x + ANCHO + 6, y + LARGO + 3, -4)]);
  const minX = Math.min(...esquinas.map((p) => p[0]));
  const maxX = Math.max(...esquinas.map((p) => p[0]));
  const minY = Math.min(...esquinas.map((p) => p[1]));
  const maxY = Math.max(...esquinas.map((p) => p[1]));
  // De atrás hacia adelante para que se tapen bien.
  const orden = [...pistas].sort((a, b) => {
    const pa = pos.get(a.numero)!;
    const pb = pos.get(b.numero)!;
    return pa.x + pa.y - (pb.x + pb.y);
  });

  return (
    <div className="relative">
      {/* luz ambiente detrás de las pistas */}
      <div className="pointer-events-none absolute inset-x-8 top-1/4 h-1/2 rounded-full bg-marca-2/25 blur-3xl" />
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="relative mx-auto block h-auto max-h-[min(62svh,560px)] w-full overflow-visible" role="img" aria-label="Mapa de las pistas del club">
        <defs>
          <linearGradient id="mp-alfombra" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f86e0" />
            <stop offset="1" stopColor="#1a5ab3" />
          </linearGradient>
          <linearGradient id="mp-sel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6cc6ff" />
            <stop offset="1" stopColor="#2a8cf2" />
          </linearGradient>
          <linearGradient id="mp-vidrio" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.04" />
          </linearGradient>
          {/* reflejo que recorre la pista elegida */}
          <linearGradient id="mp-brillo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
            <animate attributeName="x1" values="-1;1" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0;2" dur="3.2s" repeatCount="indefinite" />
          </linearGradient>
          <filter id="mp-sombra" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id="mp-halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>

        {orden.map((c, i) => {
          const { x, y } = pos.get(c.numero)!;
          return <Pista key={c.numero} c={c} x={x} y={y} on={seleccion.includes(c.numero)} indice={i} onToggle={onToggle} />;
        })}
      </svg>
    </div>
  );
}

function Pista({ c, x, y, on, indice, onToggle }: { c: PistaClub; x: number; y: number; on: boolean; indice: number; onToggle: (n: number) => void }) {
  const W = ANCHO;
  const L = LARGO;
  const pin = iso(x + W / 2, y + L / 2, GROSOR);
  const linea = { stroke: "#fff", strokeOpacity: 0.85, strokeWidth: 0.2, fill: "none" } as const;
  const T = GROSOR;
  return (
    <motion.g
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * indice, type: "spring", stiffness: 140, damping: 16 }}
      className="mp-pista cursor-pointer"
      onClick={() => onToggle(c.numero)}
    >
      {/* sombra en el "piso" invisible y luz lima debajo de la elegida */}
      <motion.polygon points={rect(x, y, W, L, -4)} fill="#02041a" filter="url(#mp-sombra)" animate={{ opacity: on ? 0.32 : 0.5 }} transition={{ duration: 0.4 }} />
      <motion.polygon points={rect(x - 1, y - 1, W + 2, L + 2, -4)} fill="#cff35b" filter="url(#mp-halo)" initial={false} animate={{ opacity: on ? 0.22 : 0 }} transition={{ duration: 0.5 }} />

      <motion.g
        animate={on ? { y: [-2.4, -3.4, -2.4] } : { y: 0 }}
        transition={on ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 260, damping: 18 }}
      >
        <g className="mp-tapa">
          {/* canto de la losa */}
          <polygon points={pts(iso(x, y + L, T), iso(x + W, y + L, T), iso(x + W, y + L, 0), iso(x, y + L, 0))} fill={on ? "#1d6fd0" : "#123f84"} />
          <polygon points={pts(iso(x + W, y, T), iso(x + W, y + L, T), iso(x + W, y + L, 0), iso(x + W, y, 0))} fill={on ? "#2a83e6" : "#185399"} />
          {/* alfombra */}
          <polygon
            points={rect(x, y, W, L, T)}
            fill={on ? "url(#mp-sel)" : "url(#mp-alfombra)"}
            stroke={on ? "#cff35b" : "#0f3a78"}
            strokeWidth={on ? 0.55 : 0.25}
            style={on ? { filter: "drop-shadow(0 0 1.4px #cff35b)" } : undefined}
          />
          {on && <polygon points={rect(x, y, W, L, T)} fill="url(#mp-brillo)" pointerEvents="none" />}
          {/* líneas */}
          <polyline points={pts(iso(x, y + 3, T), iso(x + W, y + 3, T))} {...linea} />
          <polyline points={pts(iso(x, y + L - 3, T), iso(x + W, y + L - 3, T))} {...linea} />
          <polyline points={pts(iso(x + W / 2, y + 3, T), iso(x + W / 2, y + L - 3, T))} {...linea} />
          {/* vidrio del fondo */}
          <polygon points={pts(iso(x, y, T), iso(x + W, y, T), iso(x + W, y, T + 2.6), iso(x, y, T + 2.6))} fill="url(#mp-vidrio)" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.12" />
          {/* red */}
          <polygon points={pts(iso(x, y + L / 2, T), iso(x + W, y + L / 2, T), iso(x + W, y + L / 2, T + 0.9), iso(x, y + L / 2, T + 0.9))} fill="#071033" opacity="0.8" />
          <polyline points={pts(iso(x, y + L / 2, T + 0.9), iso(x + W, y + L / 2, T + 0.9))} stroke="#fff" strokeWidth="0.15" />
          {/* vidrio de adelante, más transparente para ver la pista */}
          <polygon points={pts(iso(x, y + L, T), iso(x + W, y + L, T), iso(x + W, y + L, T + 2.6), iso(x, y + L, T + 2.6))} fill="url(#mp-vidrio)" fillOpacity="0.6" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.12" />
          {!c.techada && <Vela x={x} y={y} />}
          {/* número flotante */}
          <line x1={pin[0]} y1={pin[1]} x2={pin[0]} y2={pin[1] - 5.2} stroke={on ? "#cff35b" : "#fff"} strokeOpacity="0.7" strokeWidth="0.18" />
          <circle cx={pin[0]} cy={pin[1] - 7.2} r="2.1" fill={on ? "#cff35b" : "#0c113d"} stroke={on ? "#0c113d" : "#fff"} strokeWidth="0.35" style={on ? { filter: "drop-shadow(0 0 1.5px #cff35b)" } : undefined} />
          <text x={pin[0]} y={pin[1] - 6.35} textAnchor="middle" fontSize="2.4" fontWeight="800" fill={on ? "#0c113d" : "#fff"} style={{ fontFamily: "var(--font-display)" }}>
            {c.numero}
          </text>
        </g>
      </motion.g>
    </motion.g>
  );
}

/** Vela blanca (carpa) sobre la pista de aire libre, con palmeras alrededor. */
function Vela({ x, y }: { x: number; y: number }) {
  const W = ANCHO;
  // Vela tensada sobre el fondo de la pista: dos puntas altas y dos bajas.
  const alturas = [3.6, 6.8, 3.4, 5.6];
  const a = iso(x - 0.8, y + 0.5, alturas[0]);
  const b = iso(x + W + 0.8, y - 0.8, alturas[1]);
  const c = iso(x + W + 0.8, y + 6.5, alturas[2]);
  const d = iso(x - 0.8, y + 7.5, alturas[3]);
  const palmas: P[] = [iso(x + W + 2.2, y - 1.5, 0), iso(x + W + 4.5, y + 3, 0), iso(x + W + 3, y + LARGO + 0.5, 0)];
  return (
    <g pointerEvents="none">
      {[a, b, c, d].map((p, i) => (
        <line key={i} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] + alturas[i] - GROSOR} stroke="#dfe5f2" strokeWidth="0.2" />
      ))}
      <polygon points={pts(a, b, d)} fill="#f4f6fb" />
      <polygon points={pts(b, c, d)} fill="#c9d1e3" />
      <polyline points={pts(b, d)} stroke="#fff" strokeWidth="0.15" />
      {palmas.map((p, i) => (
        <Palmera key={i} x={p[0]} y={p[1] - GROSOR} />
      ))}
    </g>
  );
}

function Palmera({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none" stroke="#45b062" strokeWidth="0.45" strokeLinecap="round" fill="none">
      <path d={`M${x} ${y} q0.4 -2.5 0 -5`} stroke="#9a7444" strokeWidth="0.35" />
      <path d={`M${x} ${y - 5} q2 -0.8 3 0.6`} />
      <path d={`M${x} ${y - 5} q-2 -0.8 -3 0.6`} />
      <path d={`M${x} ${y - 5} q1.2 -1.6 2.6 -1.4`} />
      <path d={`M${x} ${y - 5} q-1.2 -1.6 -2.6 -1.4`} />
    </g>
  );
}
