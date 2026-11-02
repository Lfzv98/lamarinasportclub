/**
 * Torneo de escala real (≈450 duplas, como el último Open de La Marina) para demos y pruebas de carga.
 * Puro: arma el torneo con las mismas funciones que usa la app (inscribir, sortear, publicar, programar).
 */
import type { CategoriaTorneo, FinPunto, JugadorTorneo, MarcadorVivo, NivelTorneo, PartidoTorneo, ResultadoTorneo, Torneo } from "@/types/torneo";
import { calcularMarcador, nuevoMarcador } from "./marcador.ts";
import { aplicarAccion } from "./arbitraje.ts";
import { CONFIG_CUADRO_BASE, catNivel } from "./categorias.ts";
import { programarTorneo } from "./programacion.ts";
import { crearTorneo, dupla, inscribirDupla, publicarCategoria, reglasDe, sortearCategoria, todosLosPartidos } from "./torneo.ts";

const NOMBRES_H = ["Andrés", "Luis", "Diego", "Miguel", "José", "Gabriel", "Daniel", "Rafael", "Carlos", "Ricardo", "Jesús", "Manuel", "Eduardo", "Alejandro", "Samuel", "Javier", "Óscar", "Héctor", "Pedro", "Simón", "Tomás", "Iván", "Hugo", "Raúl", "Antonio", "Francisco", "Jorge", "Alberto", "Ernesto", "Gustavo", "Rodrigo", "Sebastián", "Mauricio", "Fernando", "Nicolás", "Emilio"];
const NOMBRES_M = ["Valentina", "Camila", "Sofía", "Isabella", "Mariana", "Gabriela", "Daniela", "Andrea", "Paola", "Carolina", "Fernanda", "Natalia", "Lucía", "Victoria", "Elena", "Adriana", "Mónica", "Patricia", "Laura", "Claudia", "Ana", "Sara", "Julia", "Irene", "María", "Verónica", "Alejandra", "Rosa", "Beatriz", "Diana"];
const APELLIDOS = ["Salazar", "Guzmán", "Rondón", "Hernández", "Marcano", "Rojas", "Lugo", "Bello", "Mendoza", "Fermín", "Alcalá", "Figueroa", "Rangel", "Díaz", "Ortega", "Silva", "Requena", "Vargas", "Castillo", "Paredes", "Herrera", "Morales", "Navarro", "Ochoa", "Pérez", "Rivas", "Mata", "Acosta", "Brito", "Quintero", "Torres", "Medina", "Linares", "Ruiz", "Gil", "Peña", "Romero", "Sosa", "Campos", "León", "Rivero", "Lara", "Ponce", "Rey", "Duarte", "Montes", "Cedeño", "Colmenares", "Zambrano", "Arismendi", "Uzcátegui", "Fuenmayor", "Marín", "Briceño", "Chacón", "Sánchez", "García", "López", "González", "Rodríguez"];

/** Categorías y duplas por categoría: suman 450. */
export const REPARTO: [CategoriaTorneo["rama"], NivelTorneo, number][] = [
  ["MASCULINO", "7MA", 40], ["MASCULINO", "6TA", 44], ["MASCULINO", "5TA", 46], ["MASCULINO", "4TA", 40], ["MASCULINO", "3RA", 30], ["MASCULINO", "2DA", 20], ["MASCULINO", "1RA", 14],
  ["FEMENINO", "7MA", 28], ["FEMENINO", "6TA", 30], ["FEMENINO", "5TA", 26], ["FEMENINO", "4TA", 20], ["FEMENINO", "3RA", 12],
  ["MIXTO", "6TA", 34], ["MIXTO", "5TA", 32], ["MIXTO", "4TA", 22], ["MIXTO", "3RA", 12],
];

const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface OpcionesGrande {
  id: string;
  nombre?: string;
  /** Primer día (AAAA-MM-DD). */
  desde: string;
  dias?: number;
  /** Sorteo y publicación de todas las categorías. */
  sortear?: boolean;
  semilla?: number;
}

/** Arma el torneo: 16 categorías, 450 duplas con FVP verificada, en La Marina (5 pistas) y dos sedes de apoyo. */
export function torneoGrande(o: OpcionesGrande): Torneo {
  const n = o.dias ?? 14;
  const dias = Array.from({ length: n }, (_, i) => {
    const fecha = sumarDias(o.desde, i);
    const finde = [0, 6].includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
    return { fecha, inicio: finde ? "07:00" : "16:00", fin: "23:00" };
  });
  const club = [1, 2, 3, 4, 5].map((numero) => ({ numero, nombre: `Pista ${numero}`, techada: numero <= 4, activa: true }));
  const apoyo = [
    ...[6, 7, 8, 9].map((numero) => ({ numero, nombre: `Pista ${numero - 5}`, techada: true, activa: true, sedeId: "sede-altamira" })),
    ...[10, 11, 12, 13].map((numero) => ({ numero, nombre: `Pista ${numero - 9}`, techada: false, activa: true, sedeId: "sede-lpg" })),
  ];
  let t = crearTorneo({
    nombre: o.nombre ?? "Open La Marina 2026",
    dias,
    canchas: [...club, ...apoyo],
    categorias: REPARTO.map(([rama, nivel]) => catNivel(rama, nivel)),
  });
  t = {
    ...t,
    id: o.id,
    sedes: [
      { id: "sede-altamira", nombre: "Altamira Padel", trasladoMin: 20 },
      { id: "sede-lpg", nombre: "Los Palos Grandes", trasladoMin: 25 },
    ],
  };

  let seq = 0;
  const barajas: Partial<Record<"M" | "F", (readonly [string, string])[]>> = {};
  let ced = 9_000_000;
  const jugador = (genero: "M" | "F"): JugadorTorneo => {
    seq++;
    const lista = genero === "M" ? NOMBRES_H : NOMBRES_M;
    // Combinación nombre+apellido sin repetir, en orden barajado (si no, rivales seguidos salen con los mismos apellidos).
    const combos = (barajas[genero] ??= barajar(lista.flatMap((n) => APELLIDOS.map((a) => [n, a] as const)), genero));
    const [nombre, apellido] = combos[(seq - 1) % combos.length];
    return { id: `${o.id}-j${seq}`, nombre, apellido, genero, cedula: `V-${ced += 37_211}`, telefono: `0414${String(1_000_000 + seq * 13).slice(-7)}` };
  };
  const ahora = new Date().toISOString();
  REPARTO.forEach(([rama, nivel, cuantas], ci) => {
    const catId = t.categorias[ci].categoria.id;
    for (let i = 0; i < cuantas; i++) {
      const a = jugador(rama === "FEMENINO" ? "F" : "M");
      const b = jugador(rama === "MASCULINO" ? "M" : "F");
      t = inscribirDupla(t, catId, a, b, {
        id: `${o.id}-${catId}-d${i + 1}`,
        puntos: Math.max(0, 1500 - i * Math.round(1400 / cuantas)),
        fvp: { estado: "VERIFICADA", categorias: [nivel, nivel], en: ahora, por: "Ranking FVP", lista: o.desde },
      });
    }
  });
  if (!o.sortear) return t;
  for (const c of t.categorias) {
    const id = c.categoria.id;
    t = sortearCategoria(t, id, { semilla: (o.semilla ?? 7) + id.length, por: "Staff", config: { ...CONFIG_CUADRO_BASE } });
    t = publicarCategoria(t, id, "Staff");
  }
  return programarTorneo(t).torneo;
}

const minutos = (p: PartidoTorneo) => Date.parse(`${p.programacion!.fecha}T${p.programacion!.hora}:00Z`) / 60_000;
// Resultados de dos sets (válidos con cualquier regla de tercer set).
const MARCADORES: [number, number][][] = [
  [[6, 2], [7, 6]],
  [[3, 6], [5, 7]],
  [[6, 4], [6, 3]],
  [[7, 5], [6, 4]],
  [[4, 6], [2, 6]],
  [[6, 3], [6, 1]],
];
const marcadorDe = (i: number): ResultadoTorneo => {
  const sets = MARCADORES[i % MARCADORES.length].map(([a, b]) => ({ a, b }));
  return { sets, ganador: sets[0].a > sets[0].b ? "A" : "B", tipo: "NORMAL" };
};
const ARBITROS = ["José Méndez", "Ana Pérez", "Luis Salas", "María Torres", "Pedro Arias"];

/**
 * El torneo "a mitad de camino" en `ahora` (hora de pared del club, "AAAA-MM-DDTHH:MM"): lo que
 * terminaba antes está jugado (y revisado en mesa, salvo los últimos `porRevisar`), lo que
 * empezaba hace poco está en juego y lo que viene en 10 minutos, llamado a pista.
 */
export function avanzarHasta(t: Torneo, ahora: string, porRevisar = 5): Torneo {
  const ya = Date.parse(`${ahora}:00Z`) / 60_000;
  const dur = 90;
  let i = 0;
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    let algo = false;
    const lista = todosLosPartidos(t)
      .filter((p) => !p.bye && p.programacion && p.estado !== "FINALIZADO" && p.duplaA && p.duplaB)
      .sort((a, b) => minutos(a) - minutos(b));
    for (const p of lista) {
      const ini = minutos(p);
      const arb = ARBITROS[p.programacion!.pista % ARBITROS.length];
      if (ini + dur <= ya) {
        t = aplicarAccion(t, p.id, { accion: "resultado", resultado: marcadorDe(i++) }, arb, "PISTA");
        algo = true;
      } else if (ini <= ya && p.estado === "PENDIENTE") {
        t = aplicarAccion(t, p.id, { accion: "iniciar", pista: p.programacion!.pista }, arb, "PISTA");
      } else if (ini <= ya + 10 && p.estado === "PENDIENTE") {
        t = aplicarAccion(t, p.id, { accion: "llamar", pista: p.programacion!.pista }, "Árbitro principal Carla Rodríguez", "MESA");
      }
    }
    if (!algo) break;
  }
  // Mesa técnica al día salvo lo último que llegó (lo que terminó más tarde queda en la bandeja).
  const cerrados = todosLosPartidos(t)
    .filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR")
    .sort((a, b) => minutos(a) - minutos(b));
  for (const p of cerrados.slice(0, Math.max(0, cerrados.length - porRevisar)))
    t = aplicarAccion(t, p.id, { accion: "revisar" }, "Árbitro principal Carla Rodríguez", "MESA");
  return retocarTiempos(t, ya);
}

/** Hora de pared del club ("AAAA-MM-DD", "HH:MM") + minutos → ISO real (el club está en UTC-4). */
const isoClub = (minutosPared: number) => new Date((minutosPared + 240) * 60_000).toISOString();
/** Pseudoaleatorio estable por partido (la demo sale igual cada vez). */
const azar = (id: string, n: number) => {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // Mezcla final: sin ella los bits bajos se repiten y "% 2" sale siempre igual en un partido.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) % n;
};

/** Fisher-Yates estable (misma demo cada vez). */
function barajar<T>(xs: T[], semilla: string): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = azar(`${semilla}${i}`, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Inicio, fin y revisión con horas creíbles (la mayoría empieza en hora, algunos con atraso). */
function retocarTiempos(t: Torneo, ya: number): Torneo {
  return {
    ...t,
    categorias: t.categorias.map((c) =>
      !c.cuadro
        ? c
        : {
            ...c,
            cuadro: {
              ...c.cuadro,
              partidos: c.cuadro.partidos.map((p) => {
                if (p.bye || !p.programacion) return p;
                const prog = minutos(p);
                if (p.estado === "FINALIZADO") {
                  const ini = prog + [0, 2, 4, 5, 7, 9, 12, 16][azar(p.id, 8)];
                  const fin = Math.min(ini + 62 + azar(p.id + "f", 30), ya - 1);
                  const revision = p.revision ? { ...p.revision, en: p.revision.estado === "VISTO" ? isoClub(Math.min(fin + 3 + azar(p.id + "r", 9), ya)) : isoClub(fin) } : p.revision;
                  return { ...p, inicioEn: isoClub(ini), finEn: isoClub(fin), revision };
                }
                if (p.estado === "EN_JUEGO") return { ...p, inicioEn: isoClub(Math.min(prog + azar(p.id, 6), ya - 5)) };
                return p;
              }),
            },
          },
    ),
  };
}

const FINES: (FinPunto | null)[] = ["WINNER", "ERROR_NO_FORZADO", "ERROR_FORZADO", null, "WINNER", "ERROR_NO_FORZADO", "ACE", null];

/**
 * Marcadores punto a punto creíbles: los partidos en juego van por la mitad y los terminados de hoy
 * tienen todos sus puntos (cuadran con el resultado), con winners, errores y aces por jugador.
 */
export function marcadoresSimulados(t: Torneo, ahora: string, maxTerminados = 80): MarcadorVivo[] {
  const ya = Date.parse(`${ahora}:00Z`) / 60_000;
  const hoy = ahora.slice(0, 10);
  const out: MarcadorVivo[] = [];
  const terminados = todosLosPartidos(t)
    .filter((p) => p.estado === "FINALIZADO" && p.programacion?.fecha === hoy && p.resultado?.tipo === "NORMAL")
    .slice(-maxTerminados);
  const enJuego = todosLosPartidos(t).filter((p) => p.estado === "EN_JUEGO");
  for (const p of [...terminados, ...enJuego]) {
    const da = dupla(t, p.duplaA), db = dupla(t, p.duplaB);
    if (!da || !db) continue;
    const reglas = reglasDe(t, p);
    let m = nuevoMarcador({
      partidoId: p.id,
      torneoId: t.id,
      categoriaId: p.categoriaId,
      reglas,
      jugadoresA: da.jugadorIds,
      jugadoresB: db.jugadorIds,
      sacaPrimero: azar(p.id, 2) ? "A" : "B",
      primerA: da.jugadorIds[0],
      primerB: db.jugadorIds[0],
      pista: p.programacion?.pista ?? null,
      anotador: ARBITROS[(p.programacion?.pista ?? 0) % ARBITROS.length],
      sorteo: { gana: azar(p.id, 2) ? "A" : "B", eligio: "SACAR" },
      ladoInicialA: "IZQ",
    });
    const plan = p.resultado?.sets ?? marcadorDe(azar(p.id, 6)).sets;
    // Secuencia de puntos que lleva exactamente a ese resultado: games a 4-x, tie-break a 7-3 en 6-6.
    const seq: ("A" | "B")[] = [];
    for (const set of plan) {
      const w: "A" | "B" = set.a > set.b ? "A" : "B";
      const l: "A" | "B" = w === "A" ? "B" : "A";
      const gw = Math.max(set.a, set.b), gl = Math.min(set.a, set.b);
      // Orden de games: alternados mientras el que pierde tenga, después los del que gana (nunca cierra antes).
      const games: ("A" | "B")[] = [];
      for (let k = 0; k < gl; k++) games.push(l, w);
      const tie = gw === 7 && gl === 6;
      if (tie) games.pop();
      while (games.filter((g) => g === w).length < (tie ? 6 : gw)) games.push(w);
      games.forEach((g, k) => {
        const o = g === "A" ? "B" : "A";
        // Con punto de oro, a veces el game llega a 40-40 (o-o-o y luego g-g-g-g: el cuarto es el de oro).
        for (let x = 0; x < azar(`${p.id}${set.a}${set.b}${k}`, reglas.puntoDeOro ? 4 : 3); x++) seq.push(o);
        seq.push(g, g, g, g);
      });
      if (tie) seq.push(w, l, w, w, l, w, l, w, w, w);
    }
    const inicio = p.inicioEn ? Date.parse(p.inicioEn) : (ya + 240) * 60_000;
    const fin = p.estado === "FINALIZADO" && p.finEn ? Date.parse(p.finEn) : (ya + 240) * 60_000;
    const hasta = p.estado === "EN_JUEGO" ? Math.max(8, Math.floor(seq.length * (0.35 + azar(p.id, 40) / 100))) : seq.length;
    const puntos = seq.slice(0, hasta).map((gana, k) => {
      const fin_ = FINES[azar(`${p.id}${k}`, FINES.length)];
      const ganador = gana === "A" ? da.jugadorIds : db.jugadorIds;
      const perdedor = gana === "A" ? db.jugadorIds : da.jugadorIds;
      const jugadorId = fin_ === "WINNER" || fin_ === "ACE" ? ganador[azar(`${p.id}j${k}`, 2)] : fin_ ? perdedor[azar(`${p.id}j${k}`, 2)] : null;
      // ~30% de primeros saques fallados (los aces y dobles faltas no aplican).
      const primerSaqueFalla = fin_ !== "ACE" && azar(`${p.id}s${k}`, 10) < 3 ? true : undefined;
      return { gana, fin: fin_, jugadorId, golpe: null, primerSaqueFalla, t: new Date(inicio + ((fin - inicio) * (k + 1)) / (p.estado === "EN_JUEGO" ? hasta : seq.length)).toISOString() };
    });
    m = { ...m, puntos, iniciadoEn: new Date(inicio).toISOString(), actualizadoEn: new Date(fin).toISOString() };
    m = { ...m, finalizado: calcularMarcador(m).terminado };
    out.push(m);
  }
  return out;
}
