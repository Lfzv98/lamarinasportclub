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
import { fusionarLlave } from "@/lib/habibi";
import { CLUB_POR_DEFECTO, normalizarClub } from "@/lib/horarios";
import type { ApiListaRespuesta, ConfigClub, EventoAmericano } from "@/types/americano";

type Modo = ApiListaRespuesta["modo"] | "OFFLINE";

export interface Staff {
  nombre: string;
  metodo: "PIN" | "PADELRESERVE";
}

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
  /** Sesión de staff (las escrituras en el servidor la exigen). undefined = aún no se sabe. */
  staff: Staff | null | undefined;
  metodosLogin: { pin: boolean; pinLargo: number; padelreserve: boolean };
  pedirLogin: boolean;
  setPedirLogin: (v: boolean) => void;
  cargarStaff: () => Promise<void>;
  login: (datos: { pin: string } | { email: string; password: string }) => Promise<string | null>;
  logout: () => Promise<void>;
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
  for (const e of remotos) out[e.id] = out[e.id] ? fusionarLlave(fusionarEventos(out[e.id], e)) : e;
  return out;
}

async function enviar(evento: EventoAmericano): Promise<boolean> {
  try {
    const res = await fetch("/api/americanos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento }) });
    if (res.status === 401) {
      // La sesión expiró: el cambio queda pendiente y se sube al volver a ingresar.
      if (useAmericanos.getState().staff) useAmericanos.setState({ staff: null, pedirLogin: true });
      return false;
    }
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
          const { eventos, pendientes, staff } = get();
          // Solo el staff sube cambios; un espectador (QR) solo lee.
          const aSubir = !staff ? [] : Object.values(eventos).filter((e) => {
            const r = remotos.get(e.id);
            return pendientes.includes(e.id) || !r || e.actualizadoEn > r.actualizadoEn;
          });
          await Promise.all(aSubir.map(enviar));

          const rc = await fetch("/api/club", { cache: "no-store" });
          if (rc.ok) {
            const { club } = (await rc.json()) as { club: ConfigClub };
            if (get().clubPendiente && get().staff) get().guardarClub(get().club);
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

      staff: undefined,
      metodosLogin: { pin: true, pinLargo: 4, padelreserve: false },
      pedirLogin: false,
      setPedirLogin: (v) => set({ pedirLogin: v }),

      async cargarStaff() {
        try {
          const r = await fetch("/api/staff/me", { cache: "no-store" });
          const d = (await r.json()) as { staff: Staff | null; metodos: EstadoStore["metodosLogin"] };
          set({ staff: d.staff, metodosLogin: d.metodos });
        } catch {
          // Sin conexión: se mantiene lo último conocido (o espectador).
          if (get().staff === undefined) set({ staff: null });
        }
      },

      async login(datos) {
        try {
          const r = await fetch("/api/staff/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
          const d = (await r.json()) as { staff?: Staff; error?: string };
          if (!r.ok || !d.staff) return d.error ?? "No se pudo ingresar.";
          set({ staff: d.staff, pedirLogin: false });
          get().sincronizar();
          return null;
        } catch {
          return "Sin conexión. Necesitas internet para ingresar.";
        }
      },

      async logout() {
        await fetch("/api/staff/logout", { method: "POST" }).catch(() => undefined);
        set({ staff: null });
      },

      guardarClub(club) {
        const nuevo = { ...club, actualizadoEn: despues(get().club.actualizadoEn) };
        set({ club: nuevo, clubPendiente: true });
        fetch("/api/club", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ club: nuevo }) })
          .then((r) => {
            if (r.ok) set({ clubPendiente: false });
            else if (r.status === 401) set({ staff: null, pedirLogin: true });
          })
          .catch(() => set({ modo: "OFFLINE" }));
      },
    }),
    {
      name: "lamarina-americanos-v1",
      storage: createJSONStorage(() => almacenSeguro),
      partialize: (s) => ({ eventos: s.eventos, club: s.club, pendientes: s.pendientes, clubPendiente: s.clubPendiente, staff: s.staff }),
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

/** Americanos normales (los grupos y la llave de un Americano HABIBI van en su propia sección). */
export function useListaEventos() {
  const eventos = useAmericanos((s) => s.eventos);
  return Object.values(eventos)
    .filter((e) => !e.eliminado && !e.habibi)
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

/** Torneos Americano HABIBI: la llave de cada uno (es la ficha del torneo). */
export function useListaHabibi() {
  const eventos = useAmericanos((s) => s.eventos);
  return Object.values(eventos)
    .filter((e) => !e.eliminado && e.habibi?.rol === "LLAVE")
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export function usePendientes() {
  return useAmericanos((s) => s.pendientes.length);
}

/** true = staff, false = espectador, undefined = verificando. */
export function useEsStaff(): boolean | undefined {
  return useAmericanos((s) => (s.staff === undefined ? undefined : !!s.staff));
}
