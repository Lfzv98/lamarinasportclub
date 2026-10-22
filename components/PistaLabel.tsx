import clsx from "clsx";
import { Sun } from "lucide-react";
import { nombrePista, pistaInfo } from "@/lib/horarios";
import type { EventoAmericano } from "@/types/americano";

/** "PISTA 5 ☀" — marca las pistas al aire libre. */
export function PistaLabel({ evento, numero, className, icono = "size-3.5" }: { evento: Pick<EventoAmericano, "canchas">; numero: number; className?: string; icono?: string }) {
  const info = pistaInfo(evento, numero);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-display font-bold uppercase text-neon", className)}>
      {nombrePista(evento, numero)}
      {info && !info.techada && <Sun className={clsx("text-amber-300", icono)} aria-label="Al aire libre" />}
    </span>
  );
}
