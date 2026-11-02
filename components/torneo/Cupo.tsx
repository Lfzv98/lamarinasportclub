"use client";

import clsx from "clsx";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { CUPO_MAX, CUPO_MIN } from "@/lib/torneo/torneo";

/** Cupo sugerido al encenderlo: 16 duplas, o lo que ya hay inscrito si es más. */
export const CUPO_SUGERIDO = 16;

/**
 * Cupo máximo de duplas de una categoría: apagado = sin límite. Con cupo, la inscripción online
 * deja de aceptar duplas al llenarse y el staff no puede inscribir más a mano.
 */
export function CupoControl({
  valor,
  onChange,
  inscritas = 0,
  etiqueta = "Cupo máximo",
  sub,
  compacto = false,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  inscritas?: number;
  etiqueta?: string;
  sub?: string;
  compacto?: boolean;
}) {
  const minimo = Math.max(CUPO_MIN, inscritas);
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-3", !compacto && "p-4")} data-cupo>
      <div className="min-w-0">
        <p className={clsx("font-semibold", compacto && "text-sm")}>{etiqueta}</p>
        <p className="text-xs text-white/50">{sub ?? (valor == null ? "Sin límite de duplas." : `Al llegar a ${valor} duplas se cierra sola la inscripción de esta categoría.`)}</p>
      </div>
      <div className="flex items-center gap-3">
        {valor != null && <Stepper valor={valor} onChange={(v) => onChange(v)} min={minimo} max={CUPO_MAX} paso={1} sufijo="duplas" />}
        <Switch activo={valor != null} onChange={(on) => onChange(on ? Math.max(CUPO_SUGERIDO, inscritas) : null)} etiqueta={etiqueta} />
      </div>
    </div>
  );
}

/** Barra de llenado: verde con lugar, ámbar con pocos lugares, coral si se llenó. */
export function BarraCupo({ ocupados, cupo, className }: { ocupados: number; cupo: number | null; className?: string }) {
  if (cupo == null) return <p className={clsx("text-xs text-white/50", className)}>{ocupados} inscrita{ocupados === 1 ? "" : "s"} · sin cupo máximo</p>;
  const lleno = ocupados >= cupo;
  const pocos = !lleno && cupo - ocupados <= Math.max(1, Math.round(cupo * 0.15));
  return (
    <div className={className} data-barra-cupo>
      <div className="flex items-center justify-between text-xs">
        <span className={clsx("font-semibold", lleno ? "text-coral" : pocos ? "text-amber-200" : "text-white/70")}>
          {lleno ? "Cupo lleno" : `Quedan ${cupo - ocupados} de ${cupo}`}
        </span>
        <span className="tabular-nums text-white/50">
          {ocupados}/{cupo}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={clsx("h-full rounded-full transition-all", lleno ? "bg-coral" : pocos ? "bg-amber-300" : "bg-neon")} style={{ width: `${Math.min(100, (ocupados / cupo) * 100)}%` }} />
      </div>
    </div>
  );
}
