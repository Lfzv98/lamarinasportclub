"use client";

/**
 * Estado del cliente. Fuente de verdad local (localStorage) + sincronización
 * con /api/americanos. Las pestañas del mismo navegador (ej. Modo TV en el
 * proyector) se actualizan al instante por BroadcastChannel; otros
 * dispositivos lo hacen por polling a la API.
 *
 * A prueba de fallos:
 * - Sin internet: los cambios quedan en `pendientes` (persistido) y se suben
 *   solos al volver la conexión o en el siguiente sync.
 * - Dos dispositivos a la vez: `fusionarEventos` conserva el marcador más
 *   reciente de cada partido, así nadie pisa la pista que cargó otro.
 * - Borrar un evento es lógico (`eliminado`), para que otro dispositivo con
 *   una copia vieja no lo "resucite".
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { despues, fusionarEventos } from "@/lib/evento";
import { CLUB_POR_DEFECTO, normalizarClub } from "@/lib/horarios";
import type { ApiListaRespuesta, ConfigClub, EventoAmericano } from "@/types/americano";

type Modo = ApiListaRespuesta["modo"] | "OFFLINE";

interface EstadoStore {
  eventos: Record<string, EventoAmericano>;
  club: ConfigClub;
  /** ids de eventos con cambios aún no confirmados por el servidor. */
  pendientes: string[];
  clubPendiente: boolean;
  modo: Modo | null;
  hidratado: boolean;
  sincronizando: boolean;
  ultimoSync: string | null;
  sincronizar: () => Promise<void>;
  guardar: (evento: EventoAmericano) => void;
  actualizar: (id: string, fn: (e: EventoAmericano) => EventoAmericano) => void;
  guardarClub: (club: ConfigClub) => void;
}

const canal = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("lamarina-americanos") : null;

/** localStorage que nunca rompe la app: modo privado, cuota llena o JSON corrupto. */
const almacenSeguro = {
  getItem(k: string) {
    try {
      const v = localStorage.getItem(k);
      if (v) JSON.parse(v);
      return v;
    } catch {
      return null;
    }
  },
  setItem(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Cuota llena: se descartan eventos eliminados y finalizados antiguos y se reintenta.
      try {
        const s = JSON.parse(v) as { state: { eventos: Record<string, EventoAmericano> } };
        const lista = Object.values(s.state.eventos).filter((e) => !e.eliminado).sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
        s.state.eventos = Object.fromEntries(lista.slice(0, 20).map((e) => [e.id, e]));
        localStorage.setItem(k, JSON.stringify(s));
      } catch {
        /* sin almacenamiento: la app sigue funcionando en memoria y contra la API */
      }
    }
  },
  removeItem(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada */
    }
  },
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Une colecciones: para cada evento fusiona la versión local con la remota. */
function unir(local: Record<string, EventoAmericano>, remotos: EventoAmericano[]) {
  const out = { ...local };
  for (const e of remotos) out[e.id] = out[e.id] ? fusionarEventos(out[e.id], e) : e;
  return out;
}

async function enviar(evento: EventoAmericano): Promise<boolean> {
  try {
    const res = await fetch("/api/americanos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento }) });
    if (!res.ok) return false;
    const data = (await res.json()) as { evento?: EventoAmericano };
    useAmericanos.setState((s) => ({
      eventos: data.evento ? unir(s.eventos, [data.evento]) : s.eventos,
      // Solo se limpia si no hubo cambios nuevos mientras se enviaba.
      pendientes: s.pendientes.filter((id) => id !== evento.id || s.eventos[id]?.actualizadoEn !== evento.actualizadoEn),
      modo: s.modo === "OFFLINE" ? null : s.modo,
    }));
    return true;
  } catch {
    useAmericanos.setState({ modo: "OFFLINE" });
    return false;
  }
}

function subir(evento: EventoAmericano) {
  clearTimeout(timers.get(evento.id));
  timers.set(
    evento.id,
    setTimeout(() => {
      timers.delete(evento.id);
      const actual = useAmericanos.getState().eventos[evento.id];
      if (actual) enviar(actual);
    }, 400),
  );
}

export const useAmericanos = create<EstadoStore>()(
  persist(
    (set, get) => ({
      eventos: {},
      club: CLUB_POR_DEFECTO,
      pendientes: [],
      clubPendiente: false,
      modo: null,
      hidratado: false,
      sincronizando: false,
      ultimoSync: null,

      async sincronizar() {
        if (get().sincronizando) return;
        set({ sincronizando: true });
        try {
          const res = await fetch("/api/americanos?todos=1", { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as ApiListaRespuesta;
          set((s) => ({ eventos: unir(s.eventos, data.eventos), modo: data.modo, ultimoSync: new Date().toISOString() }));

          // Sube lo que quedó pendiente (sin internet) y lo que el servidor no tiene
          // (ej. el servidor demo se reinició).
          const remotos = new Map(data.eventos.map((e) => [e.id, e]));
          const { eventos, pendientes } = get();
          const aSubir = Object.values(eventos).filter((e) => {
            const r = remotos.get(e.id);
            return pendientes.includes(e.id) || !r || e.actualizadoEn > r.actualizadoEn;
          });
          await Promise.all(aSubir.map(enviar));

          const rc = await fetch("/api/club", { cache: "no-store" });
          if (rc.ok) {
            const { club } = (await rc.json()) as { club: ConfigClub };
            if (get().clubPendiente) get().guardarClub(get().club);
            else if (club.actualizadoEn > get().club.actualizadoEn) set({ club: normalizarClub(club) });
          }
        } catch {
          set({ modo: "OFFLINE" });
        } finally {
          set({ sincronizando: false });
        }
      },

      guardar(evento) {
        set((s) => ({
          eventos: { ...s.eventos, [evento.id]: evento },
          pendientes: s.pendientes.includes(evento.id) ? s.pendientes : [...s.pendientes, evento.id],
        }));
        canal?.postMessage({ tipo: "evento", evento });
        subir(evento);
      },

      actualizar(id, fn) {
        const actual = get().eventos[id];
        if (actual) get().guardar(fn(actual));
      },

      guardarClub(club) {
        const nuevo = { ...club, actualizadoEn: despues(get().club.actualizadoEn) };
        set({ club: nuevo, clubPendiente: true });
        fetch("/api/club", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ club: nuevo }) })
          .then((r) => r.ok && set({ clubPendiente: false }))
          .catch(() => set({ modo: "OFFLINE" }));
      },
    }),
    {
      name: "lamarina-americanos-v1",
      storage: createJSONStorage(() => almacenSeguro),
      partialize: (s) => ({ eventos: s.eventos, club: s.club, pendientes: s.pendientes, clubPendiente: s.clubPendiente }),
      skipHydration: true,
      merge: (guardado, actual) => {
        const g = guardado as Partial<EstadoStore> | undefined;
        return { ...actual, ...g, club: normalizarClub(g?.club), pendientes: g?.pendientes ?? [] };
      },
    },
  ),
);

canal?.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data as { tipo: "evento"; evento: EventoAmericano };
  if (msg.tipo === "evento") useAmericanos.setState((s) => ({ eventos: unir(s.eventos, [msg.evento]) }));
});

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useAmericanos.getState().sincronizar());
}

export function useEvento(id: string) {
  return useAmericanos((s) => (s.eventos[id]?.eliminado ? undefined : s.eventos[id]));
}

export function useListaEventos() {
  const eventos = useAmericanos((s) => s.eventos);
  return Object.values(eventos)
    .filter((e) => !e.eliminado)
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export function usePendientes() {
  return useAmericanos((s) => s.pendientes.length);
}
