/**
 * Capa de persistencia de los endpoints /api/americanos.
 *
 * - MODO DEMO (sin variables de entorno): memoria del servidor, sembrada con
 *   data/mockData.json. En Vercel cada instancia serverless tiene su propia
 *   memoria, así que es solo para demostraciones; el navegador además guarda
 *   todo en localStorage.
 * - MODO SUPABASE: se activa al definir NEXT_PUBLIC_SUPABASE_URL y
 *   SUPABASE_SERVICE_ROLE_KEY. Juan: implementa aquí el mapeo a las tablas de
 *   PadelReserve (ver docs/BACKEND.md). Por defecto usa una tabla JSONB
 *   `americanos_eventos` vía PostgREST, que funciona sin dependencias extra.
 */
import "server-only";
import mock from "@/data/mockData.json";
import { CLUB_POR_DEFECTO } from "@/lib/horarios";
import type { ConfigClub, EventoAmericano } from "@/types/americano";

export interface AmericanosRepository {
  modo: "DEMO" | "SUPABASE";
  listar(): Promise<EventoAmericano[]>;
  obtener(id: string): Promise<EventoAmericano | null>;
  guardar(evento: EventoAmericano): Promise<EventoAmericano>;
  eliminar(id: string): Promise<boolean>;
  obtenerClub(): Promise<ConfigClub>;
  guardarClub(club: ConfigClub): Promise<ConfigClub>;
}

const ordenar = (lista: EventoAmericano[]) => [...lista].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));

/* ---------- DEMO ---------- */

const memoria = globalThis as unknown as { __americanosDemo?: Map<string, EventoAmericano>; __clubDemo?: ConfigClub };

function almacenDemo(): Map<string, EventoAmericano> {
  if (!memoria.__americanosDemo) {
    memoria.__americanosDemo = new Map((mock.eventos as unknown as EventoAmericano[]).map((e) => [e.id, structuredClone(e)]));
  }
  return memoria.__americanosDemo;
}

const demoRepository: AmericanosRepository = {
  modo: "DEMO",
  async listar() {
    return ordenar([...almacenDemo().values()]);
  },
  async obtener(id) {
    return almacenDemo().get(id) ?? null;
  },
  async guardar(evento) {
    almacenDemo().set(evento.id, evento);
    return evento;
  },
  async eliminar(id) {
    return almacenDemo().delete(id);
  },
  async obtenerClub() {
    return memoria.__clubDemo ?? CLUB_POR_DEFECTO;
  },
  async guardarClub(club) {
    memoria.__clubDemo = club;
    return club;
  },
};

/* ---------- SUPABASE (PostgREST) ---------- */

function supabaseRepository(url: string, key: string): AmericanosRepository {
  const tabla = process.env.SUPABASE_AMERICANOS_TABLE ?? "americanos_eventos";
  const base = `${url.replace(/\/$/, "")}/rest/v1/${tabla}`;
  const baseClub = `${url.replace(/\/$/, "")}/rest/v1/${process.env.SUPABASE_CLUB_TABLE ?? "club_config"}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function pedir<T>(path: string, init?: RequestInit, url = base): Promise<T> {
    const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init?.headers }, cache: "no-store" });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return (res.status === 204 ? null : await res.json()) as T;
  }

  return {
    modo: "SUPABASE",
    async listar() {
      const filas = await pedir<{ data: EventoAmericano }[]>("?select=data&order=actualizado_en.desc");
      return filas.map((f) => f.data);
    },
    async obtener(id) {
      const filas = await pedir<{ data: EventoAmericano }[]>(`?select=data&id=eq.${encodeURIComponent(id)}`);
      return filas[0]?.data ?? null;
    },
    async guardar(evento) {
      await pedir("", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: evento.id, data: evento, estado: evento.estado, actualizado_en: evento.actualizadoEn }),
      });
      return evento;
    },
    async eliminar(id) {
      await pedir(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    },
    async obtenerClub() {
      const filas = await pedir<{ data: ConfigClub }[]>("?select=data&id=eq.la-marina", undefined, baseClub);
      return filas[0]?.data ?? CLUB_POR_DEFECTO;
    },
    async guardarClub(club) {
      await pedir(
        "",
        { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "la-marina", data: club }) },
        baseClub,
      );
      return club;
    },
  };
}

export function getRepository(): AmericanosRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseRepository(url, key) : demoRepository;
}

/** Validación mínima del payload antes de persistir. */
export function esEventoValido(e: unknown): e is EventoAmericano {
  if (!e || typeof e !== "object") return false;
  const x = e as Partial<EventoAmericano>;
  return (
    typeof x.id === "string" &&
    typeof x.nombre === "string" &&
    !!x.categoria &&
    (x.modalidad === "INDIVIDUAL_ROTATIVO" || x.modalidad === "DUPLA_FIJA") &&
    !!x.puntuacion &&
    typeof x.pistas === "number" &&
    x.pistas >= 1 &&
    x.pistas <= 6 &&
    Array.isArray(x.jugadores) &&
    Array.isArray(x.rondas)
  );
}
