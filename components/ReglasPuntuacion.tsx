"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { vibrar } from "@/lib/feedback";
import { descripcionPuntuacion, empateTieBreak, LIMITES, metaDe, modoDe, tieConDiferencia } from "@/lib/scoring";
import type { ConfigPuntuacion, ModoConteo } from "@/types/americano";

/**
 * Reglas del partido, 100% personalizables: a cuántos puntos o games se juega,
 * si se cuenta el total o gana el primero en llegar, punto de oro o ventaja,
 * tie-break al empatar y super tie en el set decisivo. Los atajos cubren lo
 * habitual; el contador permite cualquier otro valor.
 */
export function ReglasPuntuacion({ valor, onChange }: { valor: ConfigPuntuacion; onChange: (c: ConfigPuntuacion) => void }) {
  const set = (cambios: Partial<ConfigPuntuacion>) => onChange({ ...valor, ...cambios });
  const n = metaDe(valor);
  const modo = modoDe(valor);

  return (
    <div className="glass mt-4 space-y-5 rounded-2xl p-4">
      {valor.metodo === "PUNTOS_TOTALES" && (
        <>
          <Fila titulo="¿Cómo se cuenta?">
            <Segmented<ModoConteo>
              className="w-full sm:w-auto"
              valor={modo}
              onChange={(m) => set({ modo: m })}
              opciones={[
                { id: "TOTAL", label: "Puntos en total" },
                { id: "A_GANAR", label: "Primero en llegar" },
              ]}
            />
          </Fila>
          <Numero
            titulo={modo === "TOTAL" ? "Puntos por partido" : "Gana quien llega a"}
            ayuda={modo === "TOTAL" ? `Se juegan ${n} puntos entre las dos parejas (ej. ${Math.ceil(n / 2) + 1}-${n - Math.ceil(n / 2) - 1}).` : `Gana la primera pareja en llegar a ${n} (ej. ${n}-${Math.max(0, n - 4)}).`}
            valor={n}
            atajos={modo === "TOTAL" ? [16, 21, 24, 32] : [11, 13, 15, 21]}
            limites={LIMITES.puntos}
            onChange={(v) => set({ puntosPorPartido: v })}
          />
        </>
      )}

      {valor.metodo === "GAMES_PUNTO_ORO" && (
        <>
          <Fila titulo="¿Cómo se cuenta?">
            <Segmented<ModoConteo>
              className="w-full sm:w-auto"
              valor={modo}
              onChange={(m) => set({ modo: m })}
              opciones={[
                { id: "TOTAL", label: "Games en total" },
                { id: "A_GANAR", label: "Primero en llegar" },
              ]}
            />
          </Fila>
          <Numero
            titulo={modo === "TOTAL" ? "Games por partido" : "Gana quien llega a"}
            ayuda={modo === "TOTAL" ? `Se juegan ${n} games (ej. ${Math.ceil(n / 2)}-${Math.floor(n / 2)}).` : `Gana la primera pareja en llegar a ${n} games (ej. ${n}-${Math.max(0, n - 2)}).`}
            valor={n}
            atajos={modo === "TOTAL" ? [5, 7, 9] : [4, 6, 9]}
            limites={LIMITES.games}
            onChange={(v) => set({ gamesPorPartido: v })}
          />
          <PuntoDeOro valor={valor} set={set} />
          <Opcional
            titulo="Tie-break si empatan"
            activo={!!valor.tieBreak}
            onToggle={(on) => set({ tieBreak: on ? 7 : null })}
            ayuda={
              valor.tieBreak
                ? `Si quedan ${empateTieBreak(valor)}-${empateTieBreak(valor)}, el último game es un tie a ${valor.tieBreak} puntos ${tieConDiferencia(valor) ? `con 2 de diferencia (ej. ${valor.tieBreak}-${valor.tieBreak - 2} o ${valor.tieBreak + 1}-${valor.tieBreak - 1})` : `sin diferencia de 2: gana el primero en llegar (ej. ${valor.tieBreak}-${valor.tieBreak - 1})`}.`
                : "Sin tie-break: si se acaba el tiempo empatados, queda empate."
            }
          >
            <Numero titulo="Tie a" valor={valor.tieBreak ?? 7} atajos={[5, 7, 10]} limites={LIMITES.tie} onChange={(v) => set({ tieBreak: v })} />
            <DiferenciaDos valor={valor} set={set} />
          </Opcional>
        </>
      )}

      {valor.metodo === "SETS_CORTOS" && (
        <>
          <Fila titulo="Sets">
            <Segmented<string>
              className="w-full sm:w-auto"
              valor={String(valor.setsMaximos ?? 3)}
              onChange={(s) => set({ setsMaximos: Number(s), superTie: Number(s) === 1 ? null : valor.superTie })}
              opciones={[
                { id: "1", label: "1 set" },
                { id: "3", label: "Mejor de 3" },
                { id: "5", label: "Mejor de 5" },
              ]}
            />
          </Fila>
          <Numero
            titulo="Games por set"
            ayuda={n <= 4 ? `Set corto: termina ${n}-0 … ${n}-${n - 1} (tie-break a ${n - 1}-${n - 1}).` : `Set normal: ${n}-${n - 2}, ${n + 1}-${n - 1} o ${n + 1}-${n} con tie-break.`}
            valor={n}
            atajos={[4, 6]}
            limites={LIMITES.gamesSet}
            onChange={(v) => set({ gamesPorPartido: v })}
          />
          <PuntoDeOro valor={valor} set={set} />
          {(valor.setsMaximos ?? 3) > 1 && (
            <Opcional
              titulo="Super tie en el set decisivo"
              activo={!!valor.superTie}
              onToggle={(on) => set({ superTie: on ? 10 : null })}
              ayuda={
                valor.superTie
                  ? `Si van iguales en sets, el último se define con un super tie a ${valor.superTie} puntos ${tieConDiferencia(valor) ? "con 2 de diferencia" : `sin diferencia de 2 (ej. ${valor.superTie}-${valor.superTie - 1})`}.`
                  : "El set decisivo se juega completo."
              }
            >
              <Numero titulo="Super tie a" valor={valor.superTie ?? 10} atajos={[7, 10, 15]} limites={LIMITES.tie} onChange={(v) => set({ superTie: v })} />
              <DiferenciaDos valor={valor} set={set} />
            </Opcional>
          )}
        </>
      )}

      <p className="rounded-xl bg-neon/10 px-3 py-2 text-sm font-semibold text-neon">{descripcionPuntuacion(valor)}</p>
    </div>
  );
}

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-white/70">{titulo}</span>
      {children}
    </div>
  );
}

function Numero({
  titulo,
  ayuda,
  valor,
  atajos,
  limites,
  onChange,
}: {
  titulo: string;
  ayuda?: string;
  valor: number;
  atajos: number[];
  limites: { min: number; max: number };
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-white/70">{titulo}</span>
        <div className="flex flex-wrap items-center gap-2">
          {atajos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                vibrar(8);
                onChange(a);
              }}
              className={clsx("rounded-xl px-3.5 py-2 text-sm font-bold transition", valor === a ? "bg-neon text-noche" : "bg-white/5 text-white/70 hover:bg-white/10")}
            >
              {a}
            </button>
          ))}
          <Stepper valor={valor} onChange={onChange} min={limites.min} max={limites.max} />
        </div>
      </div>
      {ayuda && <p className="mt-1.5 text-xs text-white/45">{ayuda}</p>}
    </div>
  );
}

function PuntoDeOro({ valor, set }: { valor: ConfigPuntuacion; set: (c: Partial<ConfigPuntuacion>) => void }) {
  return (
    <Fila titulo="En 40-40">
      <Segmented<string>
        className="w-full sm:w-auto"
        valor={valor.puntoDeOro === false ? "ventaja" : "oro"}
        onChange={(v) => set({ puntoDeOro: v === "oro" })}
        opciones={[
          { id: "oro", label: "Punto de oro" },
          { id: "ventaja", label: "Ventaja" },
        ]}
      />
    </Fila>
  );
}

function Opcional({
  titulo,
  activo,
  onToggle,
  ayuda,
  children,
}: {
  titulo: string;
  activo: boolean;
  onToggle: (on: boolean) => void;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => {
          vibrar(8);
          onToggle(!activo);
        }}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm text-white/70">{titulo}</span>
        <span className={clsx("relative h-7 w-12 rounded-full transition", activo ? "bg-neon" : "bg-white/15")}>
          <motion.span layout className={clsx("absolute top-1 size-5 rounded-full bg-white shadow", activo ? "right-1" : "left-1")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {activo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-3">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-1.5 text-xs text-white/45">{ayuda}</p>
    </div>
  );
}

/** Interruptor: el tie-break (o super tie) se gana por 2 de diferencia, o gana el primero en llegar. */
function DiferenciaDos({ valor, set }: { valor: ConfigPuntuacion; set: (c: Partial<ConfigPuntuacion>) => void }) {
  const on = tieConDiferencia(valor);
  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <span className="text-sm text-white/70">Ganar por 2 de diferencia</span>
      <Switch activo={on} onChange={(v) => set({ tieConDiferencia: v ? undefined : false })} etiqueta="Ganar el tie-break por 2 de diferencia" />
    </div>
  );
}
