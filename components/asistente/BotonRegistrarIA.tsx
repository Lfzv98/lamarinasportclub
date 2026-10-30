"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { useAsistente } from "@/lib/asistente/store";
import { useEsStaff } from "@/lib/store";

/**
 * "Registrar con IA" en cada pantalla de inscripción: abre el asistente con el
 * micrófono escuchando y una frase inicial que dice dónde va lo dictado.
 */
export function BotonRegistrarIA({ sugerencia, ancho = false, className }: { sugerencia: string; ancho?: boolean; className?: string }) {
  const esStaff = useEsStaff();
  const abrir = useAsistente((s) => s.abrir);
  if (!esStaff) return null;
  return (
    <button
      type="button"
      onClick={() => abrir({ escuchar: true, texto: sugerencia })}
      className={clsx(
        ancho
          ? "glass mb-6 flex w-full items-center gap-3 rounded-2xl border border-neon/30 p-4 text-left transition hover:border-neon/60"
          : "btn-ghost !px-3 !py-2 text-neon",
        className,
      )}
    >
      <span className={clsx("flex shrink-0 items-center justify-center rounded-xl bg-neon/15 text-neon", ancho ? "size-11" : "size-5 !bg-transparent")}>
        <Sparkles className={ancho ? "size-5" : "size-4"} />
      </span>
      {ancho ? (
        <span>
          <span className="block font-semibold">Registrar con IA</span>
          <span className="block text-xs text-white/55">Dícelo por voz: “Ana Pérez y Carla Ruiz, Luis Zea y Pedro Gómez…”</span>
        </span>
      ) : (
        <span className="hidden sm:inline">Registrar con IA</span>
      )}
    </button>
  );
}
