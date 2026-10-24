"use client";

/**
 * Sesión de árbitro (anotador) en este dispositivo: rol aparte del staff, por torneo.
 * La cookie la pone el servidor (POST /api/arbitro); aquí solo se refleja quién es.
 */
import { create } from "zustand";

export interface Arbitro {
  torneoId: string;
  /** Árbitro registrado. */
  id: string;
  nombre: string;
}

/** Lo que muestra la pantalla de entrada: nombre e inicial del apellido. */
export interface ArbitroLista {
  id: string;
  nombre: string;
  apellido: string;
}

export interface DatosRegistro {
  torneoId: string;
  pin: string;
  nombre: string;
  apellido: string;
  telefono: string;
  codigo: string;
}

interface EstadoArbitro {
  /** undefined = todavía no se sabe. */
  arbitro: Arbitro | null | undefined;
  cargar: () => Promise<void>;
  entrar: (torneoId: string, arbitroId: string, codigo: string) => Promise<string | null>;
  registrar: (d: DatosRegistro) => Promise<string | null>;
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
  async entrar(torneoId, arbitroId, codigo) {
    return enviar(set, "/api/arbitro", { torneoId, arbitroId, codigo });
  },
  async registrar(datos) {
    return enviar(set, "/api/arbitro/registro", datos);
  },
  async salir() {
    try {
      await fetch("/api/arbitro", { method: "DELETE" });
    } finally {
      set({ arbitro: null });
    }
  },
}));

async function enviar(set: (p: Partial<EstadoArbitro>) => void, url: string, body: object): Promise<string | null> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json()) as { arbitro?: Arbitro; error?: string };
    if (!r.ok || !d.arbitro) return d.error ?? "No se pudo entrar.";
    set({ arbitro: d.arbitro });
    return null;
  } catch {
    return "Sin conexión. Necesitas internet para entrar como árbitro.";
  }
}

/** Árbitros registrados en un torneo (para elegir "¿quién eres?"). */
export async function listarArbitros(torneoId: string): Promise<ArbitroLista[]> {
  try {
    const r = await fetch(`/api/arbitros?torneoId=${encodeURIComponent(torneoId)}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as { arbitros: ArbitroLista[] }).arbitros : [];
  } catch {
    return [];
  }
}

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
