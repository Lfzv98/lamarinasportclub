/**
 * Ranking de jugadores de tenis por superficie: suma todos los partidos terminados de todos los torneos.
 * Un jugador se reconoce por su nombre (sin acentos ni mayúsculas), así se juntan torneos distintos.
 */
import type { Superficie, TorneoTenis } from "@/types/tenis";
import { campeon, inscrito } from "./torneo.ts";

export interface RegistroSuperficie {
  pj: number;
  pg: number;
}

export interface FichaJugador {
  clave: string;
  nombre: string;
  fotoUrl?: string | null;
  total: RegistroSuperficie;
  por: Record<Superficie, RegistroSuperficie>;
  titulos: number;
  /** Racha actual de victorias (de la más reciente hacia atrás). */
  racha: number;
}

export const claveNombre = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const pct = (r: RegistroSuperficie) => (r.pj ? r.pg / r.pj : 0);

export function fichasJugadores(torneos: TorneoTenis[]): FichaJugador[] {
  const fichas = new Map<string, FichaJugador & { historial: { en: string; gano: boolean }[] }>();
  const ficha = (nombre: string, fotoUrl?: string | null) => {
    const clave = claveNombre(nombre);
    let f = fichas.get(clave);
    if (!f) {
      f = { clave, nombre, fotoUrl, total: { pj: 0, pg: 0 }, por: { DURA: { pj: 0, pg: 0 }, ARCILLA: { pj: 0, pg: 0 } }, titulos: 0, racha: 0, historial: [] };
      fichas.set(clave, f);
    }
    if (fotoUrl && !f.fotoUrl) f.fotoUrl = fotoUrl;
    return f;
  };
  for (const t of torneos) {
    if (t.eliminado) continue;
    for (const p of t.partidos) {
      if (!p.resultado || p.resultado.tipo === "BYE" || !p.a || !p.b) continue;
      ([p.a, p.b] as const).forEach((iid, lado) => {
        const gano = p.resultado!.ganador === lado;
        for (const j of inscrito(t, iid)?.jugadores ?? []) {
          const f = ficha(j.nombre, j.fotoUrl);
          f.total.pj++;
          f.por[t.superficie].pj++;
          if (gano) {
            f.total.pg++;
            f.por[t.superficie].pg++;
          }
          f.historial.push({ en: p.actualizadoEn, gano });
        }
      });
    }
    const rey = campeon(t);
    if (rey && t.formato !== "PARTIDO") for (const j of inscrito(t, rey)?.jugadores ?? []) ficha(j.nombre).titulos++;
  }
  return [...fichas.values()]
    .map(({ historial, ...f }) => {
      const orden = historial.sort((a, b) => b.en.localeCompare(a.en));
      let racha = 0;
      for (const h of orden) {
        if (!h.gano) break;
        racha++;
      }
      return { ...f, racha };
    })
    .filter((f) => f.total.pj > 0 || f.titulos > 0);
}

export function ordenar(fichas: FichaJugador[], sup: Superficie | null): FichaJugador[] {
  const r = (f: FichaJugador) => (sup ? f.por[sup] : f.total);
  return [...fichas].filter((f) => r(f).pj > 0).sort((a, b) => r(b).pg - r(a).pg || pct(r(b)) - pct(r(a)) || b.titulos - a.titulos || a.nombre.localeCompare(b.nombre));
}

/** "Especialista": gana bastante más en una superficie que en la otra (mínimo 2 partidos en cada una). */
export function especialidad(f: FichaJugador): Superficie | null {
  const { DURA: d, ARCILLA: a } = f.por;
  if (d.pj < 2 || a.pj < 2) return a.pj >= 3 && pct(a) >= 0.75 ? "ARCILLA" : d.pj >= 3 && pct(d) >= 0.75 ? "DURA" : null;
  const dif = pct(a) - pct(d);
  if (dif >= 0.25) return "ARCILLA";
  if (dif <= -0.25) return "DURA";
  return null;
}
