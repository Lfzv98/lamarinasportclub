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

// Medidas en metros: una pista de pádel mide 20 × 10.
const LARGO = 20;
const ANCHO = 10;
const GAP = 3;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

type P = [number, number];
const iso = (x: number, y: number, z = 0): P => [(x - y) * COS, (x + y) * SIN - z];
const pts = (...ps: P[]) => ps.map((p) => p.map((n) => n.toFixed(2)).join(",")).join(" ");
const rect = (x: number, y: number, w: number, h: number, z = 0) => pts(iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z));

function Isometrico({ pistas, seleccion, onToggle }: { pistas: PistaClub[]; seleccion: number[]; onToggle: (n: number) => void }) {
  const techadas = pistas.filter((p) => p.techada);
  const libres = pistas.filter((p) => !p.techada);
  // Cada pista ocupa ANCHO en x y LARGO en y. Bajo techo van en 2 columnas.
  const PASO_X = ANCHO + 8;
  const PASO_Y = LARGO + GAP;
  const celdas = new Map<number, [number, number]>();
  // Distribución real de La Marina: 1 al fondo, 3 a la izquierda, 2 a la derecha y 4 adelante.
  const laMarina = techadas.length === 4 && [1, 2, 3, 4].every((n) => techadas.some((p) => p.numero === n));
  const LA_MARINA: Record<number, [number, number]> = { 1: [0, 0], 2: [1, 0], 3: [0, 1], 4: [1, 1] };
  techadas.forEach((p, i) => celdas.set(p.numero, laMarina ? LA_MARINA[p.numero] : [i % 2, Math.floor(i / 2)]));
  const filas = Math.max(1, Math.ceil(techadas.length / 2));
  const cols = techadas.length > 1 ? 2 : 1;
  const nave = { x: 0, y: 0, w: (cols - 1) * PASO_X + ANCHO + 6, h: (filas - 1) * PASO_Y + LARGO + 4 };
  const pos = new Map<number, { x: number; y: number }>();
  celdas.forEach(([c, f], n) => pos.set(n, { x: 3 + c * PASO_X, y: 2 + f * PASO_Y }));
  // Las de aire libre, afuera junto a la nave, a la altura de la fila de adelante.
  const xLibre = techadas.length ? nave.w + 6 : 0;
  const filaLibre = Math.min(filas - 1, 1);
  libres.forEach((p, i) => pos.set(p.numero, { x: xLibre, y: 2 + (filaLibre + i) * PASO_Y }));
  const ancho = Math.max(techadas.length ? nave.w : 0, libres.length ? xLibre + ANCHO + 6 : 0);
  const alto = Math.max(techadas.length ? nave.h : 0, libres.length ? 2 + (filaLibre + libres.length) * PASO_Y : 0);
  const terreno = { x: -7, y: -5, w: ancho + 12, h: alto + 12 };
  const patio = libres.length ? { x: xLibre - 3, y: 0, w: ANCHO + 6, h: alto + 1 } : null;
  const primeraLibre = libres.length ? pos.get(libres[0].numero)! : null;

  // Caja de la vista a partir de las esquinas del terreno (con la altura del techo).
  const esquinas = [iso(terreno.x, terreno.y, 9), iso(terreno.x + terreno.w, terreno.y, 9), iso(terreno.x, terreno.y + terreno.h), iso(terreno.x + terreno.w, terreno.y + terreno.h)];
  const minX = Math.min(...esquinas.map((p) => p[0])) - 2;
  const maxX = Math.max(...esquinas.map((p) => p[0])) + 2;
  const minY = Math.min(...esquinas.map((p) => p[1])) - 2;
  const maxY = Math.max(...esquinas.map((p) => p[1])) + 2;

  const H = 7; // altura del techo
  const arboles: P[] = [
    [terreno.x + 2.5, terreno.y + terreno.h * 0.55],
    [terreno.x + terreno.w * 0.45, terreno.y + 1.5],
    [terreno.x + terreno.w - 2, terreno.y + 2],
    [terreno.x + terreno.w - 2, terreno.y + 9],
    [terreno.x + terreno.w * 0.3, terreno.y + terreno.h - 6.5],
    [terreno.x + terreno.w * 0.7, terreno.y + terreno.h - 6.5],
  ];

  return (
    <div className="sobre-marca overflow-hidden rounded-3xl bg-gradient-to-br from-[#1b2a7a] via-marino to-marino-2 shadow-[0_18px_40px_-18px_rgba(12,17,61,0.7)]">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="block h-auto w-full" role="img" aria-label="Mapa de las pistas del club">
        <defs>
          <linearGradient id="mp-alfombra" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f86e0" />
            <stop offset="1" stopColor="#1c5fb8" />
          </linearGradient>
          <linearGradient id="mp-sel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5cbcff" />
            <stop offset="1" stopColor="#2a8cf2" />
          </linearGradient>
        </defs>

        {/* terreno y estacionamiento */}
        <polygon points={rect(terreno.x, terreno.y, terreno.w, terreno.h)} fill="#1a2560" />
        <polygon points={rect(terreno.x + 1, terreno.y + terreno.h - 4.5, terreno.w - 2, 3)} fill="#141d4d" />
        {Array.from({ length: Math.floor((terreno.w - 4) / 4) }, (_, i) => (
          <polygon key={i} points={rect(terreno.x + 2 + i * 4, terreno.y + terreno.h - 4, 2.4, 1.6, 0.6)} fill={i % 3 === 1 ? "#a33b3b" : "#dfe3ee"} opacity="0.85" />
        ))}

        {/* piso de la nave techada */}
        {techadas.length > 0 && <polygon points={rect(nave.x, nave.y, nave.w, nave.h)} fill="#7a3d2f" stroke="#8f4b3a" strokeWidth="0.3" />}
        {/* piso del área exterior */}
        {patio && <polygon points={rect(patio.x, patio.y, patio.w, patio.h)} fill="#3a4370" />}
        {patio &&
          Array.from({ length: Math.floor(patio.h / 3) }, (_, i) => (
            <polyline key={i} points={pts(iso(patio.x, patio.y + i * 3), iso(patio.x + patio.w, patio.y + i * 3))} stroke="#fff" strokeOpacity="0.06" strokeWidth="0.15" />
          ))}

        {/* pistas: de atrás hacia adelante para que se tapen bien */}
        {[...pistas]
          .sort((a, b) => {
            const pa = pos.get(a.numero)!;
            const pb = pos.get(b.numero)!;
            return pa.x + pa.y - (pb.x + pb.y);
          })
          .map((c) => {
            const { x, y } = pos.get(c.numero)!;
            const on = seleccion.includes(c.numero);
            const centro = iso(x + ANCHO / 2, y + 4, 3.2);
            return (
              <g key={c.numero} className="cursor-pointer" onClick={() => onToggle(c.numero)}>
                <polygon points={rect(x + 0.6, y + 0.8, ANCHO, LARGO)} fill="#000" opacity={on ? 0.35 : 0.18} />
                <motion.g animate={{ y: on ? -1.2 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                  <polygon points={rect(x, y, ANCHO, LARGO)} fill={on ? "url(#mp-sel)" : "url(#mp-alfombra)"} stroke={on ? "#cff35b" : "#154a91"} strokeWidth={on ? 0.6 : 0.3} style={on ? { filter: "drop-shadow(0 0 1.2px #cff35b)" } : undefined} />
                  {/* líneas de la pista */}
                  <polyline points={pts(iso(x, y + 3), iso(x + ANCHO, y + 3))} stroke="#fff" strokeOpacity="0.85" strokeWidth="0.2" fill="none" />
                  <polyline points={pts(iso(x, y + LARGO - 3), iso(x + ANCHO, y + LARGO - 3))} stroke="#fff" strokeOpacity="0.85" strokeWidth="0.2" fill="none" />
                  <polyline points={pts(iso(x + ANCHO / 2, y + 3), iso(x + ANCHO / 2, y + LARGO - 3))} stroke="#fff" strokeOpacity="0.85" strokeWidth="0.2" fill="none" />
                  {/* red */}
                  <polygon points={pts(iso(x, y + LARGO / 2), iso(x + ANCHO, y + LARGO / 2), iso(x + ANCHO, y + LARGO / 2, 0.9), iso(x, y + LARGO / 2, 0.9))} fill="#0b1030" opacity="0.85" />
                  {/* vidrios del fondo */}
                  <polygon points={pts(iso(x, y), iso(x + ANCHO, y), iso(x + ANCHO, y, 2.2), iso(x, y, 2.2))} fill="#fff" fillOpacity="0.08" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.15" />
                  <polygon points={pts(iso(x, y + LARGO), iso(x + ANCHO, y + LARGO), iso(x + ANCHO, y + LARGO, 2.2), iso(x, y + LARGO, 2.2))} fill="#fff" fillOpacity="0.08" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.15" />
                  {/* número */}
                  <circle cx={centro[0]} cy={centro[1]} r="1.9" fill={on ? "#cff35b" : "#0c113d"} stroke={on ? "#0c113d" : "#fff"} strokeWidth="0.35" />
                  <text x={centro[0]} y={centro[1] + 0.75} textAnchor="middle" fontSize="2.2" fontWeight="800" fill={on ? "#0c113d" : "#fff"} style={{ fontFamily: "var(--font-display)" }}>
                    {c.numero}
                  </text>
                </motion.g>
              </g>
            );
          })}

        {/* estructura del techo (alambre) */}
        {techadas.length > 0 && (
          <g stroke="#fff" strokeOpacity="0.45" strokeWidth="0.18" fill="none" pointerEvents="none">
            <polygon points={rect(nave.x, nave.y, nave.w, nave.h, H)} />
            {Array.from({ length: Math.round(nave.w / 6) + 1 }, (_, i) => {
              const x = nave.x + (i * nave.w) / Math.round(nave.w / 6);
              return (
                <g key={i}>
                  <polyline points={pts(iso(x, nave.y), iso(x, nave.y, H))} />
                  <polyline points={pts(iso(x, nave.y, H), iso(x, nave.y + nave.h, H))} strokeOpacity="0.18" />
                </g>
              );
            })}
            {Array.from({ length: Math.round(nave.h / 6) + 1 }, (_, i) => {
              const y = nave.y + (i * nave.h) / Math.round(nave.h / 6);
              return <polyline key={i} points={pts(iso(nave.x, y), iso(nave.x, y, H))} />;
            })}
            <polyline points={pts(iso(nave.x + nave.w, nave.y), iso(nave.x + nave.w, nave.y, H))} />
            <polyline points={pts(iso(nave.x + nave.w, nave.y + nave.h), iso(nave.x + nave.w, nave.y + nave.h, H))} />
            <polyline points={pts(iso(nave.x, nave.y + nave.h), iso(nave.x, nave.y + nave.h, H))} />
          </g>
        )}

        {/* carpa y palmeras junto a las de aire libre */}
        {primeraLibre && (
          <g pointerEvents="none">
            <polygon points={pts(iso(primeraLibre.x - 2, primeraLibre.y - 1.5, 3.2), iso(primeraLibre.x + ANCHO * 0.55, primeraLibre.y - 4.5, 4.6), iso(primeraLibre.x + ANCHO * 0.35, primeraLibre.y + 1, 2.6))} fill="#e8ecf5" opacity="0.92" />
            <polygon points={pts(iso(primeraLibre.x + ANCHO * 0.55, primeraLibre.y - 4.5, 4.6), iso(primeraLibre.x + ANCHO + 1, primeraLibre.y - 1, 3), iso(primeraLibre.x + ANCHO * 0.35, primeraLibre.y + 1, 2.6))} fill="#c3cad9" opacity="0.92" />
          </g>
        )}
        {libres.flatMap((p) => {
          const q = pos.get(p.numero)!;
          return [
            [q.x + ANCHO + 2.5, q.y + 3],
            [q.x + ANCHO + 2.5, q.y + LARGO - 4],
            [q.x + ANCHO * 0.8, q.y + LARGO + 2.2],
          ].map(([x, y], i) => {
            const b = iso(x, y);
            return <Palmera key={`${p.numero}-${i}`} x={b[0]} y={b[1]} />;
          });
        })}
        {arboles.map(([x, y], i) => {
          const b = iso(x, y);
          return <Arbol key={i} x={b[0]} y={b[1]} />;
        })}
      </svg>
    </div>
  );
}

function Arbol({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x - 0.25} y={y - 2} width="0.5" height="2" fill="#5b3a29" />
      <polygon points={`${x},${y - 5} ${x + 1.7},${y - 3.6} ${x + 1.4},${y - 1.8} ${x},${y - 1.2} ${x - 1.4},${y - 1.8} ${x - 1.7},${y - 3.6}`} fill="#1f5a3a" />
      <polygon points={`${x},${y - 5} ${x + 1.7},${y - 3.6} ${x},${y - 3}`} fill="#2d7a4f" />
    </g>
  );
}

function Palmera({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none" stroke="#3f9a52" strokeWidth="0.45" strokeLinecap="round" fill="none">
      <path d={`M${x} ${y} q0.4 -2.5 0 -5`} stroke="#8a6a3a" strokeWidth="0.35" />
      <path d={`M${x} ${y - 5} q2 -0.8 3 0.6`} />
      <path d={`M${x} ${y - 5} q-2 -0.8 -3 0.6`} />
      <path d={`M${x} ${y - 5} q1.2 -1.6 2.6 -1.4`} />
      <path d={`M${x} ${y - 5} q-1.2 -1.6 -2.6 -1.4`} />
    </g>
  );
}
