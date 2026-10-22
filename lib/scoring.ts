/**
 * Validación de marcadores y cálculo de la tabla de posiciones.
 *
 * Criterio de clasificación:
 *   - PUNTOS_TOTALES: suma de puntos a favor (Americano clásico).
 *   - GAMES / SETS:   3 por victoria, 1 por empate.
 *   Desempate: diferencia (+/-), luego puntos a favor, luego nombre.
 */
import type {
  ConfigPuntuacion,
  EventoAmericano,
  FilaPosicion,
  Jugador,
  Partido,
  Resultado,
  TablaPosiciones,
} from "@/types/americano";

export function configPorDefecto(metodo: ConfigPuntuacion["metodo"]): ConfigPuntuacion {
  switch (metodo) {
    case "PUNTOS_TOTALES":
      return { metodo, puntosPorPartido: 24 };
    case "GAMES_PUNTO_ORO":
      return { metodo, gamesPorPartido: 6 };
    case "SETS_CORTOS":
      return { metodo, gamesPorPartido: 4, setsMaximos: 3 };
  }
}

export function setsGanados(r: Resultado): { a: number; b: number } {
  return (r.sets ?? []).reduce((acc, s) => ({ a: acc.a + (s.a > s.b ? 1 : 0), b: acc.b + (s.b > s.a ? 1 : 0) }), { a: 0, b: 0 });
}

/** Normaliza un resultado: en sets cortos `puntosA/B` = games totales. */
export function normalizarResultado(cfg: ConfigPuntuacion, r: Resultado): Resultado {
  if (cfg.metodo !== "SETS_CORTOS") return { puntosA: r.puntosA, puntosB: r.puntosB };
  const sets = (r.sets ?? []).filter((s) => s.a > 0 || s.b > 0);
  return {
    puntosA: sets.reduce((s, x) => s + x.a, 0),
    puntosB: sets.reduce((s, x) => s + x.b, 0),
    sets,
  };
}

/** Devuelve un mensaje de error en español, o null si el resultado es válido. */
export function validarResultado(cfg: ConfigPuntuacion, r: Resultado): string | null {
  const enteros = (...n: number[]) => n.every((x) => Number.isInteger(x) && x >= 0);
  if (cfg.metodo === "PUNTOS_TOTALES") {
    const total = cfg.puntosPorPartido ?? 24;
    if (!enteros(r.puntosA, r.puntosB)) return "Los puntos deben ser números enteros positivos.";
    if (r.puntosA + r.puntosB === 0) return "Ingresa el marcador.";
    if (r.puntosA + r.puntosB > total) return `La suma no puede superar ${total} puntos.`;
    return null;
  }
  if (cfg.metodo === "GAMES_PUNTO_ORO") {
    const g = cfg.gamesPorPartido ?? 6;
    if (!enteros(r.puntosA, r.puntosB)) return "Los games deben ser números enteros positivos.";
    if (r.puntosA + r.puntosB === 0) return "Ingresa el marcador.";
    if (r.puntosA > g || r.puntosB > g) return `Máximo ${g} games por pareja.`;
    if (r.puntosA === g && r.puntosB === g) return "Solo una pareja puede llegar al máximo de games.";
    return null;
  }
  const g = cfg.gamesPorPartido ?? 4;
  const max = cfg.setsMaximos ?? 3;
  const sets = (r.sets ?? []).filter((s) => s.a > 0 || s.b > 0);
  if (sets.length === 0) return "Ingresa al menos un set.";
  if (sets.length > max) return `Máximo ${max} sets.`;
  for (const [i, s] of sets.entries()) {
    if (!enteros(s.a, s.b)) return `Set ${i + 1}: valores inválidos.`;
    const alto = Math.max(s.a, s.b);
    const bajo = Math.min(s.a, s.b);
    // Set corto a g games, con tie-break en (g-1)-(g-1) → g-(g-1).
    if (alto !== g || bajo > g - 1) return `Set ${i + 1}: un set corto termina ${g}-0 … ${g}-${g - 1}.`;
  }
  const necesarios = Math.floor(max / 2) + 1;
  const { a, b } = setsGanados({ puntosA: 0, puntosB: 0, sets });
  if (a > necesarios || b > necesarios) return "Se jugaron más sets de los necesarios.";
  return null;
}

/** 1 = gana A, -1 = gana B, 0 = empate */
export function ganador(cfg: ConfigPuntuacion, r: Resultado): 1 | -1 | 0 {
  if (cfg.metodo === "SETS_CORTOS") {
    const { a, b } = setsGanados(r);
    if (a !== b) return a > b ? 1 : -1;
  }
  if (r.puntosA === r.puntosB) return 0;
  return r.puntosA > r.puntosB ? 1 : -1;
}

function filaVacia(entidadId: string, nombre: string, fotoUrls: FilaPosicion["fotoUrls"]): FilaPosicion {
  return { entidadId, nombre, fotoUrls, posicion: 0, pj: 0, pg: 0, pe: 0, pp: 0, puntosAFavor: 0, puntosEnContra: 0, diferencia: 0, puntos: 0 };
}

export function nombreJugador(j?: Jugador): string {
  if (!j) return "—";
  return j.apellido ? `${j.nombre} ${j.apellido.charAt(0)}.` : j.nombre;
}

export function partidosJugados(evento: EventoAmericano): Partido[] {
  return evento.rondas.flatMap((r) => r.partidos).filter((p) => p.estado === "FINALIZADO" && p.resultado);
}

export function calcularTabla(evento: EventoAmericano): TablaPosiciones {
  const cfg = evento.puntuacion;
  const porJugador = evento.modalidad === "INDIVIDUAL_ROTATIVO";
  const jugadores = new Map(evento.jugadores.map((j) => [j.id, j]));
  const filas = new Map<string, FilaPosicion>();

  if (porJugador) {
    for (const j of evento.jugadores) filas.set(j.id, { ...filaVacia(j.id, nombreJugador(j), [j.fotoUrl]), retirado: !!j.retirado });
  } else {
    for (const p of evento.parejas) {
      const [a, b] = p.jugadorIds.map((id) => jugadores.get(id));
      filas.set(p.id, { ...filaVacia(p.id, p.nombre ?? `${a?.nombre ?? "?"} / ${b?.nombre ?? "?"}`, [a?.fotoUrl, b?.fotoUrl]), retirado: !!p.retirada });
    }
  }

  for (const partido of partidosJugados(evento)) {
    const r = partido.resultado!;
    const g = ganador(cfg, r);
    const lados = [
      { pareja: partido.parejaA, pf: r.puntosA, pc: r.puntosB, res: g },
      { pareja: partido.parejaB, pf: r.puntosB, pc: r.puntosA, res: -g },
    ];
    for (const lado of lados) {
      const ids = porJugador ? lado.pareja.jugadorIds : [lado.pareja.id];
      for (const id of ids) {
        const f = filas.get(id);
        if (!f) continue;
        f.pj++;
        f.puntosAFavor += lado.pf;
        f.puntosEnContra += lado.pc;
        if (lado.res > 0) f.pg++;
        else if (lado.res < 0) f.pp++;
        else f.pe++;
      }
    }
  }

  const lista = [...filas.values()].map((f) => ({
    ...f,
    diferencia: f.puntosAFavor - f.puntosEnContra,
    puntos: cfg.metodo === "PUNTOS_TOTALES" ? f.puntosAFavor : f.pg * 3 + f.pe,
  }));
  lista.sort(
    (x, y) =>
      y.puntos - x.puntos || y.diferencia - x.diferencia || y.puntosAFavor - x.puntosAFavor || x.nombre.localeCompare(y.nombre, "es"),
  );
  lista.forEach((f, i) => (f.posicion = i + 1));

  return { eventoId: evento.id, tipo: porJugador ? "JUGADOR" : "PAREJA", filas: lista, generadaEn: new Date().toISOString() };
}

export function etiquetaPuntos(cfg: ConfigPuntuacion): { corto: string; largo: string } {
  return cfg.metodo === "PUNTOS_TOTALES" ? { corto: "PTS", largo: "Puntos" } : { corto: "PTS", largo: "Puntos (3·PG + PE)" };
}

export function etiquetaMarcador(cfg: ConfigPuntuacion): string {
  return cfg.metodo === "PUNTOS_TOTALES" ? "puntos" : "games";
}

/** Nombres de los jugadores detrás de una fila (para los avatares). */
export function nombresDeFila(evento: EventoAmericano, f: FilaPosicion): string[] {
  const porId = new Map(evento.jugadores.map((j) => [j.id, j]));
  if (evento.modalidad === "INDIVIDUAL_ROTATIVO") return [f.nombre];
  const p = evento.parejas.find((x) => x.id === f.entidadId);
  return p ? p.jugadorIds.map((id) => porId.get(id)?.nombre ?? "?") : [f.nombre];
}
