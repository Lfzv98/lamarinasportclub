"use client";

/**
 * Fotos tomadas al inscribir jugadores o duplas en el armado del americano, antes de que el
 * evento exista en el servidor. Quedan en memoria (pesan demasiado para el borrador en
 * localStorage) y se suben solas apenas el evento se crea.
 */
import { create } from "zustand";
import { toast } from "@/components/ui/Toaster";
import { despues } from "@/lib/evento";
import { useAmericanos } from "@/lib/store";
import type { EventoAmericano } from "@/types/americano";

interface EstadoFotosRegistro {
  /** id del jugador o de la dupla → foto (data URL JPEG). */
  fotos: Record<string, string>;
  poner: (id: string, img: string | null) => void;
  limpiar: () => void;
}

export const useFotosRegistro = create<EstadoFotosRegistro>()((set) => ({
  fotos: {},
  poner: (id, img) =>
    set((s) => {
      const fotos = { ...s.fotos };
      if (img) fotos[id] = img;
      else delete fotos[id];
      return { fotos };
    }),
  limpiar: () => set({ fotos: {} }),
}));

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sube las fotos del registro al evento recién creado y les pone la URL a sus jugadores o duplas. */
export async function subirFotosDelRegistro(evento: EventoAmericano, fotos: Record<string, string>) {
  const duplas = new Set(evento.parejas.map((p) => p.id));
  const jugadores = new Set(evento.jugadores.map((j) => j.id));
  let pendientes = Object.entries(fotos).filter(([id]) => duplas.has(id) || jugadores.has(id));
  if (!pendientes.length) return;

  // El evento tarda un momento en llegar al servidor: si todavía no está (404), se reintenta.
  for (let intento = 0; intento < 8 && pendientes.length; intento++) {
    if (intento) await espera(Math.min(15_000, 1500 * 2 ** (intento - 1)));
    const quedan: typeof pendientes = [];
    for (const [id, img] of pendientes) {
      const tipo = duplas.has(id) ? "dupla" : "jugador";
      try {
        const r = await fetch("/api/fotos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventoId: evento.id, tipo, id, img }) });
        if (r.ok) {
          const { url } = (await r.json()) as { url: string };
          useAmericanos.getState().actualizar(evento.id, (e) => ({
            ...(tipo === "dupla"
              ? { ...e, parejas: e.parejas.map((p) => (p.id === id ? { ...p, fotoUrl: url } : p)) }
              : { ...e, jugadores: e.jugadores.map((j) => (j.id === id ? { ...j, fotoUrl: url } : j)) }),
            actualizadoEn: despues(e.actualizadoEn),
          }));
        } else if (r.status === 404 || r.status >= 500) quedan.push([id, img]);
      } catch {
        quedan.push([id, img]);
      }
    }
    pendientes = quedan;
  }
  if (pendientes.length)
    toast(`${pendientes.length === 1 ? "Una foto no se pudo subir" : `${pendientes.length} fotos no se pudieron subir`}. Tómalas de nuevo en "Jugadores y fotos".`, "error");
}
