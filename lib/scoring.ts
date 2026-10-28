/**
 * Validación de marcadores y cálculo de la tabla de posiciones.
 *
 * Criterio de clasificación:
 *   - PUNTOS_TOTALES: suma de puntos a favor (Americano clásico).
 *   - GAMES / SETS:   3 por victoria, 1 por empate.
 *   Desempate: en dupla fija, primero el enfrentamiento directo entre las empatadas;
 *   luego diferencia (+/-) y puntos a favor. Si siguen iguales, comparten posición.
 */
import type {
  ConfigPuntuacion,
  CriterioRanking,
  EventoAmericano,
  FilaPosicion,
  Jugador,
  ModoConteo,
  Partido,
  Resultado,
  NotaDesempate,
  SetScore,
  TablaPosiciones,
} from "@/types/americano";

export function criterioDe(cfg: ConfigPuntuacion): CriterioRanking {
  return cfg.criterio ?? (cfg.metodo === "PUNTOS_TOTALES" ? "PUNTOS_A_FAVOR" : "VICTORIAS");
}

export const CRITERIOS: { id: CriterioRanking; label: string; descripcion: string }[] = [
  { id: "PUNTOS_A_FAVOR", label: "Todos los puntos", descripcion: "Cada jugador suma lo que hizo su pareja en cada partido, gane o pierda (americano clásico)." },
  { id: "SOLO_GANADOS", label: "Solo rondas ganadas", descripcion: "Solo suma el marcador de los partidos que ganó." },
  { id: "VICTORIAS", label: "Por victorias", descripcion: "3 puntos por partido ganado y 1 por empate." },
];

export function configPorDefecto(metodo: ConfigPuntuacion["metodo"]): ConfigPuntuacion {
  switch (metodo) {
    case "PUNTOS_TOTALES":
      return { metodo, puntosPorPartido: 24, modo: "TOTAL" };
    case "GAMES_PUNTO_ORO":
      return { metodo, gamesPorPartido: 6, modo: "A_GANAR", puntoDeOro: true };
    case "SETS_CORTOS":
      return { metodo, gamesPorPartido: 4, setsMaximos: 3, puntoDeOro: true };
  }
}

/** Rangos permitidos al personalizar (la API rechaza lo que quede fuera). */
export const LIMITES = {
  puntos: { min: 4, max: 99 },
  games: { min: 1, max: 15 },
  gamesSet: { min: 2, max: 9 },
  tie: { min: 3, max: 21 },
} as const;

export function modoDe(cfg: ConfigPuntuacion): ModoConteo {
  return cfg.modo ?? (cfg.metodo === "PUNTOS_TOTALES" ? "TOTAL" : "A_GANAR");
}

/** N: puntos del partido, games del partido o games por set. */
export function metaDe(cfg: ConfigPuntuacion): number {
  if (cfg.metodo === "PUNTOS_TOTALES") return cfg.puntosPorPartido ?? 24;
  return cfg.gamesPorPartido ?? (cfg.metodo === "SETS_CORTOS" ? 4 : 6);
}

/** Games: marcador en que se juega el tie-break (2 → "si quedan 2-2"), o null si no hay tie-break. */
export function empateTieBreak(cfg: ConfigPuntuacion): number | null {
  if (cfg.metodo !== "GAMES_PUNTO_ORO" || !cfg.tieBreak) return null;
  const n = metaDe(cfg);
  return modoDe(cfg) === "TOTAL" ? Math.floor(n / 2) : n - 1;
}

/** Sets: índice (desde 0) del set que se juega como super tie-break, o null. */
export function indiceSuperTie(cfg: ConfigPuntuacion): number | null {
  const max = cfg.setsMaximos ?? 3;
  return cfg.metodo === "SETS_CORTOS" && cfg.superTie && max > 1 ? max - 1 : null;
}

/** El tie-break exige 2 de diferencia salvo que las reglas lo apaguen. */
export const tieConDiferencia = (cfg: ConfigPuntuacion) => cfg.tieConDiferencia !== false;

/**
 * Un tie-break a `meta` puntos se gana llegando a meta con 2 de diferencia (ej. a 7: 7-5, 8-6).
 * Sin diferencia de 2, gana el primero en llegar a meta (ej. 7-6).
 */
export function validarTie(meta: number, a: number, b: number, conDiferencia = true): string | null {
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (alto < meta) return `El tie-break se juega a ${meta} puntos.`;
  if (!conDiferencia) return alto === meta && bajo < meta ? null : `El tie-break termina al llegar a ${meta} (ej. ${meta}-${meta - 1}).`;
  if (alto === meta ? bajo > meta - 2 : alto - bajo !== 2) return `El tie-break se gana por 2 de diferencia (ej. ${meta}-${meta - 2} o ${meta + 1}-${meta - 1}).`;
  return null;
}

/** Un set a g games: corto (g ≤ 4) termina g-0 … g-(g-1); normal (g ≥ 5) termina g-0 … g-(g-2), (g+1)-(g-1) o (g+1)-g. */
export function validarSet(g: number, a: number, b: number): boolean {
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (g <= 4) return alto === g && bajo <= g - 1;
  return (alto === g && bajo <= g - 2) || (alto === g + 1 && bajo >= g - 1);
}

/** Marcadores finales posibles de un set a g games, del lado ganador primero (para los atajos). */
export function finalesDeSet(g: number): [number, number][] {
  if (g <= 4) return Array.from({ length: g }, (_, k) => [g, k]);
  return [...Array.from({ length: g - 1 }, (_, k): [number, number] => [g, k]), [g + 1, g - 1], [g + 1, g]];
}

export function setsGanados(r: Resultado): { a: number; b: number } {
  return (r.sets ?? []).reduce((acc, s) => ({ a: acc.a + (s.a > s.b ? 1 : 0), b: acc.b + (s.b > s.a ? 1 : 0) }), { a: 0, b: 0 });
}

/** Normaliza un resultado: en sets `puntosA/B` = games totales (el super tie cuenta como un game). */
export function normalizarResultado(cfg: ConfigPuntuacion, r: Resultado): Resultado {
  const n = normalizarSinDesempate(cfg, r);
  // El desempate (llave) solo vale si el marcador quedó igualado.
  return r.desempate && n.puntosA === n.puntosB && ganador(cfg, { ...n, desempate: undefined }) === 0 ? { ...n, desempate: r.desempate } : n;
}

function normalizarSinDesempate(cfg: ConfigPuntuacion, r: Resultado): Resultado {
  if (cfg.metodo === "GAMES_PUNTO_ORO") {
    const tb = r.tieBreak && (r.tieBreak.a > 0 || r.tieBreak.b > 0) ? { a: r.tieBreak.a, b: r.tieBreak.b } : undefined;
    return tb ? { puntosA: r.puntosA, puntosB: r.puntosB, tieBreak: tb } : { puntosA: r.puntosA, puntosB: r.puntosB };
  }
  if (cfg.metodo !== "SETS_CORTOS") return { puntosA: r.puntosA, puntosB: r.puntosB };
  const st = indiceSuperTie(cfg);
  const sets = (r.sets ?? []).filter((s) => s.a > 0 || s.b > 0);
  const games = (s: SetScore, i: number) => (i === st ? { a: s.a > s.b ? 1 : 0, b: s.b > s.a ? 1 : 0 } : s);
  return {
    puntosA: sets.reduce((t, x, i) => t + games(x, i).a, 0),
    puntosB: sets.reduce((t, x, i) => t + games(x, i).b, 0),
    sets,
  };
}

/** Devuelve un mensaje de error en español, o null si el resultado es válido. */
export function validarResultado(cfg: ConfigPuntuacion, r: Resultado): string | null {
  const enteros = (...n: number[]) => n.every((x) => Number.isInteger(x) && x >= 0);
  const n = metaDe(cfg);
  const modo = modoDe(cfg);
  if (cfg.metodo === "PUNTOS_TOTALES") {
    if (!enteros(r.puntosA, r.puntosB)) return "Los puntos deben ser números enteros positivos.";
    if (r.puntosA + r.puntosB === 0) return "Ingresa el marcador.";
    if (modo === "TOTAL") {
      if (r.puntosA + r.puntosB > n) return `La suma no puede superar ${n} puntos.`;
    } else {
      if (r.puntosA > n || r.puntosB > n) return `El partido es a ${n} puntos: nadie puede pasar de ${n}.`;
      if (r.puntosA === n && r.puntosB === n) return "Solo una pareja puede llegar a " + n + ".";
    }
    return null;
  }
  if (cfg.metodo === "GAMES_PUNTO_ORO") {
    if (!enteros(r.puntosA, r.puntosB)) return "Los games deben ser números enteros positivos.";
    if (r.puntosA + r.puntosB === 0) return "Ingresa el marcador.";
    const x = empateTieBreak(cfg);
    const definidoEnTie = x !== null && Math.max(r.puntosA, r.puntosB) === x + 1 && Math.min(r.puntosA, r.puntosB) === x;
    if (modo === "TOTAL") {
      if (r.puntosA + r.puntosB > n && !definidoEnTie) return `Se juegan ${n} games en total: la suma no puede pasar de ${n}.`;
    } else {
      if (r.puntosA > n || r.puntosB > n) return `Máximo ${n} games por pareja.`;
      if (r.puntosA === n && r.puntosB === n) return "Solo una pareja puede llegar al máximo de games.";
    }
    const tb = r.tieBreak;
    if (tb && (tb.a > 0 || tb.b > 0)) {
      if (!enteros(tb.a, tb.b)) return "Tie-break: valores inválidos.";
      if (x === null) return "Este partido no tiene tie-break.";
      if (!definidoEnTie) return `El tie-break solo se juega si quedan ${x}-${x}.`;
      const m = validarTie(cfg.tieBreak!, tb.a, tb.b, tieConDiferencia(cfg));
      if (m) return m;
      if (tb.a > tb.b !== r.puntosA > r.puntosB) return "El tie-break lo debe ganar la pareja que gana el partido.";
    }
    return null;
  }
  const max = cfg.setsMaximos ?? 3;
  const st = indiceSuperTie(cfg);
  const sets = (r.sets ?? []).filter((s) => s.a > 0 || s.b > 0);
  if (sets.length === 0) return "Ingresa al menos un set.";
  if (sets.length > max) return `Máximo ${max} sets.`;
  for (const [i, s] of sets.entries()) {
    if (!enteros(s.a, s.b)) return `Set ${i + 1}: valores inválidos.`;
    if (i === st) {
      const m = validarTie(cfg.superTie!, s.a, s.b, tieConDiferencia(cfg));
      if (m) return `Super tie: ${m.replace("El tie-break", "se")}`;
    } else if (!validarSet(n, s.a, s.b)) {
      return n <= 4
        ? `Set ${i + 1}: un set corto termina ${n}-0 … ${n}-${n - 1}.`
        : `Set ${i + 1}: un set a ${n} termina ${n}-0 … ${n}-${n - 2}, ${n + 1}-${n - 1} o ${n + 1}-${n}.`;
    }
  }
  const necesarios = Math.floor(max / 2) + 1;
  const { a, b } = setsGanados({ puntosA: 0, puntosB: 0, sets });
  if (a > necesarios || b > necesarios) return "Se jugaron más sets de los necesarios.";
  for (let i = 1; i <= sets.length - 1; i++) {
    const previo = setsGanados({ puntosA: 0, puntosB: 0, sets: sets.slice(0, i) });
    if (previo.a >= necesarios || previo.b >= necesarios) return "Se jugaron más sets de los necesarios.";
  }
  return null;
}

/** Resumen legible de las reglas, ej. "5 games en total · si quedan 2-2, tie a 5 · punto de oro". */
export function descripcionPuntuacion(cfg: ConfigPuntuacion): string {
  const n = metaDe(cfg);
  const oro = cfg.puntoDeOro === false ? "con ventaja" : "punto de oro";
  if (cfg.metodo === "PUNTOS_TOTALES") return modoDe(cfg) === "TOTAL" ? `${n} puntos en total` : `A ${n} puntos`;
  if (cfg.metodo === "GAMES_PUNTO_ORO") {
    const partes = [modoDe(cfg) === "TOTAL" ? `${n} games en total` : `A ${n} games`];
    const x = empateTieBreak(cfg);
    if (x !== null) partes.push(`si quedan ${x}-${x}, tie a ${cfg.tieBreak}${tieConDiferencia(cfg) ? "" : " sin diferencia de 2"}`);
    partes.push(oro);
    return partes.join(" · ");
  }
  const max = cfg.setsMaximos ?? 3;
  const partes = [max === 1 ? `1 set a ${n} games` : `Mejor de ${max} sets a ${n} games`];
  if (indiceSuperTie(cfg) !== null) partes.push(`${max === 3 ? "3er" : "último"} set: super tie a ${cfg.superTie}${tieConDiferencia(cfg) ? "" : " sin diferencia de 2"}`);
  partes.push(oro);
  return partes.join(" · ");
}

/** 1 = gana A, -1 = gana B, 0 = empate */
export function ganador(cfg: ConfigPuntuacion, r: Resultado): 1 | -1 | 0 {
  if (cfg.metodo === "SETS_CORTOS") {
    const { a, b } = setsGanados(r);
    if (a !== b) return a > b ? 1 : -1;
  }
  if (r.puntosA === r.puntosB) return r.desempate === "A" ? 1 : r.desempate === "B" ? -1 : 0;
  return r.puntosA > r.puntosB ? 1 : -1;
}

function filaVacia(entidadId: string, nombre: string, fotoUrls: FilaPosicion["fotoUrls"]): FilaPosicion {
  return { entidadId, nombre, fotoUrls, posicion: 0, pj: 0, pg: 0, pe: 0, pp: 0, puntosAFavor: 0, puntosEnContra: 0, diferencia: 0, puntos: 0 };
}

/** Foto de la dupla fija (las parejas de los partidos son copias: se busca la del evento). */
export function fotoDeDupla(evento: Pick<EventoAmericano, "modalidad" | "parejas">, parejaId: string): string | null {
  return evento.modalidad === "DUPLA_FIJA" ? (evento.parejas.find((p) => p.id === parejaId)?.fotoUrl ?? null) : null;
}

export function nombreJugador(j?: Jugador): string {
  if (!j) return "—";
  return j.apellido ? `${j.nombre} ${j.apellido.charAt(0)}.` : j.nombre;
}

/** Nombre y apellido completos, sin abreviar (para la TV). */
export function nombreCompleto(j?: Jugador): string {
  if (!j) return "?";
  return [j.nombre, j.apellido].filter(Boolean).join(" ");
}

export function partidosJugados(evento: EventoAmericano): Partido[] {
  return evento.rondas.flatMap((r) => r.partidos).filter((p) => p.estado === "FINALIZADO" && p.resultado);
}

export function calcularTabla(evento: EventoAmericano): TablaPosiciones {
  const cfg = evento.puntuacion;
  const porJugador = evento.modalidad === "INDIVIDUAL_ROTATIVO";
  const jugadores = new Map(evento.jugadores.map((j) => [j.id, j]));
  const filas = new Map<string, FilaPosicion>();
  const ganados = new Map<string, number>();

  if (porJugador) {
    for (const j of evento.jugadores) filas.set(j.id, { ...filaVacia(j.id, nombreJugador(j), [j.fotoUrl]), retirado: !!j.retirado });
  } else {
    for (const p of evento.parejas) {
      const [a, b] = p.jugadorIds.map((id) => jugadores.get(id));
      filas.set(p.id, { ...filaVacia(p.id, p.nombre ?? `${a?.nombre ?? "?"} / ${b?.nombre ?? "?"}`, [a?.fotoUrl, b?.fotoUrl]), fotoDupla: p.fotoUrl ?? null, retirado: !!p.retirada });
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
        if (lado.res > 0) {
          f.pg++;
          ganados.set(id, (ganados.get(id) ?? 0) + lado.pf);
        }
        else if (lado.res < 0) f.pp++;
        else f.pe++;
      }
    }
  }

  const criterio = criterioDe(cfg);
  const lista = [...filas.values()].map((f) => ({
    ...f,
    diferencia: f.puntosAFavor - f.puntosEnContra,
    puntos: criterio === "PUNTOS_A_FAVOR" ? f.puntosAFavor : criterio === "SOLO_GANADOS" ? (ganados.get(f.entidadId) ?? 0) : f.pg * 3 + f.pe,
  }));

  // Enfrentamiento directo (solo dupla fija): mini tabla con los partidos entre duplas empatadas en puntos.
  const directo = new Map<string, { pts: number; dif: number; pj: number }>();
  if (!porJugador) {
    const grupos = new Map<number, Set<string>>();
    for (const f of lista) grupos.set(f.puntos, (grupos.get(f.puntos) ?? new Set()).add(f.entidadId));
    for (const ids of grupos.values()) {
      if (ids.size < 2) continue;
      for (const id of ids) directo.set(id, { pts: 0, dif: 0, pj: 0 });
      for (const p of partidosJugados(evento)) {
        if (!ids.has(p.parejaA.id) || !ids.has(p.parejaB.id)) continue;
        const r = p.resultado!;
        const g = ganador(cfg, r);
        const a = directo.get(p.parejaA.id)!;
        const b = directo.get(p.parejaB.id)!;
        a.pj++;
        b.pj++;
        a.pts += g > 0 ? 3 : g === 0 ? 1 : 0;
        b.pts += g < 0 ? 3 : g === 0 ? 1 : 0;
        a.dif += r.puntosA - r.puntosB;
        b.dif += r.puntosB - r.puntosA;
      }
    }
  }
  const d = (id: string) => directo.get(id) ?? { pts: 0, dif: 0, pj: 0 };
  const llaves: ((x: FilaPosicion, y: FilaPosicion) => number)[] = [
    (x, y) => y.puntos - x.puntos,
    (x, y) => d(y.entidadId).pts - d(x.entidadId).pts,
    (x, y) => d(y.entidadId).dif - d(x.entidadId).dif,
    (x, y) => y.diferencia - x.diferencia,
    (x, y) => y.puntosAFavor - x.puntosAFavor,
  ];
  const comparar = (x: FilaPosicion, y: FilaPosicion) => {
    for (const k of llaves) {
      const v = k(x, y);
      if (v) return v;
    }
    return 0;
  };
  lista.sort((x, y) => comparar(x, y) || x.nombre.localeCompare(y.nombre, "es"));

  // Posiciones: si dos filas son idénticas en todos los criterios, comparten puesto (1, 2, 2, 4).
  const desempates: NotaDesempate[] = [];
  const unidad = cfg.metodo === "PUNTOS_TOTALES" ? "puntos" : "games";
  lista.forEach((f, i) => {
    const previa = lista[i - 1];
    const sinJugar = !previa || (previa.pj === 0 && f.pj === 0);
    if (!sinJugar && comparar(previa, f) === 0) {
      f.posicion = previa.posicion;
      previa.empatado = f.empatado = true;
    } else f.posicion = i + 1;
    if (sinJugar || previa.puntos !== f.puntos) return;
    const motivo =
      comparar(previa, f) === 0
        ? "empate total, comparten posición"
        : d(previa.entidadId).pts !== d(f.entidadId).pts || d(previa.entidadId).dif !== d(f.entidadId).dif
          ? `ganó el enfrentamiento directo${d(f.entidadId).pj ? ` (${d(previa.entidadId).dif > 0 ? "+" : ""}${d(previa.entidadId).dif} ${unidad})` : ""}`
          : previa.diferencia !== f.diferencia
            ? `mejor diferencia (${fmt(previa.diferencia)} vs ${fmt(f.diferencia)})`
            : `más ${unidad} a favor (${previa.puntosAFavor} vs ${f.puntosAFavor})`;
    const ultima = desempates[desempates.length - 1];
    if (ultima?.empatados && comparar(previa, f) === 0 && ultima.empatados[ultima.empatados.length - 1] === previa.nombre) ultima.empatados.push(f.nombre);
    else desempates.push({ arriba: previa.nombre, abajo: f.nombre, puntos: f.puntos, motivo, ...(comparar(previa, f) === 0 ? { empatados: [previa.nombre, f.nombre] } : {}) });
  });

  return { eventoId: evento.id, tipo: porJugador ? "JUGADOR" : "PAREJA", filas: lista, desempates, generadaEn: new Date().toISOString() };
}

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));

export function explicacionRanking(cfg: ConfigPuntuacion, dupla = false): string {
  const unidad = cfg.metodo === "PUNTOS_TOTALES" ? "puntos" : "games";
  const desempate = `${dupla ? "enfrentamiento directo, luego " : ""}diferencia de ${unidad}, luego ${unidad} a favor. Si siguen iguales, comparten posición.`;
  switch (criterioDe(cfg)) {
    case "PUNTOS_A_FAVOR":
      return `PTS = ${unidad} a favor en todos los partidos (gane o pierda). Si empatan: ${desempate}`;
    case "SOLO_GANADOS":
      return `PTS = ${unidad} sumados solo en los partidos ganados. Si empatan: ${desempate}`;
    default:
      return `PTS = 3 por victoria y 1 por empate. Si empatan: ${desempate}`;
  }
}

export function etiquetaMarcador(cfg: ConfigPuntuacion): string {
  return cfg.metodo === "PUNTOS_TOTALES" ? "puntos" : "games";
}

/** Nombres de los jugadores detrás de una fila (para los avatares). */
/** Como `nombresDeFila`, pero con nombre y apellido completos de cada jugador (TV). */
export function nombresCompletosDeFila(evento: EventoAmericano, f: FilaPosicion): string[] {
  const porId = new Map(evento.jugadores.map((j) => [j.id, j]));
  if (evento.modalidad === "INDIVIDUAL_ROTATIVO") return [nombreCompleto(porId.get(f.entidadId))];
  const p = evento.parejas.find((x) => x.id === f.entidadId);
  return p ? p.jugadorIds.map((id) => nombreCompleto(porId.get(id))) : [f.nombre];
}

export function nombresDeFila(evento: EventoAmericano, f: FilaPosicion): string[] {
  const porId = new Map(evento.jugadores.map((j) => [j.id, j]));
  if (evento.modalidad === "INDIVIDUAL_ROTATIVO") return [f.nombre];
  const p = evento.parejas.find((x) => x.id === f.entidadId);
  return p ? p.jugadorIds.map((id) => porId.get(id)?.nombre ?? "?") : [f.nombre];
}
