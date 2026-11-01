"use client";

import clsx from "clsx";
import Link from "next/link";
import { Archive, CheckCircle2, Lock, RotateCcw, Trophy } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { useAmericanos } from "@/lib/store";
import { cerrarTorneo, listoParaCerrar, pendientesCierre, reabrirTorneo } from "@/lib/torneo/torneo";
import { useTorneos } from "@/lib/torneosStore";
import type { Torneo } from "@/types/torneo";

const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

/** Lo que falta para cerrar, en una frase ("3 partidos sin jugar · 1 resultado por revisar"). */
export function textoPendientesCierre(t: Torneo): string {
  const f = pendientesCierre(t);
  return [
    f.sinSorteo && `${pl(f.sinSorteo, "categoría")} sin sorteo`,
    f.sinPublicar && `${pl(f.sinPublicar, "categoría")} sin publicar`,
    f.sinJugar && `${pl(f.sinJugar, "partido")} sin jugar`,
    f.porRevisar && `${pl(f.porRevisar, "resultado")} por revisar en mesa técnica`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Cierre del torneo (solo staff). Se cierra solo cuando mesa técnica da «Visto» a la última final;
 * este botón sirve para cerrarlo a mano (por ejemplo, si una categoría no se jugó) o para reabrirlo.
 * `forzar`: ofrece cerrar aunque falten partidos (en Ajustes del torneo).
 */
export function CierreTorneo({ torneo, forzar = false, className }: { torneo: Torneo; forzar?: boolean; className?: string }) {
  const guardar = useTorneos((s) => s.guardar);
  const staff = useAmericanos((s) => s.staff);
  const listo = listoParaCerrar(torneo);
  const cerrado = torneo.estado === "FINALIZADO";
  if (!staff || (!cerrado && !listo && !forzar)) return null;

  const cerrar = () => {
    const falta = textoPendientesCierre(torneo);
    if (!listo && !confirm(`Todavía falta: ${falta || "nada que jugar"}.\n\n¿Cerrar el torneo igual? Pasa al Historial y sale de las tablets de los árbitros.`)) return;
    if (listo && !confirm("¿Cerrar el torneo? Pasa al Historial y sale de las tablets de los árbitros. Los resultados y las estadísticas quedan a la vista.")) return;
    vibrar(25);
    guardar(cerrarTorneo(torneo, staff.nombre));
    toast("Torneo cerrado: ya está en el Historial");
  };
  const reabrir = () => {
    if (!confirm("¿Reabrir el torneo? Vuelve a Torneos activos y a las tablets de los árbitros.")) return;
    guardar(reabrirTorneo(torneo, staff.nombre));
    toast("Torneo reabierto", "info");
  };

  if (cerrado)
    return (
      <section className={clsx("glass flex flex-wrap items-center gap-3 rounded-2xl p-4", className)} data-cierre="cerrado">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
          <Archive className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Torneo cerrado</p>
          <p className="text-xs text-white/50">
            {torneo.cerradoEn ? new Date(torneo.cerradoEn).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "En el Historial"}
            {torneo.cerradoPor ? ` · ${torneo.cerradoPor === "Automático" ? "se cerró solo al revisar la última final" : torneo.cerradoPor}` : ""}
          </p>
        </div>
        <button className="btn-ghost !py-2 text-sm" onClick={reabrir}>
          <RotateCcw className="size-4" /> Reabrir
        </button>
      </section>
    );

  return (
    <section className={clsx("flex flex-wrap items-center gap-3 rounded-2xl border p-4", listo ? "border-neon/40 bg-neon/10" : "glass border-white/10", className)} data-cierre={listo ? "listo" : "pendiente"}>
      <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-xl", listo ? "bg-neon text-noche" : "bg-white/10 text-white/70")}>
        {listo ? <CheckCircle2 className="size-5" /> : <Lock className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{listo ? "Todo jugado y revisado" : "Cerrar el torneo"}</p>
        <p className="text-xs text-white/55">
          {listo ? "Se cierra solo al dar «Visto» a la última final; si no, ciérralo aquí." : `Falta: ${textoPendientesCierre(torneo) || "—"}. Se cierra solo cuando todo esté jugado y revisado.`}
        </p>
      </div>
      <div className="flex gap-2">
        {listo && (
          <Link href={`/torneos/${torneo.id}/cuadros`} className="btn-ghost !py-2 text-sm">
            <Trophy className="size-4" /> Campeones
          </Link>
        )}
        <button className={clsx("!py-2 text-sm", listo ? "btn-neon" : "btn-ghost")} onClick={cerrar} data-cerrar-torneo>
          <Archive className="size-4" /> {listo ? "Cerrar torneo" : "Cerrar igual"}
        </button>
      </div>
    </section>
  );
}
