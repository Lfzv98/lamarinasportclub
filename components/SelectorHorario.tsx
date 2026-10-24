"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flag, Play } from "lucide-react";
import { useState } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { vibrar } from "@/lib/feedback";
import { aHora, aMinutos, DIAS, diaSemana, horarioDelDia, ORDEN_DIAS } from "@/lib/horarios";
import type { ConfigClub } from "@/types/americano";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MINUTOS = [0, 15, 30, 45];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function hoyIso() {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}
function sumarDias(fecha: string, n: number) {
  const [y, m, d] = fecha.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return iso(x.getFullYear(), x.getMonth(), x.getDate());
}

/** "Vie 23 oct" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${DIAS[diaSemana(fecha)].slice(0, 3)} ${d} ${MESES[m - 1].slice(0, 3)}`;
}

type Abierta = null | "fecha" | "inicio" | "fin";

/**
 * Fecha, inicio y fin del evento como tres botones grandes. Cada uno abre una
 * pantallita: calendario para la fecha y reloj de horas y minutos para las horas,
 * siempre dentro del horario del club.
 */
export function SelectorHorario({
  club,
  fecha,
  setFecha,
  horaInicio,
  setHoraInicio,
  horaFin,
  setHoraFin,
}: {
  club: ConfigClub;
  fecha: string;
  setFecha: (f: string) => void;
  horaInicio: string;
  setHoraInicio: (h: string) => void;
  horaFin: string;
  setHoraFin: (h: string) => void;
}) {
  const [abierta, setAbierta] = useState<Abierta>(null);
  const dia = horarioDelDia(club, fecha);
  const duracion = aMinutos(horaFin) - aMinutos(horaInicio);
  const abrir = (a: Abierta) => {
    vibrar(10);
    setAbierta(a);
  };

  // Al elegir otra fecha, las horas se acomodan al horario de ese día.
  function elegirFecha(f: string) {
    setFecha(f);
    const h = horarioDelDia(club, f);
    if (!h.abierto) return;
    const ini = Math.min(Math.max(aMinutos(horaInicio), aMinutos(h.apertura)), aMinutos(h.cierre) - 30);
    const fin = Math.min(Math.max(aMinutos(horaFin), ini + 30), aMinutos(h.cierre));
    if (ini !== aMinutos(horaInicio)) setHoraInicio(aHora(ini));
    if (fin !== aMinutos(horaFin)) setHoraFin(aHora(fin));
  }

  function elegirInicio(h: string) {
    setHoraInicio(h);
    // Conserva la duración elegida si cabe; si no, termina al cierre.
    if (aMinutos(horaFin) <= aMinutos(h) || duracion > 0) {
      const fin = Math.min(aMinutos(h) + (duracion > 0 ? duracion : 120), aMinutos(dia.cierre));
      setHoraFin(aHora(Math.max(fin, aMinutos(h) + 15)));
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Boton icono={<CalendarDays className="size-4" />} etiqueta="Fecha" valor={fechaCorta(fecha)} onClick={() => abrir("fecha")} error={!dia.abierto} />
        <Boton icono={<Play className="size-4" />} etiqueta="Inicio" valor={horaInicio} onClick={() => abrir("inicio")} />
        <Boton icono={<Flag className="size-4" />} etiqueta="Fin" valor={horaFin} onClick={() => abrir("fin")} />
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
        <span className="flex items-center gap-1">
          <Clock className="size-3" /> {DIAS[diaSemana(fecha)]}: {dia.abierto ? `club abierto ${dia.apertura} – ${dia.cierre}` : <span className="text-coral">club cerrado</span>}
        </span>
        {duracion > 0 && <span>· Evento de {duracionTexto(duracion)}</span>}
      </p>

      <Hoja abierta={abierta === "fecha"} onClose={() => setAbierta(null)} titulo="Fecha del evento" sub="Los días que el club está cerrado no se pueden elegir">
        <Calendario
          club={club}
          valor={fecha}
          onChange={(f) => {
            elegirFecha(f);
            setAbierta(null);
          }}
        />
      </Hoja>

      <Hoja
        abierta={abierta === "inicio"}
        onClose={() => setAbierta(null)}
        titulo="Hora de inicio"
        sub={dia.abierto ? `${DIAS[diaSemana(fecha)]}: el club abre ${dia.apertura} – ${dia.cierre}` : "El club está cerrado ese día"}
      >
        <Reloj
          valor={horaInicio}
          desde={aMinutos(dia.apertura)}
          hasta={aMinutos(dia.cierre) - 15}
          onListo={(h) => {
            elegirInicio(h);
            setAbierta(null);
          }}
        />
      </Hoja>

      <Hoja abierta={abierta === "fin"} onClose={() => setAbierta(null)} titulo="Hora de fin" sub={`Empieza a las ${horaInicio} · el club cierra ${dia.cierre}`}>
        <Reloj
          valor={horaFin}
          desde={aMinutos(horaInicio) + 15}
          hasta={aMinutos(dia.cierre)}
          duraciones={{ inicio: aMinutos(horaInicio), opciones: [90, 120, 150, 180] }}
          onListo={(h) => {
            setHoraFin(h);
            setAbierta(null);
          }}
        />
      </Hoja>
    </>
  );
}

/** Color de la hora según el momento del día, como en el sistema de reservas. */
function franja(h: number) {
  if (h < 7) return "franja-amanecer";
  if (h < 10) return "franja-manana";
  if (h < 13) return "franja-dia";
  if (h < 16) return "franja-siesta";
  if (h < 18) return "franja-tarde";
  if (h < 20) return "franja-atardecer";
  if (h < 21) return "franja-noche";
  return "franja-madrugada";
}

function duracionTexto(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

function Boton({ icono, etiqueta, valor, onClick, error }: { icono: React.ReactNode; etiqueta: string; valor: string; onClick: () => void; error?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-label={`${etiqueta}: ${valor}. Cambiar`}
      className={clsx(
        "glass group flex flex-col items-start rounded-2xl px-3.5 py-3 text-left transition hover:border-neon/40",
        error && "border-coral/40",
      )}
    >
      <span className={clsx("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]", error ? "text-coral" : "text-neon")}>
        {icono} {etiqueta}
      </span>
      <span className="mt-1.5 font-display text-lg font-bold capitalize tabular leading-tight sm:text-xl">{valor}</span>
      <span className="mt-0.5 text-[10px] text-white/35 group-hover:text-white/60">Toca para cambiar</span>
    </motion.button>
  );
}

/* ---------- calendario ---------- */

function Calendario({ club, valor, onChange }: { club: ConfigClub; valor: string; onChange: (f: string) => void }) {
  const hoy = hoyIso();
  const [y0, m0] = valor.split("-").map(Number);
  const [mes, setMes] = useState({ y: y0, m: m0 - 1 });
  const primero = new Date(mes.y, mes.m, 1);
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
  // Lunes primero: cuántos huecos antes del día 1.
  const huecos = (primero.getDay() + 6) % 7;
  const celdas: (number | null)[] = [...Array(huecos).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  const mover = (d: number) => {
    vibrar(8);
    setMes(({ y, m }) => {
      const x = new Date(y, m + d, 1);
      return { y: x.getFullYear(), m: x.getMonth() };
    });
  };
  const antesDeHoy = mes.y * 12 + mes.m <= Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7)) - 1;
  const abierto = (f: string) => club.dias[diaSemana(f)]?.abierto !== false;

  // Atajos: hoy, mañana y el próximo sábado (abiertos).
  const proximoSabado = sumarDias(hoy, ((6 - diaSemana(hoy) + 7) % 7) || 7);
  const atajos = [
    { label: "Hoy", f: hoy },
    { label: "Mañana", f: sumarDias(hoy, 1) },
    { label: "Sábado", f: proximoSabado },
  ].filter((a) => abierto(a.f));

  return (
    <div>
      <div className="flex gap-2">
        {atajos.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onChange(a.f)}
            className={clsx("flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition", a.f === valor ? "seleccion sobre-marca text-white" : "bg-white/5 text-white/70 hover:bg-white/10")}
          >
            {a.label}
            <span className={clsx("block text-[10px] font-medium", a.f === valor ? "text-lima" : "text-white/40")}>{fechaCorta(a.f)}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="btn-ghost !p-2" onClick={() => mover(-1)} disabled={antesDeHoy} aria-label="Mes anterior">
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-lg font-bold capitalize">
          {MESES[mes.m]} {mes.y}
        </p>
        <button type="button" className="btn-ghost !p-2" onClick={() => mover(1)} aria-label="Mes siguiente">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {ORDEN_DIAS.map((d) => (
          <span key={d} className={clsx("pb-1 text-[10px] font-bold uppercase tracking-wider", club.dias[d]?.abierto === false ? "text-white/20" : "text-white/40")}>
            {DIAS[d].slice(0, 2)}
          </span>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <span key={`h${i}`} />;
          const f = iso(mes.y, mes.m, d);
          const pasado = f < hoy;
          const cerrado = !abierto(f);
          const activo = f === valor;
          return (
            <button
              key={f}
              type="button"
              disabled={pasado || cerrado}
              onClick={() => {
                vibrar(10);
                onChange(f);
              }}
              aria-label={`${DIAS[diaSemana(f)]} ${d} de ${MESES[mes.m]}${cerrado ? " (club cerrado)" : ""}`}
              aria-pressed={activo}
              className={clsx(
                "relative flex aspect-square items-center justify-center text-sm font-semibold tabular transition",
                activo ? "seleccion sobre-marca rounded-full text-lima" : pasado || cerrado ? "rounded-xl text-white/15" : "rounded-xl text-white/85 hover:bg-white/10",
                cerrado && !pasado && "line-through",
              )}
            >
              {d}
              {f === hoy && !activo && <span className="absolute bottom-1 size-1 rounded-full bg-marca-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- reloj (horas y minutos) ---------- */

function Reloj({
  valor,
  desde,
  hasta,
  duraciones,
  onListo,
}: {
  valor: string;
  /** Minutos del día: primera y última hora permitidas. */
  desde: number;
  hasta: number;
  /** Fin: atajos de duración desde el inicio (en minutos). */
  duraciones?: { inicio: number; opciones: number[] };
  onListo: (h: string) => void;
}) {
  const inicial = Math.min(Math.max(aMinutos(valor), desde), hasta);
  const [min, setMin] = useState(inicial);
  const hora = Math.floor(min / 60);
  const minuto = min % 60;
  const horas: number[] = [];
  for (let h = Math.floor(desde / 60); h <= Math.floor(hasta / 60); h++) horas.push(h);
  const valido = (m: number) => m >= desde && m <= hasta;
  const elegirHora = (h: number) => {
    vibrar(8);
    // Mantiene los minutos si se puede; si no, el primer minuto válido de esa hora.
    const conMinuto = h * 60 + minuto;
    setMin(valido(conMinuto) ? conMinuto : MINUTOS.map((x) => h * 60 + x).find(valido) ?? conMinuto);
  };
  const sinOpciones = desde > hasta;

  if (sinOpciones) return <p className="py-6 text-center text-sm text-coral">No hay horarios disponibles ese día. Elige otra fecha o revisa el horario en Mi club.</p>;

  return (
    <div>
      <div className="flex items-center justify-center gap-1 py-2 font-display text-6xl font-bold tabular">
        <motion.span key={`h${hora}`} initial={{ y: -8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}>
          {pad(hora)}
        </motion.span>
        <span className="text-white/30">:</span>
        <motion.span key={`m${minuto}`} initial={{ y: -8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="text-neon">
          {pad(minuto)}
        </motion.span>
      </div>

      {duraciones && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {duraciones.opciones.map((d) => {
            const m = duraciones.inicio + d;
            const ok = valido(m);
            return (
              <button
                key={d}
                type="button"
                disabled={!ok}
                onClick={() => {
                  vibrar(8);
                  setMin(m);
                }}
                className={clsx(
                  "rounded-xl py-2 text-xs font-semibold transition",
                  m === min ? "seleccion sobre-marca text-lima" : ok ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-white/[0.02] text-white/20",
                )}
              >
                {duracionTexto(d)}
              </button>
            );
          })}
        </div>
      )}

      <p className="label !mb-2">Hora</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {horas.map((h) => {
          const algunoValido = MINUTOS.some((x) => valido(h * 60 + x));
          return (
            <button
              key={h}
              type="button"
              disabled={!algunoValido}
              onClick={() => elegirHora(h)}
              aria-pressed={h === hora}
              className={clsx(
                "relative overflow-hidden rounded-xl py-2.5 text-sm font-bold tabular shadow-sm transition active:scale-95",
                !algunoValido ? "bg-white/5 text-white/25 line-through" : h === hora ? "seleccion sobre-marca text-lima ring-2 ring-lima" : `${franja(h)} hover:brightness-105`,
              )}
            >
              {algunoValido && <span className={clsx("absolute right-1 top-1 size-1.5 rounded-full", h >= 19 || h < 6 ? "bg-blanco/90" : "bg-amber-300 shadow-[0_0_6px_#fcd34d]")} />}
              {pad(h)}
            </button>
          );
        })}
      </div>

      <p className="label !mb-2 mt-4">Minutos</p>
      <div className="grid grid-cols-4 gap-1.5">
        {MINUTOS.map((x) => {
          const m = hora * 60 + x;
          const ok = valido(m);
          return (
            <button
              key={x}
              type="button"
              disabled={!ok}
              onClick={() => {
                vibrar(8);
                setMin(m);
              }}
              aria-pressed={x === minuto}
              className={clsx(
                "rounded-xl py-2.5 text-sm font-semibold tabular transition",
                x === minuto ? "seleccion sobre-marca text-lima" : ok ? "bg-white/5 text-white/80 hover:bg-white/10" : "text-white/15",
              )}
            >
              :{pad(x)}
            </button>
          );
        })}
      </div>

      <button type="button" className="btn-neon mt-5 w-full py-3.5 text-base" onClick={() => onListo(aHora(min))} disabled={!valido(min)}>
        Listo · {aHora(min)}
      </button>
    </div>
  );
}
