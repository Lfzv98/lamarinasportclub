"use client";

/**
 * Estado del cliente. Fuente de verdad local (localStorage) + sincronización
 * con /api/americanos. Las pestañas del mismo navegador (ej. Modo TV en el
 * proyector) se actualizan al instante por BroadcastChannel; otros
 * dispositivos lo hacen por polling a la API.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CLUB_POR_DEFECTO, normalizarClub } from "@/lib/horarios";
import type { ApiListaRespuesta, ConfigClub, EventoAmericano } from "@/types/americano";

type Modo = ApiListaRespuesta["modo"] | "OFFLINE";

interface EstadoStore {
  eventos: Record<string, EventoAmericano>;
  club: ConfigClub;
  modo: Modo | null;
  hidratado: boolean;
  sincronizando: boolean;
  ultimoSync: string | null;
  sincronizar: () => Promise<void>;
  guardar: (evento: EventoAmericano) => void;
  actualizar: (id: string, fn: (e: EventoAmericano) => EventoAmericano) => void;
  eliminar: (id: string) => void;
  guardarClub: (club: ConfigClub) => void;
}

const canal = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("lamarina-americanos") : null;

const pendientes = new Map<string, ReturnType<typeof setTimeout>>();
function subir(evento: EventoAmericano) {
  clearTimeout(pendientes.get(evento.id));
  pendientes.set(
    evento.id,
    setTimeout(() => {
      pendientes.delete(evento.id);
      fetch("/api/americanos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento }) }).catch(
        () => useAmericanos.setState({ modo: "OFFLINE" }),
      );
    }, 400),
  );
}

/** Une dos colecciones quedándose con la versión más reciente de cada evento. */
function unir(local: Record<string, EventoAmericano>, remotos: EventoAmericano[]) {
  const out = { ...local };
  for (const e of remotos) {
    const actual = out[e.id];
    if (!actual || e.actualizadoEn > actual.actualizadoEn) out[e.id] = e;
  }
  return out;
}

export const useAmericanos = create<EstadoStore>()(
  persist(
    (set, get) => ({
      eventos: {},
      club: CLUB_POR_DEFECTO,
      modo: null,
      hidratado: false,
      sincronizando: false,
      ultimoSync: null,

      async sincronizar() {
        if (get().sincronizando) return;
        set({ sincronizando: true });
        try {
          const res = await fetch("/api/americanos", { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as ApiListaRespuesta;
          set((s) => ({ eventos: unir(s.eventos, data.eventos), modo: data.modo, ultimoSync: new Date().toISOString() }));
          const rc = await fetch("/api/club", { cache: "no-store" });
          if (rc.ok) {
            const { club } = (await rc.json()) as { club: ConfigClub };
            if (club.actualizadoEn > get().club.actualizadoEn) set({ club: normalizarClub(club) });
          }
        } catch {
          set({ modo: "OFFLINE" });
        } finally {
          set({ sincronizando: false });
        }
      },

      guardar(evento) {
        set((s) => ({ eventos: { ...s.eventos, [evento.id]: evento } }));
        canal?.postMessage({ tipo: "evento", evento });
        subir(evento);
      },

      actualizar(id, fn) {
        const actual = get().eventos[id];
        if (actual) get().guardar(fn(actual));
      },

      eliminar(id) {
        set((s) => {
          const { [id]: _, ...resto } = s.eventos;
          return { eventos: resto };
        });
        canal?.postMessage({ tipo: "eliminar", id });
        fetch(`/api/americanos/${id}`, { method: "DELETE" }).catch(() => undefined);
      },

      guardarClub(club) {
        const nuevo = { ...club, actualizadoEn: new Date().toISOString() };
        set({ club: nuevo });
        fetch("/api/club", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ club: nuevo }) }).catch(() => undefined);
      },
    }),
    {
      name: "lamarina-americanos-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ eventos: s.eventos, club: s.club }),
      skipHydration: true,
      merge: (guardado, actual) => {
        const g = guardado as Partial<EstadoStore> | undefined;
        return { ...actual, ...g, club: normalizarClub(g?.club) };
      },
    },
  ),
);

canal?.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data as { tipo: "evento"; evento: EventoAmericano } | { tipo: "eliminar"; id: string };
  if (msg.tipo === "evento") useAmericanos.setState((s) => ({ eventos: unir(s.eventos, [msg.evento]) }));
  else
    useAmericanos.setState((s) => {
      const { [msg.id]: _, ...resto } = s.eventos;
      return { eventos: resto };
    });
});

export function useEvento(id: string) {
  return useAmericanos((s) => s.eventos[id]);
}

export function useListaEventos() {
  const eventos = useAmericanos((s) => s.eventos);
  return Object.values(eventos).sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}
