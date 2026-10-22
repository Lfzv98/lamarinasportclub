/**
 * Regenera data/mockData.json con eventos de ejemplo coherentes.
 *   node --experimental-strip-types scripts/generar-mock.ts
 */
import { writeFileSync } from "node:fs";
import { avanzarRonda, cargarResultado, crearEvento, iniciarRonda } from "../lib/evento.ts";
import { crearRng } from "../lib/rotation.ts";
import { CLUB_POR_DEFECTO } from "../lib/horarios.ts";

const cancha = (...n: number[]) => n.map((x) => CLUB_POR_DEFECTO.pistas.find((c) => c.numero === x)!);
import type { EventoAmericano, Jugador, Nivel, Pareja } from "../types/americano.ts";

const rng = crearRng(2026);
let n = 0;
const j = (nombre: string, apellido: string, genero: "M" | "F", nivel: Nivel, rating: number): Jugador => ({
  id: `jug_${String(++n).padStart(3, "0")}`, nombre, apellido, genero, nivel, rating, fotoUrl: null, usuarioId: null,
});

const mixtos = [
  j("Valeria", "Rojas", "F", "5TA", 3.4), j("Diego", "Ferrer", "M", "5TA", 3.6),
  j("Camila", "Ortega", "F", "5TA", 3.1), j("Mateo", "Salas", "M", "4TA", 4.0),
  j("Lucía", "Paredes", "F", "5TA", 2.9), j("Andrés", "Vega", "M", "5TA", 3.2),
  j("Sofía", "Medina", "F", "4TA", 3.9), j("Tomás", "Quiroga", "M", "5TA", 2.8),
  j("Isabella", "Núñez", "F", "5TA", 3.3), j("Joaquín", "Herrera", "M", "6TA", 2.5),
  j("Martina", "Campos", "F", "6TA", 2.6), j("Sebastián", "Luna", "M", "5TA", 3.5),
];

const femenino = [
  j("Daniela", "Prado", "F", "4TA", 4.1), j("Paula", "Ibáñez", "F", "4TA", 3.9),
  j("Renata", "Molina", "F", "4TA", 4.0), j("Antonia", "Reyes", "F", "4TA", 3.7),
  j("Florencia", "Soto", "F", "4TA", 4.2), j("Elena", "Cruz", "F", "4TA", 3.8),
  j("Julieta", "Ramos", "F", "4TA", 3.6), j("Mía", "Castro", "F", "4TA", 4.0),
  j("Agustina", "Bravo", "F", "4TA", 3.9), j("Carla", "Fuentes", "F", "4TA", 3.5),
];
const parejasF: Pareja[] = [];
for (let i = 0; i < femenino.length; i += 2)
  parejasF.push({ id: `par_${i / 2 + 1}`, jugadorIds: [femenino[i].id, femenino[i + 1].id], nombre: `${femenino[i].nombre} / ${femenino[i + 1].nombre}` });

const open = [
  j("Nicolás", "Arias", "M", "OPEN", 6.2), j("Gabriel", "Pinto", "M", "OPEN", 5.9),
  j("Martín", "Ponce", "M", "OPEN", 6.0), j("Lucas", "Silva", "M", "OPEN", 5.7),
  j("Felipe", "Mora", "M", "OPEN", 6.4), j("Bruno", "Lagos", "M", "OPEN", 5.8),
  j("Emilio", "Díaz", "M", "OPEN", 6.1), j("Ignacio", "Rivas", "M", "OPEN", 5.6),
];

const r = (max: number) => Math.floor(rng() * (max + 1));
function jugarRonda(e: EventoAmericano): EventoAmericano {
  e = iniciarRonda(e);
  for (const p of e.rondas[e.rondaActual - 1].partidos) {
    const cfg = e.puntuacion;
    if (cfg.metodo === "PUNTOS_TOTALES") { const a = 6 + r(12); e = cargarResultado(e, p.id, { puntosA: a, puntosB: (cfg.puntosPorPartido ?? 24) - a }); }
    else if (cfg.metodo === "GAMES_PUNTO_ORO") { const g = cfg.gamesPorPartido ?? 6; const l = r(g - 1); e = cargarResultado(e, p.id, rng() > 0.5 ? { puntosA: g, puntosB: l } : { puntosA: l, puntosB: g }); }
    else { const w = rng() > 0.5; const s1 = { a: w ? 4 : r(3), b: w ? r(3) : 4 }; const s2 = { a: w ? 4 : r(3), b: w ? r(3) : 4 }; e = cargarResultado(e, p.id, { puntosA: 0, puntosB: 0, sets: [s1, s2] }); }
  }
  return avanzarRonda(e);
}

const hoy = "2026-10-24";
let mixto = crearEvento({
  nombre: "Americano Viernes Neón", fecha: hoy, horaInicio: "20:00", horaFin: "22:00", categoria: { rama: "MIXTO", nivel: "5TA" }, modalidad: "INDIVIDUAL_ROTATIVO",
  puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, pistas: 3, canchas: cancha(1, 2, 5), duracionRondaMin: 15, totalRondas: 6, jugadores: mixtos, semilla: 1105,
});
mixto = jugarRonda(jugarRonda(mixto));
mixto = iniciarRonda(mixto);
const p0 = mixto.rondas[2].partidos[0];
mixto = cargarResultado(mixto, p0.id, { puntosA: 13, puntosB: 11 });
mixto.id = "evt_demo_mixto";
// Cronómetro en pausa para que la demo no arranque con un tiempo absurdo.
mixto.rondas[2] = { ...mixto.rondas[2], estado: "PAUSADA", inicioEn: null, segundosAcumulados: 312 };

let fem = crearEvento({
  nombre: "Liga Femenina 4ta · Fecha 3", fecha: hoy, horaInicio: "18:00", horaFin: "20:00", categoria: { rama: "FEMENINO", nivel: "4TA" }, modalidad: "DUPLA_FIJA",
  puntuacion: { metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6 }, pistas: 2, canchas: cancha(3, 4), duracionRondaMin: 20, totalRondas: 5, jugadores: femenino, parejas: parejasF, semilla: 77,
});
fem = jugarRonda(fem);
fem.id = "evt_demo_femenino";

let masc = crearEvento({
  nombre: "Open Masculino La Marina", fecha: "2026-10-17", horaInicio: "17:00", horaFin: "21:00", categoria: { rama: "MASCULINO", nivel: "OPEN" }, modalidad: "INDIVIDUAL_ROTATIVO",
  puntuacion: { metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 }, pistas: 2, canchas: cancha(1, 2), duracionRondaMin: 25, totalRondas: 7, jugadores: open, semilla: 3,
});
for (let i = 0; i < 7; i++) masc = jugarRonda(masc);
masc.id = "evt_demo_open";

const fijar = (e: EventoAmericano, t: string) => ({ ...e, creadoEn: t, actualizadoEn: t });
const data = { version: 1, eventos: [fijar(mixto, "2026-10-24T20:30:00.000Z"), fijar(fem, "2026-10-24T19:00:00.000Z"), fijar(masc, "2026-10-17T23:00:00.000Z")] };
writeFileSync(new URL("../data/mockData.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
console.log("mockData.json:", data.eventos.map((e) => `${e.nombre} (${e.estado}, ronda ${e.rondaActual})`).join(" | "));
