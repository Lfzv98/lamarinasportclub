import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ErrorApi } from "./http";
import { getTorneosRepository } from "./repository";

/**
 * Sesión de staff.
 *
 * Todas las escrituras (POST/PUT/DELETE) exigen una cookie `lm_staff` firmada
 * con HMAC. Se obtiene en POST /api/staff/login con:
 *   - PIN del club (`STAFF_PIN`). En modo DEMO, si no se define, el PIN es 1234.
 *   - Usuario y contraseña de PadelReserve (Supabase Auth del CRM), si está
 *     configurado. Solo entra quien tenga rol staff/admin en app_metadata, cuyo
 *     email esté en `STAFF_EMAILS` o en la lista de correos de Ajustes → Seguridad.
 * Política del club (Ajustes → Seguridad, solo con usuario de PadelReserve): apagar el
 * PIN compartido, la lista de correos y "cerrar sesión en todos los dispositivos"
 * (sube la versión y las sesiones viejas dejan de valer).
 * La lectura (ranking, Modo TV, QR) es pública.
 */

export const COOKIE = "lm_staff";
const DURACION_S = 12 * 3600;
export const PIN_DEMO = "1234";

export interface SesionStaff {
  sub: string;
  nombre: string;
  metodo: "PIN" | "PADELRESERVE";
  /** Correo del usuario de PadelReserve. */
  correo?: string;
  /** Entró solo por estar en la lista de correos de Ajustes (si lo quitan, su sesión cae). */
  porLista?: boolean;
  /** Versión de la política al entrar: "cerrar sesión en todos los dispositivos" la sube. */
  v?: number;
  exp: number;
}

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseActivo = () => !!(supabaseUrl() && supabaseKey());
/** Usuarios de PadelReserve: el Supabase del CRM, que puede ser otro proyecto que el de los datos. */
const authUrl = () => process.env.PADELRESERVE_AUTH_URL || supabaseUrl();
const authKey = () => process.env.PADELRESERVE_AUTH_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey();
export const padelReserveActivo = () => !!(authUrl() && authKey());

export function pinConfigurado(): string | null {
  if (process.env.STAFF_PIN) return process.env.STAFF_PIN;
  return supabaseActivo() ? null : PIN_DEMO;
}

function secreto(): string {
  const s = process.env.STAFF_SECRET;
  if (s && s.length >= 16) return s;
  // Sin secreto propio se deriva uno de lo que exista. Para producción define STAFF_SECRET.
  return `lamarina:${supabaseKey() ?? ""}:${pinConfigurado() ?? ""}:sesion-staff`;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const firmar = (datos: string) => createHmac("sha256", secreto()).update(datos).digest("base64url");

export function crearToken(s: Omit<SesionStaff, "exp">): { token: string; maxAge: number } {
  const payload: SesionStaff = { ...s, exp: Math.floor(Date.now() / 1000) + DURACION_S };
  const datos = b64(JSON.stringify(payload));
  return { token: `${datos}.${firmar(datos)}`, maxAge: DURACION_S };
}

export function leerToken(token?: string | null): SesionStaff | null {
  if (!token) return null;
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return null;
  const esperada = Buffer.from(firmar(datos));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, "base64url").toString()) as SesionStaff;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

function cookieDe(req: Request): string | null {
  const c = req.headers.get("cookie") ?? "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}

/* ---------- política de seguridad del club ---------- */

export interface PoliticaStaff {
  /** PIN compartido apagado: solo se entra con usuario de PadelReserve. */
  pinApagado: boolean;
  /** Correos de PadelReserve con permiso de staff (además de los que tienen rol en el CRM). */
  correos: string[];
  /** Sube con "cerrar sesión en todos los dispositivos". */
  version: number;
  actualizadoEn: string;
  por?: string;
}

const ID_POLITICA = "staff:politica";
const POLITICA_VACIA: PoliticaStaff = { pinApagado: false, correos: [], version: 0, actualizadoEn: "" };
const CACHE_MS = 15_000;
const cachePolitica = globalThis as unknown as { __politicaStaff?: { p: PoliticaStaff; hasta: number } };

export async function leerPolitica(fresca = false): Promise<PoliticaStaff> {
  const c = cachePolitica.__politicaStaff;
  if (!fresca && c && c.hasta > Date.now()) return c.p;
  const x = await getTorneosRepository().obtenerExtra(ID_POLITICA);
  const p = { ...POLITICA_VACIA, ...((x?.data as Partial<PoliticaStaff> | undefined) ?? {}) };
  cachePolitica.__politicaStaff = { p, hasta: Date.now() + CACHE_MS };
  return p;
}

export async function guardarPolitica(p: PoliticaStaff): Promise<PoliticaStaff> {
  await getTorneosRepository().guardarExtra({ id: ID_POLITICA, torneoId: "club", tipo: "staff", data: p, actualizadoEn: p.actualizadoEn });
  cachePolitica.__politicaStaff = { p, hasta: Date.now() + CACHE_MS };
  return p;
}

const normalizarCorreo = (c: string) => c.trim().toLowerCase();
const correosEnv = () => (process.env.STAFF_EMAILS ?? "").split(",").map(normalizarCorreo).filter(Boolean);

/** ¿La sesión sigue valiendo con la política actual? */
function vigente(s: SesionStaff, p: PoliticaStaff): boolean {
  if ((s.v ?? 0) !== p.version) return false;
  if (s.metodo === "PIN") return !p.pinApagado && !!pinConfigurado();
  if (s.porLista) return !!s.correo && (p.correos.includes(s.correo) || correosEnv().includes(s.correo));
  return true;
}

export async function sesionDe(req: Request): Promise<SesionStaff | null> {
  const s = leerToken(cookieDe(req));
  if (!s) return null;
  try {
    return vigente(s, await leerPolitica()) ? s : null;
  } catch {
    // Sin conexión a la base: la firma basta, para no dejar al staff afuera en pleno evento.
    return s;
  }
}

/** Lanza 401 si la petición no viene de staff. */
export async function exigirStaff(req: Request): Promise<SesionStaff> {
  const s = await sesionDe(req);
  if (!s) throw new ErrorApi(401, "Solo el staff de La Marina puede hacer cambios. Ingresa con tu usuario de PadelReserve o el PIN del club.");
  return s;
}

/* ---------- registro de accesos ---------- */

export interface AccesoStaff {
  en: string;
  ok: boolean;
  metodo: "PIN" | "PADELRESERVE";
  nombre?: string;
  correo?: string;
  ip: string;
  dispositivo: string;
  motivo?: string;
}

const ID_ACCESOS = "staff:accesos";
const MAX_ACCESOS = 200;

export async function leerAccesosStaff(): Promise<AccesoStaff[]> {
  const x = await getTorneosRepository().obtenerExtra(ID_ACCESOS);
  return ((x?.data as { lista?: AccesoStaff[] } | undefined)?.lista ?? []).slice(0, MAX_ACCESOS);
}

/** Anota un ingreso (o intento) del staff. Nunca rompe el login si la base falla. */
export async function anotarAcceso(a: AccesoStaff): Promise<void> {
  try {
    const lista = [a, ...(await leerAccesosStaff())].slice(0, MAX_ACCESOS);
    await getTorneosRepository().guardarExtra({ id: ID_ACCESOS, torneoId: "club", tipo: "staff", data: { lista }, actualizadoEn: a.en });
  } catch {
    /* el registro es informativo */
  }
}

/** "iPhone · Safari", "Windows · Chrome"… a partir del navegador. */
export function dispositivoDe(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const so = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro";
  const nav = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navegador";
  return `${so} · ${nav}`;
}

/* ---------- login ---------- */

const intentos = new Map<string, { n: number; desde: number }>();
const MAX_INTENTOS = 5;
const VENTANA_MS = 10 * 60_000;

export function controlarIntentos(ip: string) {
  const ahora = Date.now();
  const i = intentos.get(ip);
  if (i && ahora - i.desde < VENTANA_MS && i.n >= MAX_INTENTOS) throw new ErrorApi(429, "Demasiados intentos. Espera unos minutos.");
  if (!i || ahora - i.desde >= VENTANA_MS) intentos.set(ip, { n: 0, desde: ahora });
}
export const registrarFallo = (ip: string) => {
  const i = intentos.get(ip);
  if (i) i.n++;
};
export const limpiarIntentos = (ip: string) => intentos.delete(ip);

export function verificarPin(pin: string): boolean {
  const ok = pinConfigurado();
  if (!ok) return false;
  const a = Buffer.from(String(pin));
  const b = Buffer.from(ok);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Login con usuario de PadelReserve (Supabase Auth del CRM, grant password). */
export async function verificarPadelReserve(email: string, password: string, politica: PoliticaStaff): Promise<Omit<SesionStaff, "exp"> | null> {
  const url = authUrl();
  const key = authKey();
  if (!url || !key) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (res.status === 400 || res.status === 401) return null;
  if (!res.ok) throw new Error(`Supabase auth ${res.status}`);
  const { user } = (await res.json()) as { user: { id: string; email: string; app_metadata?: { role?: string; roles?: string[] }; user_metadata?: { full_name?: string; nombre?: string } } };
  const roles = [user.app_metadata?.role, ...(user.app_metadata?.roles ?? [])].filter(Boolean) as string[];
  const correo = normalizarCorreo(user.email);
  const porRol = roles.some((r) => ["staff", "admin"].includes(r));
  const enLista = correosEnv().includes(correo) || politica.correos.includes(correo);
  if (!porRol && !enLista) throw new ErrorApi(403, "Tu usuario de PadelReserve no tiene permiso de staff en La Marina. Pide que agreguen tu correo en Ajustes → Seguridad.");
  return { sub: user.id, nombre: user.user_metadata?.full_name ?? user.user_metadata?.nombre ?? user.email, metodo: "PADELRESERVE", correo, porLista: !porRol, v: politica.version };
}

export function ipDe(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/* ---------- participantes de torneos ---------- */

/**
 * Clave de participantes por torneo. La cookie `lm_torneos` guarda, firmada, a qué
 * torneos entró este dispositivo y hasta cuándo (el vencimiento de cada clave).
 */
export const COOKIE_TORNEOS = "lm_torneos";

export type AccesosTorneo = Record<string, number>;

export function leerAccesos(req: Request): AccesosTorneo {
  const c = req.headers.get("cookie") ?? "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(`${COOKIE_TORNEOS}=`));
  const token = m ? decodeURIComponent(m.slice(COOKIE_TORNEOS.length + 1)) : null;
  if (!token) return {};
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return {};
  const esperada = Buffer.from(firmar(`t:${datos}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return {};
  try {
    const todos = JSON.parse(Buffer.from(datos, "base64url").toString()) as AccesosTorneo;
    const ahora = Date.now() / 1000;
    return Object.fromEntries(Object.entries(todos).filter(([, exp]) => exp > ahora));
  } catch {
    return {};
  }
}

export function tokenAccesos(accesos: AccesosTorneo): { token: string; maxAge: number } {
  const datos = b64(JSON.stringify(accesos));
  const max = Math.max(60, ...Object.values(accesos).map((exp) => Math.ceil(exp - Date.now() / 1000)));
  return { token: `${datos}.${firmar(`t:${datos}`)}`, maxAge: max };
}

/** Huella corta de la clave: al cambiarla, los accesos dados con la anterior dejan de valer. */
export function huellaClave(clave: string): string {
  return firmar(`k:${clave.trim().toUpperCase()}`).slice(0, 10);
}

export function claveCorrecta(recibida: string, esperada: string): boolean {
  const a = Buffer.from(recibida.trim().toUpperCase());
  const b = Buffer.from(esperada.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- árbitros (anotadores) ---------- */

/**
 * Sesión de árbitro: rol aparte del staff, del club. Cada árbitro se registra una vez con el PIN
 * de árbitros que el staff crea en Ajustes, su nombre y un código personal; la cookie guarda quién es
 * y huellas del PIN y de su código: si el staff cambia el PIN, lo pausa, o el árbitro cambia su
 * código, la sesión deja de valer.
 */
export const COOKIE_ARBITRO = "lm_arbitro";
const DURACION_ARBITRO_S = 16 * 3600;

export interface SesionArbitro {
  /** Árbitro del plantel del club. */
  arbitroId: string;
  nombre: string;
  /** Huella del PIN de árbitros del club. */
  huella: string;
  /** Huella de su código personal. */
  hc: string;
  exp: number;
}

/** Código personal del árbitro, guardado solo como HMAC ligado al ámbito (el club) y al árbitro. */
export function hashCodigo(ambito: string, arbitroId: string, codigo: string): string {
  return firmar(`r:${ambito}:${arbitroId}:${codigo.trim()}`);
}

export function codigoCorrecto(ambito: string, arbitroId: string, codigo: string, hash: string): boolean {
  const a = Buffer.from(hashCodigo(ambito, arbitroId, codigo));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function crearTokenArbitro(s: Omit<SesionArbitro, "exp">): { token: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + DURACION_ARBITRO_S;
  const datos = b64(JSON.stringify({ ...s, exp }));
  return { token: `${datos}.${firmar(`a:${datos}`)}`, maxAge: Math.max(60, exp - Math.floor(Date.now() / 1000)) };
}

export function arbitroDe(req: Request): SesionArbitro | null {
  const c = req.headers.get("cookie") ?? "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(`${COOKIE_ARBITRO}=`));
  const token = m ? decodeURIComponent(m.slice(COOKIE_ARBITRO.length + 1)) : null;
  if (!token) return null;
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return null;
  const esperada = Buffer.from(firmar(`a:${datos}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, "base64url").toString()) as SesionArbitro;
    return s.arbitroId && s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}
