/**
 * Capa de persistencia de los endpoints /api/americanos.
 *
 * - MODO DEMO (sin variables de entorno): memoria del servidor, vacía al empezar
 *   (los datos de prueba se cargan desde Ajustes, ver lib/server/demo.ts). En Vercel
 *   cada instancia serverless tiene su propia
 *   memoria, así que es solo para demostraciones; el navegador además guarda
 *   todo en localStorage.
 * - MODO SUPABASE: se activa al definir NEXT_PUBLIC_SUPABASE_URL y
 *   SUPABASE_SERVICE_ROLE_KEY. Juan: implementa aquí el mapeo a las tablas de
 *   PadelReserve (ver docs/BACKEND.md). Por defecto usa una tabla JSONB
 *   `americanos_eventos` vía PostgREST, que funciona sin dependencias extra.
 */
import "server-only";
import { CLUB_POR_DEFECTO } from "@/lib/horarios";
import type { ConfigClub, EventoAmericano } from "@/types/americano";
import type { RankingFvp } from "@/types/ranking";
import type { MarcadorVivo, Torneo } from "@/types/torneo";

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
    memoria.__americanosDemo = new Map();
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
      const filas = await todasLasPaginas((desde) => pedir<{ data: EventoAmericano }[]>(`?select=data&order=actualizado_en.desc,id.asc&limit=${PAGINA}&offset=${desde}`));
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

/**
 * Supabase (PostgREST) devuelve como mucho 1000 filas por consulta: se pide por páginas
 * para que el club pueda tener todos los eventos y torneos que quiera, sin tope.
 */
const PAGINA = 1000;
async function todasLasPaginas<T>(pagina: (desde: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const filas = await pagina(desde);
    out.push(...filas);
    if (filas.length < PAGINA) return out;
  }
}

export function getRepository(): AmericanosRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseRepository(url, key) : demoRepository;
}

/* ---------- TORNEOS ---------- */


export interface TorneosRepository {
  modo: "DEMO" | "SUPABASE";
  listar(): Promise<Torneo[]>;
  obtener(id: string): Promise<Torneo | null>;
  guardar(t: Torneo): Promise<Torneo>;
  listarMarcadores(torneoId?: string | null): Promise<MarcadorVivo[]>;
  obtenerMarcador(id: string): Promise<MarcadorVivo | null>;
  guardarMarcador(m: MarcadorVivo): Promise<MarcadorVivo>;
  /** Datos sueltos de un torneo o americano (registro de árbitros, fotos): tabla `eventos_extras`. */
  /** Lista sin `data` para las fotos (solo id y versión); con `data` para el registro de árbitros. */
  listarExtras(torneoId: string, tipo: string): Promise<ExtraTorneo[]>;
  obtenerExtra(id: string): Promise<ExtraTorneo | null>;
  guardarExtra(x: ExtraTorneo): Promise<ExtraTorneo>;
  borrarExtra(id: string): Promise<void>;
}

export interface ExtraTorneo<T = unknown> {
  id: string;
  /** Torneo o americano al que pertenece. */
  torneoId: string;
  tipo: string;
  data: T;
  actualizadoEn: string;
}

const memoriaT = globalThis as unknown as { __torneosDemo?: Map<string, Torneo>; __marcadoresDemo?: Map<string, MarcadorVivo>; __extrasDemo?: Map<string, ExtraTorneo> };

function torneosDemo(): Map<string, Torneo> {
  if (!memoriaT.__torneosDemo) {
    memoriaT.__torneosDemo = new Map();
  }
  return memoriaT.__torneosDemo;
}
const marcadoresDemo = () =>
  (memoriaT.__marcadoresDemo ??= new Map<string, MarcadorVivo>());

const extrasDemo = () =>
  (memoriaT.__extrasDemo ??= new Map<string, ExtraTorneo>());

const demoTorneos: TorneosRepository = {
  modo: "DEMO",
  async listar() {
    return [...torneosDemo().values()].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
  },
  async obtener(id) {
    return torneosDemo().get(id) ?? null;
  },
  async guardar(t) {
    torneosDemo().set(t.id, t);
    return t;
  },
  async listarMarcadores(torneoId) {
    return [...marcadoresDemo().values()].filter((m) => !torneoId || m.torneoId === torneoId);
  },
  async obtenerMarcador(id) {
    return marcadoresDemo().get(id) ?? null;
  },
  async guardarMarcador(m) {
    marcadoresDemo().set(m.id, m);
    return m;
  },
  async listarExtras(torneoId, tipo) {
    return [...extrasDemo().values()].filter((x) => x.torneoId === torneoId && x.tipo === tipo);
  },
  async obtenerExtra(id) {
    return extrasDemo().get(id) ?? null;
  },
  async guardarExtra(x) {
    extrasDemo().set(x.id, x);
    return x;
  },
  async borrarExtra(id) {
    extrasDemo().delete(id);
  },
};

function supabaseTorneos(url: string, key: string): TorneosRepository {
  const raiz = `${url.replace(/\/$/, "")}/rest/v1/`;
  const tablaT = process.env.SUPABASE_TORNEOS_TABLE ?? "torneos";
  const tablaM = process.env.SUPABASE_MARCADORES_TABLE ?? "torneos_marcadores";
  const tablaX = process.env.SUPABASE_EXTRAS_TABLE ?? "eventos_extras";
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  async function pedir<T>(tabla: string, path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${raiz}${tabla}${path}`, { ...init, headers: { ...headers, ...init?.headers }, cache: "no-store" });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return (res.status === 204 || res.status === 201 ? null : await res.json()) as T;
  }
  const upsert = (tabla: string, fila: object) =>
    pedir(tabla, "", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila) });
  return {
    modo: "SUPABASE",
    async listar() {
      return (await todasLasPaginas((desde) => pedir<{ data: Torneo }[]>(tablaT, `?select=data&order=actualizado_en.desc,id.asc&limit=${PAGINA}&offset=${desde}`))).map((f) => f.data);
    },
    async obtener(id) {
      return (await pedir<{ data: Torneo }[]>(tablaT, `?select=data&id=eq.${encodeURIComponent(id)}`))[0]?.data ?? null;
    },
    async guardar(t) {
      await upsert(tablaT, { id: t.id, club_id: t.clubId, data: t, estado: t.estado, actualizado_en: t.actualizadoEn });
      return t;
    },
    async listarMarcadores(torneoId) {
      const filtro = torneoId ? `&torneo_id=eq.${encodeURIComponent(torneoId)}` : "";
      return (await todasLasPaginas((desde) => pedir<{ data: MarcadorVivo }[]>(tablaM, `?select=data${filtro}&order=id.asc&limit=${PAGINA}&offset=${desde}`))).map((f) => f.data);
    },
    async obtenerMarcador(id) {
      return (await pedir<{ data: MarcadorVivo }[]>(tablaM, `?select=data&id=eq.${encodeURIComponent(id)}`))[0]?.data ?? null;
    },
    async guardarMarcador(m) {
      await upsert(tablaM, { id: m.id, torneo_id: m.torneoId, data: m, actualizado_en: m.actualizadoEn });
      return m;
    },
    async listarExtras(torneoId, tipo) {
      const filas = await pedir<{ id: string; evento_id: string; tipo: string; data: unknown; actualizado_en: string }[]>(
        tablaX,
        `?select=id,evento_id,tipo,actualizado_en${tipo === "arbitros" || tipo === "tenis" ? ",data" : ""}&evento_id=eq.${encodeURIComponent(torneoId)}&tipo=eq.${encodeURIComponent(tipo)}`,
      );
      return filas.map((f) => ({ id: f.id, torneoId: f.evento_id, tipo: f.tipo, data: f.data ?? null, actualizadoEn: f.actualizado_en }));
    },
    async obtenerExtra(id) {
      const f = (await pedir<{ id: string; evento_id: string; tipo: string; data: unknown; actualizado_en: string }[]>(tablaX, `?select=*&id=eq.${encodeURIComponent(id)}`))[0];
      return f ? { id: f.id, torneoId: f.evento_id, tipo: f.tipo, data: f.data, actualizadoEn: f.actualizado_en } : null;
    },
    async guardarExtra(x) {
      await upsert(tablaX, { id: x.id, evento_id: x.torneoId, tipo: x.tipo, data: x.data, actualizado_en: x.actualizadoEn });
      return x;
    },
    async borrarExtra(id) {
      await pedir(tablaX, `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

export function getTorneosRepository(): TorneosRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseTorneos(url, key) : demoTorneos;
}

/* ---------- RANKING FVP ---------- */

export interface RankingRepository {
  modo: "DEMO" | "SUPABASE";
  obtener(): Promise<RankingFvp | null>;
  guardar(r: RankingFvp): Promise<RankingFvp>;
}

const memoriaR = globalThis as unknown as { __rankingFvpDemo?: RankingFvp | null };

const demoRanking: RankingRepository = {
  modo: "DEMO",
  async obtener() {
    return memoriaR.__rankingFvpDemo ?? null;
  },
  async guardar(r) {
    memoriaR.__rankingFvpDemo = r;
    return r;
  },
};

/** Una sola fila JSONB (id = 'fvp') con la lista vigente. */
function supabaseRanking(url: string, key: string): RankingRepository {
  const base = `${url.replace(/\/$/, "")}/rest/v1/${process.env.SUPABASE_RANKING_TABLE ?? "ranking_fvp"}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    modo: "SUPABASE",
    async obtener() {
      const res = await fetch(`${base}?select=data&id=eq.fvp`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      return ((await res.json()) as { data: RankingFvp }[])[0]?.data ?? null;
    },
    async guardar(r) {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: "fvp", data: r, actualizado_en: r.cargadoEn }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      return r;
    },
  };
}

export function getRankingRepository(): RankingRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseRanking(url, key) : demoRanking;
}
