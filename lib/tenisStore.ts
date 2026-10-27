"use client";

/**
 * Estado del cliente para Tenis: mismo esquema que Torneos (lib/torneosStore.ts), más simple.
 * localStorage + /api/tenis; BroadcastChannel para que la TV del mismo equipo vaya al instante;
 * sin internet los cambios quedan pendientes y se suben solos.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useArbitroStore } from "@/lib/arbitro";
import { useAmericanos } from "@/lib/store";
import { fusionarTenis } from "@/lib/tenis/torneo";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";
import type { ApiTenisRespuesta, PartidoTenis, TorneoTenis } from "@/types/tenis";

interface EstadoTenis {
  torneos: Record<string, TorneoTenis>;
  pendientes: string[];
  hidratado: boolean;
  offline: boolean;
  sincronizar: () => Promise<void>;
  guardar: (t: TorneoTenis) => void;
  actualizar: (id: string, fn: (t: TorneoTenis) => TorneoTenis) => void;
}

const canal = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("lamarina-tenis") : null;

const almacen = {
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
      /* sin espacio: sigue en memoria */
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

function unir(local: Record<string, TorneoTenis>, remotos: TorneoTenis[]) {
  const out = { ...local };
  for (const t of remotos) out[t.id] = out[t.id] ? fusionarTenis(out[t.id], t) : t;
  return out;
}

const puedeSubir = () => !!useAmericanos.getState().staff || !!useArbitroStore.getState().arbitro;

async function enviar(t: TorneoTenis) {
  try {
    const res = await fetch("/api/tenis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ torneo: t }) });
    if (res.status === 401) {
      if (useAmericanos.getState().staff) useAmericanos.setState({ staff: null, pedirLogin: true });
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { torneo?: TorneoTenis };
    useTenis.setState((s) => ({
      torneos: data.torneo ? unir(s.torneos, [data.torneo]) : s.torneos,
      pendientes: s.pendientes.filter((id) => id !== t.id || s.torneos[id]?.actualizadoEn !== t.actualizadoEn),
      offline: false,
    }));
  } catch {
    useTenis.setState({ offline: true });
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useTenis = create<EstadoTenis>()(
  persist(
    (set, get) => ({
      torneos: {},
      pendientes: [],
      hidratado: false,
      offline: false,

      async sincronizar() {
        try {
          const r = await fetch("/api/tenis", { cache: "no-store" });
          if (!r.ok) throw new Error(String(r.status));
          const data = (await r.json()) as ApiTenisRespuesta;
          set((s) => ({ torneos: unir(s.torneos, data.torneos), offline: false }));
          if (!puedeSubir()) return;
          const remotos = new Map(data.torneos.map((t) => [t.id, t]));
          const { torneos, pendientes } = get();
          await Promise.all(
            Object.values(torneos)
              .filter((t) => pendientes.includes(t.id) || (useAmericanos.getState().staff && (!remotos.has(t.id) || t.actualizadoEn > remotos.get(t.id)!.actualizadoEn)))
              .map(enviar),
          );
        } catch {
          set({ offline: true });
        }
      },

      guardar(t) {
        set((s) => ({ torneos: { ...s.torneos, [t.id]: t }, pendientes: s.pendientes.includes(t.id) ? s.pendientes : [...s.pendientes, t.id] }));
        canal?.postMessage(t);
        clearTimeout(timers.get(t.id));
        // Rápido: la TV de la cancha va casi al ritmo del partido.
        timers.set(
          t.id,
          setTimeout(() => {
            timers.delete(t.id);
            const actual = get().torneos[t.id];
            if (actual) enviar(actual);
          }, 300),
        );
      },

      actualizar(id, fn) {
        const actual = get().torneos[id];
        if (actual) get().guardar(fn(actual));
      },
    }),
    {
      name: "lamarina-tenis-v1",
      storage: createJSONStorage(() => almacen),
      partialize: (s) => ({ torneos: s.torneos, pendientes: s.pendientes }),
      skipHydration: true,
    },
  ),
);

canal?.addEventListener("message", (ev: MessageEvent) => {
  const t = ev.data as TorneoTenis;
  useTenis.setState((s) => ({ torneos: unir(s.torneos, [t]) }));
});

if (typeof window !== "undefined" && TENIS_ACTIVO) window.addEventListener("online", () => useTenis.getState().sincronizar());

export function useTorneoTenis(id: string) {
  return useTenis((s) => (s.torneos[id]?.eliminado ? undefined : s.torneos[id]));
}

export function useListaTenis() {
  const torneos = useTenis((s) => s.torneos);
  return Object.values(torneos)
    .filter((t) => !t.eliminado)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export function usePartidoTenis(tid: string, pid: string): { torneo?: TorneoTenis; partido?: PartidoTenis } {
  const torneo = useTorneoTenis(tid);
  return { torneo, partido: torneo?.partidos.find((p) => p.id === pid) };
}

/** Pantallas en vivo (partido y TV): consulta el servidor cada pocos segundos. */
export function useTenisEnVivo(ms = 3000) {
  useEffect(() => {
    const i = setInterval(() => {
      if (document.visibilityState === "visible") useTenis.getState().sincronizar();
    }, ms);
    return () => clearInterval(i);
  }, [ms]);
}
