"use client";

import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { aperturaInscripcion } from "@/lib/inscripcion";
import type { ApiInscripcionPublica } from "@/types/inscripcion";
import type { Torneo } from "@/types/torneo";

/** Acceso del staff a las inscripciones online, con lo que falta revisar. */
export function AvisoInscripciones({ torneo }: { torneo: Torneo }) {
  const [pendientes, setPendientes] = useState<number | null>(null);
  const configurada = !!torneo.inscripcion;
  useEffect(() => {
    if (!configurada) return;
    let vivo = true;
    fetch(`/api/inscripciones/${encodeURIComponent(torneo.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApiInscripcionPublica | null) => vivo && d?.inscripciones && setPendientes(d.inscripciones.filter((i) => i.estado === "PAGO_REPORTADO" || i.estado === "PENDIENTE_PAGO").length))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [torneo.id, configurada]);
  const ap = aperturaInscripcion(torneo);
  return (
    <Link
      href={configurada ? `/torneos/${torneo.id}/inscripciones` : `/torneos/${torneo.id}/ajustes#inscripcion`}
      className="glass mt-2 flex items-center gap-3 rounded-2xl p-3 transition hover:border-neon/30 active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lima text-marino-2">
        <Inbox className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Inscripciones online</span>
        <span className="block truncate text-xs text-white/55">
          {!configurada ? "Actívalas para que las duplas se inscriban solas con un enlace" : pendientes ? `${pendientes} por revisar · ${ap.abierta ? "abiertas" : "cerradas"}` : ap.abierta ? "Abiertas · nada pendiente" : "Cerradas"}
        </span>
      </span>
      {!!pendientes && <span className="rounded-full bg-amber-300 px-2 py-0.5 font-display text-sm font-bold text-marino-2">{pendientes}</span>}
      <ChevronRight className="size-5 text-white/40" />
    </Link>
  );
}
