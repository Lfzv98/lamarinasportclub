import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ErrorApi } from "./http";

/**
 * Sesión de staff.
 *
 * Todas las escrituras (POST/PUT/DELETE) exigen una cookie `lm_staff` firmada
 * con HMAC. Se obtiene en POST /api/staff/login con:
 *   - PIN del club (`STAFF_PIN`). En modo DEMO, si no se define, el PIN es 1234.
 *   - Usuario y contraseña de PadelReserve (Supabase Auth), si Supabase está
 *     configurado. Solo entra quien tenga rol staff/admin en app_metadata o cuyo
 *     email esté en `STAFF_EMAILS`.
 * La lectura (ranking, Modo TV, QR) es pública.
 */

export const COOKIE = "lm_staff";
const DURACION_S = 12 * 3600;
export const PIN_DEMO = "1234";

export interface SesionStaff {
  sub: string;
  nombre: string;
  metodo: "PIN" | "PADELRESERVE";
  exp: number;
}

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseActivo = () => !!(supabaseUrl() && supabaseKey());

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

export function sesionDe(req: Request): SesionStaff | null {
  return leerToken(cookieDe(req));
}

/** Lanza 401 si la petición no viene de staff. */
export function exigirStaff(req: Request): SesionStaff {
  const s = sesionDe(req);
  if (!s) throw new ErrorApi(401, "Solo el staff de La Marina puede hacer cambios. Ingresa con tu PIN o usuario de PadelReserve.");
  return s;
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

/** Login con usuario de PadelReserve (Supabase Auth, grant password). */
export async function verificarPadelReserve(email: string, password: string): Promise<Omit<SesionStaff, "exp"> | null> {
  const url = supabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? supabaseKey();
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
  const lista = (process.env.STAFF_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const esStaff = roles.some((r) => ["staff", "admin"].includes(r)) || lista.includes(user.email.toLowerCase());
  if (!esStaff) throw new ErrorApi(403, "Tu usuario no tiene permisos de staff en La Marina.");
  return { sub: user.id, nombre: user.user_metadata?.full_name ?? user.user_metadata?.nombre ?? user.email, metodo: "PADELRESERVE" };
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
 * Sesión de árbitro: rol aparte del staff, por torneo. Entra con el PIN de árbitros que el staff
 * crea en Ajustes → Claves de torneos. La cookie guarda el torneo, el nombre del árbitro y una
 * huella del PIN: si el staff lo cambia o lo quita, la sesión deja de valer.
 */
export const COOKIE_ARBITRO = "lm_arbitro";
const DURACION_ARBITRO_S = 16 * 3600;

export interface SesionArbitro {
  torneoId: string;
  nombre: string;
  huella: string;
  exp: number;
}

export function crearTokenArbitro(s: Omit<SesionArbitro, "exp">, venceMs: number): { token: string; maxAge: number } {
  const exp = Math.min(Math.floor(Date.now() / 1000) + DURACION_ARBITRO_S, Math.floor(venceMs / 1000));
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
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}
