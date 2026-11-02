/**
 * Torneo de escala real (≈450 duplas, como el último Open de La Marina) para demos y pruebas de carga.
 * Puro: arma el torneo con las mismas funciones que usa la app (inscribir, sortear, publicar, programar).
 */
import type { CategoriaTorneo, JugadorTorneo, NivelTorneo, PartidoTorneo, ResultadoTorneo, Torneo } from "@/types/torneo";
import { aplicarAccion } from "./arbitraje.ts";
import { CONFIG_CUADRO_BASE, catNivel } from "./categorias.ts";
import { programarTorneo } from "./programacion.ts";
import { crearTorneo, inscribirDupla, publicarCategoria, sortearCategoria, todosLosPartidos } from "./torneo.ts";

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
    ...[6, 7, 8, 9].map((numero) => ({ numero, nombre: `Pista ${numero - 5} · Altamira`, techada: true, activa: true, sedeId: "sede-altamira" })),
    ...[10, 11, 12, 13].map((numero) => ({ numero, nombre: `Pista ${numero - 9} · Los Palos Grandes`, techada: false, activa: true, sedeId: "sede-lpg" })),
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
  let ced = 9_000_000;
  const jugador = (genero: "M" | "F"): JugadorTorneo => {
    seq++;
    const lista = genero === "M" ? NOMBRES_H : NOMBRES_M;
    const nombre = lista[(seq * 7) % lista.length];
    const apellido = `${APELLIDOS[(seq * 11) % APELLIDOS.length]}`;
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
const marcadorDe = (i: number): ResultadoTorneo =>
  i % 4 === 0
    ? { sets: [{ a: 4, b: 6 }, { a: 6, b: 4 }, { a: 7, b: 5 }], ganador: "A", tipo: "NORMAL" }
    : i % 3 === 0
      ? { sets: [{ a: 3, b: 6 }, { a: 5, b: 7 }], ganador: "B", tipo: "NORMAL" }
      : { sets: [{ a: 6, b: 2 }, { a: 7, b: 6 }], ganador: "A", tipo: "NORMAL" };
const ARBITROS = ["Árbitro José Méndez", "Árbitro Ana Pérez", "Árbitro Luis Salas", "Árbitro María Torres", "Árbitro Pedro Arias"];

/**
 * El torneo "a mitad de camino" en `ahora` (hora de pared del club, "AAAA-MM-DDTHH:MM"): lo que
 * terminaba antes está jugado (y revisado en mesa, salvo lo de los últimos 40 minutos), lo que
 * empezaba hace poco está en juego y lo que viene en 10 minutos, llamado a pista.
 */
export function avanzarHasta(t: Torneo, ahora: string): Torneo {
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
        if (ini + dur <= ya - 40) t = aplicarAccion(t, p.id, { accion: "revisar" }, "Árbitro principal Carla Rodríguez", "MESA");
        algo = true;
      } else if (ini <= ya && p.estado === "PENDIENTE") {
        t = aplicarAccion(t, p.id, { accion: "iniciar", pista: p.programacion!.pista }, arb, "PISTA");
      } else if (ini <= ya + 10 && p.estado === "PENDIENTE") {
        t = aplicarAccion(t, p.id, { accion: "llamar", pista: p.programacion!.pista }, "Árbitro principal Carla Rodríguez", "MESA");
      }
    }
    if (!algo) break;
  }
  return t;
}
