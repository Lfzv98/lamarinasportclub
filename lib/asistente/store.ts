"use client";

/**
 * Estado del chat del asistente IA. Se guarda en sessionStorage: sobrevive a cambiar
 * de pantalla o recargar, y se borra al cerrar la pestaña.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { contextoActual } from "./contexto";
import type { AccionAsistente, MensajeAsistente, RespuestaAsistente } from "./tipos";

export interface MensajeChat extends MensajeAsistente {
  id: string;
  acciones?: AccionAsistente[];
  /** Acciones ya abiertas (por índice), para no repetirlas sin querer. */
  hechas?: number[];
  error?: boolean;
}

interface EstadoAsistente {
  abierto: boolean;
  /** Abrir con el micrófono ya escuchando. */
  escucharAlAbrir: boolean;
  /** Texto que se deja en la caja al abrir (ej. "Inscribir duplas en 5ta Masculino: "). */
  borrador: string;
  mensajes: MensajeChat[];
  pensando: boolean;
  /** null = no se sabe aún; false = falta la clave en el servidor. */
  activo: boolean | null;
  abrir: (o?: { escuchar?: boolean; texto?: string }) => void;
  cerrar: () => void;
  setBorrador: (t: string) => void;
  consultarActivo: () => Promise<void>;
  enviar: (texto: string) => Promise<void>;
  marcarHecha: (mensajeId: string, i: number) => void;
  limpiar: () => void;
}

const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Lo que el modelo recuerda de cada respuesta: el texto y qué dejó preparado. */
function paraHistorial(m: MensajeChat): MensajeAsistente {
  if (m.rol !== "asistente" || !m.acciones?.length) return { rol: m.rol, texto: m.texto };
  const hechas = m.acciones.map((a, i) => `${a.tipo}${m.hechas?.includes(i) ? " (el staff lo abrió)" : " (aún sin abrir)"}`);
  return { rol: m.rol, texto: `${m.texto}\n[Propuse: ${hechas.join(", ")}]` };
}

export const useAsistente = create<EstadoAsistente>()(
  persist(
    (set, get) => ({
      abierto: false,
      escucharAlAbrir: false,
      borrador: "",
      mensajes: [],
      pensando: false,
      activo: null,
      abrir: (o) => set({ abierto: true, escucharAlAbrir: !!o?.escuchar, borrador: o?.texto ?? get().borrador }),
      cerrar: () => set({ abierto: false, escucharAlAbrir: false }),
      setBorrador: (borrador) => set({ borrador }),
      consultarActivo: async () => {
        try {
          const r = await fetch("/api/asistente", { cache: "no-store" });
          const d = (await r.json()) as { activo?: boolean };
          set({ activo: !!d.activo });
        } catch {
          /* sin conexión: se vuelve a preguntar al abrir */
        }
      },
      enviar: async (texto) => {
        const limpio = texto.trim();
        if (!limpio || get().pensando) return;
        const propio: MensajeChat = { id: id(), rol: "staff", texto: limpio };
        const mensajes = [...get().mensajes, propio];
        set({ mensajes, pensando: true, borrador: "" });
        try {
          const r = await fetch("/api/asistente", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensajes: mensajes.filter((m) => !m.error).map(paraHistorial), contexto: contextoActual() }),
          });
          const d = (await r.json().catch(() => ({}))) as Partial<RespuestaAsistente> & { error?: string };
          if (!r.ok) throw new Error(d.error ?? "No pude responder. Revisa la conexión.");
          set({ mensajes: [...get().mensajes, { id: id(), rol: "asistente", texto: d.texto ?? "", acciones: d.acciones ?? [] }] });
        } catch (e) {
          set({ mensajes: [...get().mensajes, { id: id(), rol: "asistente", texto: (e as Error).message || "No pude responder.", error: true }] });
        } finally {
          set({ pensando: false });
        }
      },
      marcarHecha: (mensajeId, i) =>
        set({ mensajes: get().mensajes.map((m) => (m.id === mensajeId ? { ...m, hechas: [...new Set([...(m.hechas ?? []), i])] } : m)) }),
      limpiar: () => set({ mensajes: [], borrador: "" }),
    }),
    {
      name: "lamarina-asistente",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ mensajes: s.mensajes.slice(-40), abierto: s.abierto, borrador: s.borrador }),
    },
  ),
);
