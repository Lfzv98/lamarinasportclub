"use client";

/**
 * Sesión de árbitro (anotador) en este dispositivo: rol aparte del staff, por torneo.
 * La cookie la pone el servidor (POST /api/arbitro); aquí solo se refleja quién es.
 */
import { create } from "zustand";

export interface Arbitro {
  torneoId: string;
  nombre: string;
}

interface EstadoArbitro {
  /** undefined = todavía no se sabe. */
  arbitro: Arbitro | null | undefined;
  cargar: () => Promise<void>;
  entrar: (torneoId: string, pin: string, nombre: string) => Promise<string | null>;
  salir: () => Promise<void>;
}

export const useArbitroStore = create<EstadoArbitro>()((set) => ({
  arbitro: undefined,
  async cargar() {
    try {
      const r = await fetch("/api/arbitro", { cache: "no-store" });
      const d = (await r.json()) as { arbitro: Arbitro | null };
      set({ arbitro: d.arbitro });
    } catch {
      set((s) => ({ arbitro: s.arbitro ?? null }));
    }
  },
  async entrar(torneoId, pin, nombre) {
    try {
      const r = await fetch("/api/arbitro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ torneoId, pin, nombre }) });
      const d = (await r.json()) as { arbitro?: Arbitro; error?: string };
      if (!r.ok || !d.arbitro) return d.error ?? "No se pudo entrar.";
      set({ arbitro: d.arbitro });
      return null;
    } catch {
      return "Sin conexión. Necesitas internet para entrar como árbitro.";
    }
  },
  async salir() {
    try {
      await fetch("/api/arbitro", { method: "DELETE" });
    } finally {
      set({ arbitro: null });
    }
  },
}));

let pedido = false;
/** Árbitro de este dispositivo (lo consulta una vez por carga). */
export function useArbitro(): Arbitro | null | undefined {
  const arbitro = useArbitroStore((s) => s.arbitro);
  if (typeof window !== "undefined" && !pedido) {
    pedido = true;
    queueMicrotask(() => useArbitroStore.getState().cargar());
  }
  return arbitro;
}

/** ¿Es árbitro de este torneo? */
export const esArbitroDe = (a: Arbitro | null | undefined, torneoId: string) => !!a && a.torneoId === torneoId;
