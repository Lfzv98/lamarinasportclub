"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Mic, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "@/components/ui/Toaster";
import { useDictado } from "@/hooks/useDictado";
import { prepararAccion, resumenAccion } from "@/lib/asistente/ejecutar";
import { avisarPrefill } from "@/lib/asistente/prefill";
import { useAsistente, type MensajeChat } from "@/lib/asistente/store";
import type { AccionAsistente } from "@/lib/asistente/tipos";
import { vibrar } from "@/lib/feedback";
import { useEsStaff } from "@/lib/store";

/** Pantallas completas (TV, anotador, imprimir) donde el botón molestaría. */
const SIN_BOTON = [/\/tv$/, /\/anotar(\/|$)/, /\/pista\/[^/]+$/, /^\/manual\/imprimir$/, /^\/offline$/, /^\/inscripcion\//];
/** Pantallas con barra fija abajo: el botón sube para no taparla. */
const CON_BARRA = [/^\/evento\/[^/]+(\/[^/]+)?$/, /^\/habibi\/[^/]+$/, /^\/torneos\/(?!ranking$)[^/]+/, /^\/(setup|club)$/, /\/ajustes$/, /\/nuevo$/];

const SUGERENCIAS = [
  "Arma un americano mixto 5ta para hoy a las 7 con estos jugadores: ",
  "Inscribe estas duplas en el torneo: ",
  "¿Cómo cargo un marcador?",
  "¿Cuántos jugadores llevo en el americano?",
];

/** Asistente IA del staff: botón flotante + chat con voz. Solo responde sobre la app. */
export function Asistente() {
  const esStaff = useEsStaff();
  const ruta = usePathname() ?? "/";
  const abierto = useAsistente((s) => s.abierto);
  const abrir = useAsistente((s) => s.abrir);
  const consultarActivo = useAsistente((s) => s.consultarActivo);

  useEffect(() => {
    if (esStaff) void consultarActivo();
  }, [esStaff, consultarActivo]);

  if (!esStaff || SIN_BOTON.some((r) => r.test(ruta))) return null;
  return (
    <>
      <AnimatePresence>
        {!abierto && (
          <motion.button
            key="boton"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            onClick={() => {
              vibrar(8);
              abrir();
            }}
            className={clsx(
              "fixed right-4 z-[55] flex items-center gap-2 rounded-full bg-neon px-4 py-3 font-semibold text-marino-2 shadow-[0_10px_30px_-8px_rgba(141,220,47,0.7)] transition hover:brightness-105 sm:right-6",
              CON_BARRA.some((r) => r.test(ruta)) ? "bottom-28" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
            )}
            aria-label="Abrir asistente IA"
          >
            <Sparkles className="size-5" />
            <span className="text-sm">IA</span>
          </motion.button>
        )}
      </AnimatePresence>
      <Panel />
    </>
  );
}

function Panel() {
  const router = useRouter();
  const { abierto, cerrar, mensajes, pensando, activo, borrador, setBorrador, enviar, limpiar, escucharAlAbrir } = useAsistente();
  const lista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const dictado = useDictado((texto) => {
    const prefijo = useAsistente.getState().borrador;
    void enviar(prefijo.trim() ? `${prefijo.trim()} ${texto}` : texto);
  });

  useEffect(() => {
    if (!abierto) return;
    if (escucharAlAbrir && dictado.soportado) dictado.empezar();
    else setTimeout(() => caja.current?.focus(), 250);
    useAsistente.setState({ escucharAlAbrir: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, dictado.soportado]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length, pensando, dictado.parcial]);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierto, cerrar]);

  useEffect(() => {
    if (dictado.error) toast(dictado.error, "error");
  }, [dictado.error]);

  function ejecutar(m: MensajeChat, i: number, a: AccionAsistente) {
    // Lo que suma jugadores ya se sumó la primera vez: abrir de nuevo solo lleva a la pantalla.
    const yaSumado = m.hechas?.includes(i) && (a.tipo === "armar_americano" || (a.tipo === "armar_americano_torneo" && !a.reemplazar));
    const r = yaSumado ? { ruta: a.tipo === "armar_americano" ? "/setup?paso=4" : "/habibi/nuevo" } : prepararAccion(a);
    if ("error" in r) return toast(r.error, "error");
    useAsistente.getState().marcarHecha(m.id, i);
    vibrar(12);
    cerrar();
    const destino = new URL(r.ruta, location.origin);
    if (destino.pathname === location.pathname) {
      router.replace(r.ruta, { scroll: false });
      // La pantalla ya estaba abierta: se le avisa para que tome lo nuevo.
      setTimeout(avisarPrefill, 50);
    } else router.push(r.ruta);
  }

  const sinClave = activo === false;
  const puedeEnviar = !!borrador.trim() && !pensando && !sinClave;

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            className="fixed inset-0 z-[72] bg-marino-2/40 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
          />
          <motion.section
            role="dialog"
            aria-modal
            aria-label="Asistente IA"
            className="glass-strong fixed inset-x-0 bottom-0 z-[73] flex h-[85dvh] flex-col rounded-t-[2rem] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(42rem,calc(100dvh-3rem))] sm:w-[26rem] sm:rounded-[2rem]"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <header className="flex items-center gap-3 border-b border-white/10 px-5 pb-3 pt-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-neon/15 text-neon">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold leading-tight">Asistente IA</h2>
                <p className="text-xs text-white/50">Americanos, Americano Torneo y torneos · solo staff</p>
              </div>
              {mensajes.length > 0 && (
                <button className="btn-ghost !p-2.5" onClick={() => confirm("¿Borrar la conversación?") && limpiar()} aria-label="Borrar conversación" title="Borrar conversación">
                  <Trash2 className="size-4" />
                </button>
              )}
              <button className="btn-ghost !p-2.5" onClick={cerrar} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </header>

            <div ref={lista} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {sinClave && (
                <p className="rounded-2xl border border-coral/40 bg-coral/10 p-3 text-sm text-white/80">
                  El asistente todavía no está encendido: falta pegar la clave <b>ANTHROPIC_API_KEY</b> en las variables de entorno de Vercel.
                </p>
              )}
              {!mensajes.length && !sinClave && (
                <div className="space-y-3">
                  <p className="text-sm text-white/70">
                    Dime qué necesitas, escrito o por voz. Puedo armarte un americano, un Americano Torneo o un torneo con sus duplas, y responder cómo se hace cualquier cosa de la app. Siempre te dejo el formulario lleno para que revises y confirmes tú.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGERENCIAS.map((s) => (
                      <button
                        key={s}
                        className="chip text-left hover:border-neon/40 hover:text-white"
                        onClick={() => (s.endsWith("?") ? void enviar(s) : (setBorrador(s), caja.current?.focus()))}
                      >
                        {s.replace(/: $/, "…")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mensajes.map((m) => (
                <Burbuja key={m.id} m={m} onAccion={(i, a) => ejecutar(m, i, a)} />
              ))}
              {dictado.escuchando && (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-neon/40 bg-neon/10 px-3.5 py-2.5 text-sm">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neon">
                    <span className="size-2 animate-pulse rounded-full bg-neon" /> Escuchando…
                  </span>
                  {[borrador.trim(), dictado.parcial].filter(Boolean).join(" ") || <span className="text-white/50">Habla, y toca parar cuando termines.</span>}
                </div>
              )}
              {pensando && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="size-1.5 rounded-full bg-neon" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </span>
                  Pensando…
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={caja}
                  rows={1}
                  className="input max-h-32 min-h-11 flex-1 resize-none !py-2.5"
                  placeholder={dictado.soportado ? "Escribe o toca el micrófono" : "Escribe (o usa el micrófono del teclado)"}
                  value={borrador}
                  disabled={sinClave}
                  onChange={(e) => setBorrador(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (puedeEnviar) void enviar(borrador);
                    }
                  }}
                />
                {dictado.soportado && (
                  <button
                    className={clsx("flex size-11 shrink-0 items-center justify-center rounded-full transition", dictado.escuchando ? "animate-pulse bg-coral text-white" : "bg-white/10 text-white hover:bg-white/15")}
                    onClick={() => (dictado.escuchando ? dictado.parar() : dictado.empezar())}
                    disabled={sinClave || pensando}
                    aria-label={dictado.escuchando ? "Parar y enviar" : "Dictar por voz"}
                    title={dictado.escuchando ? "Parar y enviar" : "Dictar por voz"}
                  >
                    {dictado.escuchando ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
                  </button>
                )}
                <button
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neon text-marino-2 transition disabled:opacity-40"
                  onClick={() => void enviar(borrador)}
                  disabled={!puedeEnviar}
                  aria-label="Enviar"
                >
                  <ArrowUp className="size-5" />
                </button>
              </div>
            </footer>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Burbuja({ m, onAccion }: { m: MensajeChat; onAccion: (i: number, a: AccionAsistente) => void }) {
  const propio = m.rol === "staff";
  return (
    <div className={clsx("flex flex-col gap-2", propio ? "items-end" : "items-start")}>
      <p
        className={clsx(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          propio ? "rounded-br-md bg-marca-2 text-blanco" : m.error ? "rounded-bl-md border border-coral/40 bg-coral/10" : "rounded-bl-md bg-white/[0.06]",
        )}
      >
        {m.texto}
      </p>
      {m.acciones?.map((a, i) => {
        const r = resumenAccion(a);
        const hecha = m.hechas?.includes(i);
        return (
          <div key={i} className="w-[85%] rounded-2xl border border-neon/30 bg-neon/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neon">
              <Wand2 className="size-3.5" /> Listo para revisar
            </p>
            <p className="mt-1 font-semibold">{r.titulo}</p>
            {r.detalle && <p className="text-xs text-white/60">{r.detalle}</p>}
            <button className={clsx("mt-2.5 w-full !py-2 text-sm", hecha ? "btn-ghost" : "btn-neon")} onClick={() => onAccion(i, a)}>
              {hecha ? "Abrir de nuevo" : r.boton}
            </button>
          </div>
        );
      })}
    </div>
  );
}
