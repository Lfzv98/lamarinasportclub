"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { CloudRain, Play, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { toast } from "@/components/ui/Toaster";
import { canchasDelEvento, despues, partidosEnEspera } from "@/lib/evento";
import { vibrar } from "@/lib/feedback";
import { nombrePista, pistaInfo } from "@/lib/horarios";
import { eventosDelTorneo, pistasDelTorneo, reactivarPistaEn, suspenderPistaEn } from "@/lib/lluvia";
import { useAmericanos } from "@/lib/store";
import type { EventoAmericano, Jugador, Partido } from "@/types/americano";

const MOTIVOS = ["Lluvia", "Pista mojada", "Falla de luz", "Mantenimiento"];

const corto = (j?: Jugador) => (j ? `${j.nombre}${j.apellido ? ` ${j.apellido.charAt(0)}.` : ""}` : "?");
const nombrePar = (e: EventoAmericano, ids: string[]) => ids.map((id) => corto(e.jugadores.find((j) => j.id === id))).join(" / ");

/**
 * Suspender y reactivar pistas en un americano o en un Americano Torneo (en todos sus grupos y la
 * llave a la vez). Devuelve las acciones y la hoja para confirmar, lista para poner en la página.
 */
export function useLluvia(evento: EventoAmericano) {
  const eventos = useAmericanos((s) => s.eventos);
  const actualizar = useAmericanos((s) => s.actualizar);
  const [pidiendo, setPidiendo] = useState<number | null>(null);
  const lista = eventosDelTorneo(evento, eventos);
  const pistas = pistasDelTorneo(lista);
  const suspendidas = new Map(lista.flatMap((e) => e.pistasSuspendidas ?? []).map((s) => [s.numero, s]));

  const suspender = (numero: number, motivo: string, marcador: string | null) => {
    const antes = useAmericanos.getState().eventos;
    const tocados = lista.filter((e) => canchasDelEvento(e).includes(numero)).map((e) => e.id);
    for (const id of tocados) actualizar(id, (x) => suspenderPistaEn(x, numero, { motivo, marcador }));
    vibrar([10, 30, 10]);
    const quedan = pistas.filter((n) => n !== numero && !suspendidas.has(n)).length;
    // Deshacer deja el cuadro exactamente como estaba (un toque por error).
    const deshacer = () => {
      for (const id of tocados) if (antes[id]) actualizar(id, (x) => ({ ...antes[id], actualizadoEn: despues(x.actualizadoEn) }));
    };
    toast(quedan ? `${nombrePista(evento, numero)} suspendida. El cuadro ya se acomodó en ${quedan} pista${quedan > 1 ? "s" : ""}.` : "Todas las pistas suspendidas: la ronda queda en pausa.", "ok", {
      label: "Deshacer",
      fn: deshacer,
    });
  };
  const reactivar = (numero: number) => {
    for (const e of lista) actualizar(e.id, (x) => reactivarPistaEn(x, numero));
    toast(`${nombrePista(evento, numero)} activa otra vez. Lo que falta ya la incluye.`);
  };

  const enJuegoEn = (numero: number): { e: EventoAmericano; p: Partido } | null => {
    for (const e of lista) {
      const p = e.rondas.flatMap((r) => r.partidos).find((x) => x.pista === numero && x.estado === "EN_JUEGO");
      if (p) return { e, p };
    }
    return null;
  };

  const hoja = (
    <SuspenderHoja
      numero={pidiendo}
      evento={evento}
      enJuego={pidiendo === null ? null : enJuegoEn(pidiendo)}
      onClose={() => setPidiendo(null)}
      onSuspender={(motivo, marcador) => {
        if (pidiendo !== null) suspender(pidiendo, motivo, marcador);
        setPidiendo(null);
      }}
    />
  );
  return { pistas, suspendidas, pedir: setPidiendo, reactivar, hoja };
}

/** Confirmación de un toque: motivo (Lluvia por defecto) y, si quieren, cómo iba el partido. */
function SuspenderHoja({
  numero,
  evento,
  enJuego,
  onClose,
  onSuspender,
}: {
  numero: number | null;
  evento: EventoAmericano;
  enJuego: { e: EventoAmericano; p: Partido } | null;
  onClose: () => void;
  onSuspender: (motivo: string, marcador: string | null) => void;
}) {
  const [motivo, setMotivo] = useState("Lluvia");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  useEffect(() => {
    if (numero === null) return;
    setMotivo("Lluvia");
    setA("");
    setB("");
  }, [numero]);
  const marcador = a !== "" || b !== "" ? `${a || 0}-${b || 0}` : null;
  return (
    <Hoja
      abierta={numero !== null}
      onClose={onClose}
      titulo={numero === null ? "" : `Suspender ${nombrePista(evento, numero)}`}
      sub="El resto sigue jugando. El cuadro se acomoda solo en las pistas que quedan."
    >
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo(m)} className={clsx("chip !py-1.5", motivo === m && "seleccion")}>
            {m}
          </button>
        ))}
      </div>
      {enJuego && (
        <div className="mt-4 rounded-2xl bg-white/[0.04] p-3">
          <p className="text-xs text-white/55">
            Se estaba jugando. ¿Cómo iban? En{" "}
            {enJuego.e.puntuacion.metodo === "PUNTOS_TOTALES" ? "puntos" : enJuego.e.puntuacion.metodo === "GAMES_PUNTO_ORO" ? "games" : "games del set en juego"} (opcional, para seguir donde quedaron)
          </p>
          {(["A", "B"] as const).map((lado) => (
            <label key={lado} className="mt-2 flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{nombrePar(enJuego.e, (lado === "A" ? enJuego.p.parejaA : enJuego.p.parejaB).jugadorIds)}</span>
              <input
                inputMode="numeric"
                className="input !w-20 text-center tabular"
                placeholder="—"
                value={lado === "A" ? a : b}
                onChange={(ev) => (lado === "A" ? setA : setB)(ev.target.value.replace(/\D/g, "").slice(0, 2))}
                aria-label={`Puntos de ${lado === "A" ? "la primera" : "la segunda"} pareja`}
              />
            </label>
          ))}
          <p className="mt-2 text-[11px] text-white/45">Ese partido queda en espera y se termina primero, en otra pista, en la ronda siguiente.</p>
        </div>
      )}
      <button type="button" className="btn-neon mt-4 w-full py-3.5 text-base" onClick={() => onSuspender(motivo, marcador)}>
        <CloudRain className="size-5" /> Suspender pista
      </button>
    </Hoja>
  );
}

/**
 * Apartado del cuadro en vivo: pistas suspendidas (el staff las reactiva con un toque) y partidos
 * en espera por lluvia, con dónde y cuándo siguen. El staff ve además todas las pistas para suspender.
 */
export function PanelLluvia({ evento, esStaff, lluvia }: { evento: EventoAmericano; esStaff: boolean; lluvia: ReturnType<typeof useLluvia> }) {
  const espera = partidosEnEspera(evento);
  const { pistas, suspendidas } = lluvia;
  if (!esStaff && !suspendidas.size && !espera.length) return null;
  if (evento.estado === "FINALIZADO" && !suspendidas.size) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx("glass mt-4 rounded-3xl p-4", (suspendidas.size > 0 || espera.length > 0) && "border-sky-300/25")}>
      <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <p className="flex items-center gap-2 font-display text-base font-bold text-sky-200">
          <CloudRain className="size-4" /> {suspendidas.size ? "Pistas suspendidas" : "¿Llueve en una pista?"}
        </p>
        {esStaff && <span className={clsx("text-[11px] text-white/40 sm:text-right", suspendidas.size > 0 && "sm:hidden")}>{suspendidas.size ? "En azul, suspendidas: tócalas para reactivar" : "Toca la pista y el cuadro se acomoda solo"}</span>}
      </div>

      {esStaff && (
        // En el celular, de a dos por fila para que 4 o 6 pistas no hagan una columna larga.
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {pistas.map((n) => {
            const s = suspendidas.get(n);
            const info = pistaInfo(evento, n);
            return s ? (
              <button
                key={n}
                type="button"
                aria-label={`Reactivar ${nombrePista(evento, n)}`}
                className="chip justify-center min-w-0 !border-sky-300/50 !bg-sky-300/15 !px-2 !py-1.5 !text-sky-100 sm:!px-3"
                onClick={() => {
                  if (confirm(`¿Reactivar ${nombrePista(evento, n)}? Lo que falta del evento la vuelve a usar.`)) lluvia.reactivar(n);
                }}
              >
                <Play className="size-3 shrink-0" /> <span className="truncate">
                  <span className="hidden sm:inline">Reactivar </span>
                  {nombrePista(evento, n)}
                </span>
              </button>
            ) : (
              <button key={n} type="button" className="chip justify-center min-w-0 !px-2 !py-1.5 sm:!px-3" onClick={() => lluvia.pedir(n)}>
                {info && !info.techada ? <Sun className="size-3 shrink-0 text-amber-300" /> : <CloudRain className="size-3 shrink-0" />}
                <span className="truncate">
                  <span className="hidden sm:inline">Suspender </span>
                  {nombrePista(evento, n)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!esStaff && suspendidas.size > 0 && (
        <p className="text-sm text-white/70">
          {[...suspendidas.values()].map((s) => `${nombrePista(evento, s.numero)} (${s.motivo.toLowerCase()})`).join(", ")}: el evento sigue en las demás pistas.
        </p>
      )}

      {espera.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {espera.map((p) => (
            <li key={p.id} className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm">
              <span className="font-semibold">{nombrePar(evento, p.parejaA.jugadorIds)}</span> <span className="text-white/40">vs</span>{" "}
              <span className="font-semibold">{nombrePar(evento, p.parejaB.jugadorIds)}</span>
              <span className="block text-xs text-sky-200/80">
                En espera{p.suspendido?.marcador ? ` · iban ${p.suspendido.marcador}` : ""} ·{" "}
                {!canchasDelEvento(evento).some((n) => !suspendidas.has(n))
                  ? "siguen cuando se reactive una pista"
                  : evento.habibi?.rol === "LLAVE"
                    ? `siguen en ${nombrePista(evento, p.pista)} apenas se libere`
                    : `siguen primero en la ronda ${p.rondaNumero}, ${nombrePista(evento, p.pista)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
