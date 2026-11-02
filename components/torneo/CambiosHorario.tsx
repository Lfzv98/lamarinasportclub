"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, MessageCircle } from "lucide-react";
import { fechaCorta } from "@/components/torneo/TorneoShell";
import { nombreCorto } from "@/lib/torneo/categorias";
import { pistaCorta } from "@/lib/torneo/imprevistos";
import { categoria, dupla, jugador, todosLosPartidos } from "@/lib/torneo/torneo";
import type { Torneo } from "@/types/torneo";

const AVISADOS = "lamarina-avisos-horario";

/** Teléfono venezolano a formato internacional para WhatsApp ("0414…" → "58414…"). */
function telefonoWhatsapp(tel?: string | null): string | null {
  const t = (tel ?? "").replace(/\D/g, "");
  if (t.length < 10) return null;
  return t.length === 11 && t.startsWith("0") ? `58${t.slice(1)}` : t;
}

/**
 * Partidos publicados que cambiaron de hora (atraso, lluvia, a mano): a quién avisar y con un
 * toque, el WhatsApp con el horario nuevo. En la app los jugadores ya lo ven marcado.
 */
export function CambiosHorario({ torneo, onAbrir }: { torneo: Torneo; onAbrir: (id: string) => void }) {
  const [avisados, setAvisados] = useState<string[]>([]);
  useEffect(() => {
    try {
      setAvisados(JSON.parse(localStorage.getItem(AVISADOS) ?? "[]") as string[]);
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const marcar = (clave: string) => {
    const n = [...avisados, clave].slice(-300);
    setAvisados(n);
    try {
      localStorage.setItem(AVISADOS, JSON.stringify(n));
    } catch {
      /* nada */
    }
  };
  const cambios = useMemo(
    () =>
      todosLosPartidos(torneo)
        .filter((p) => p.estado === "PENDIENTE" && !p.bye && p.cambioHorario && p.programacion)
        .sort((a, b) => `${a.programacion!.fecha}${a.programacion!.hora}`.localeCompare(`${b.programacion!.fecha}${b.programacion!.hora}`)),
    [torneo],
  );
  const pendientes = cambios.filter((p) => !avisados.includes(`${p.id}@${p.cambioHorario!.en}`));
  if (!cambios.length) return null;
  return (
    <section className="mt-6" aria-label="Horarios que cambiaron">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/60">
        <CalendarClock className="size-4 text-amber-200" /> Horarios que cambiaron {pendientes.length > 0 && <span className="rounded-full bg-amber-300 px-2 text-xs font-bold text-marino-2">{pendientes.length} por avisar</span>}
      </h3>
      <div className="space-y-2">
        {cambios.map((p) => {
          const clave = `${p.id}@${p.cambioHorario!.en}`;
          const listo = avisados.includes(clave);
          const a = p.cambioHorario!.antes;
          const n = p.programacion!;
          const jugadores = [p.duplaA, p.duplaB].flatMap((d) => dupla(torneo, d)?.jugadorIds ?? []).map((id) => jugador(torneo, id)).filter((j): j is NonNullable<typeof j> => !!j);
          const cat = nombreCorto(categoria(torneo, p.categoriaId)!.categoria);
          const texto = (nombre: string) =>
            `Hola ${nombre}, cambió el horario de tu partido de ${cat} (${p.etiqueta}) en ${torneo.nombre}: ahora es el ${fechaCorta(n.fecha)} a las ${n.hora} en ${pistaCorta(torneo, n.pista)} (antes ${a.hora}). ¡Te esperamos! · La Marina`;
          return (
            <div key={p.id} className={clsx("glass rounded-2xl p-3", listo && "opacity-60")}>
              <button className="w-full text-left" onClick={() => onAbrir(p.id)}>
                <p className="text-sm font-semibold">
                  {p.etiqueta} · {cat}
                </p>
                <p className="text-xs text-white/55">
                  Antes {fechaCorta(a.fecha)} {a.hora} · {pistaCorta(torneo, a.pista)} → <b className="text-white">ahora {fechaCorta(n.fecha)} {n.hora} · {pistaCorta(torneo, n.pista)}</b>
                </p>
              </button>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {jugadores.map((j) => {
                  const tel = telefonoWhatsapp(j.telefono);
                  return tel ? (
                    <a key={j.id} className="chip !text-xs hover:!border-neon/40" href={`https://wa.me/${tel}?text=${encodeURIComponent(texto(j.nombre))}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-3.5 text-neon" /> {j.nombre}
                    </a>
                  ) : (
                    <span key={j.id} className="chip !text-xs text-white/40" title="Sin teléfono cargado">
                      {j.nombre}
                    </span>
                  );
                })}
                {!listo && (
                  <button className="chip ml-auto !text-xs text-neon" onClick={() => marcar(clave)}>
                    <Check className="size-3.5" /> Avisado
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
