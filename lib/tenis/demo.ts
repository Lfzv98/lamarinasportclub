/**
 * Datos de prueba de tenis: un torneo en cancha dura y otro en arcilla en pleno juego, y un amistoso
 * terminado. Los puntos se simulan con semilla, así siempre salen iguales.
 */
import type { InscritoTenis, Lado, MarcadorTenis, Superficie, TorneoTenis } from "@/types/tenis";
import { FORMATOS, anotar, calcular, falta, nuevoMarcador } from "./marcador.ts";
import { actualizarPartido, aleatorio, crearTorneoTenis, idsDe, inscrito, sortear } from "./torneo.ts";

const HOMBRES = ["Diego Rivas", "Carlos Méndez", "Javier Ortega", "Miguel Salazar", "Ricardo Báez", "Tomás Herrera", "Gabriel Rojas", "Andrés Quintero"];
const MUJERES = ["Valentina Ríos", "Daniela Castro", "Sofía Medina", "Camila Torres", "Andrea Blanco", "Mariana Paz"];

const lista = (nombres: string[], sembrados = 0): InscritoTenis[] =>
  nombres.map((n, i) => ({ id: `i${i}`, siembra: i < sembrados ? i + 1 : null, jugadores: [{ id: `j${i}`, nombre: n }] }));

const parejas = (nombres: [string, string][]): InscritoTenis[] =>
  nombres.map(([a, b], i) => ({ id: `i${i}`, jugadores: [{ id: `j${i}a`, nombre: a }, { id: `j${i}b`, nombre: b }] }));

/** Juega puntos al azar: el que saca gana ~62 % (más si es mejor sembrado). `hasta` corta antes del final. */
function simular(t: TorneoTenis, pid: string, semilla: number, hasta?: number, conMarcas = false): TorneoTenis {
  const p = t.partidos.find((x) => x.id === pid)!;
  const rnd = aleatorio(semilla);
  const ins = [inscrito(t, p.a)!, inscrito(t, p.b)!];
  const sacaPrimero: Lado = rnd() < 0.5 ? 0 : 1;
  const s = ins[sacaPrimero].jugadores;
  const r = ins[1 - sacaPrimero].jugadores;
  const orden = s.length > 1 ? [s[0].id, r[0].id, s[1].id, r[1].id] : [s[0].id, r[0].id];
  let m: MarcadorTenis = nuevoMarcador(orden, rnd() < 0.5 ? "IZQ" : "DER", { gano: sacaPrimero, eligio: "SACAR" }, "Árbitro de prueba");
  const inicio = Date.now() - 95 * 60_000;
  m.inicio = new Date(inicio).toISOString();
  const ventaja = (ins[0].siembra ? 0.06 : 0) - (ins[1].siembra ? 0.06 : 0);
  const ids = idsDe(t, p.a);
  for (let i = 0; i < 400; i++) {
    const e = calcular(m, t.reglas, ids);
    if (e.ganador !== null || (hasta !== undefined && m.puntos.length >= hasta)) break;
    const sacador = e.equipoSaca;
    const j = m.ordenSaque[e.turnoSaque];
    const base = 0.62 + (sacador === 0 ? ventaja : -ventaja);
    const x = rnd();
    if (x < 0.07) m = anotar(m, sacador, "ACE", j);
    else if (x < 0.11) m = falta(falta(m, sacador, j), sacador, j);
    else {
      if (x < 0.4) m = falta(m, sacador, j);
      const g: Lado = rnd() < base ? sacador : ((1 - sacador) as Lado);
      const y = rnd();
      m = anotar(m, g, y < 0.25 ? "WINNER" : y < 0.45 ? "ERROR_NF" : undefined);
    }
    m.puntos[m.puntos.length - 1].en = new Date(inicio + m.puntos.length * 40_000).toISOString();
    if (conMarcas && rnd() < 0.03) m.marcas.push({ en: m.puntos.at(-1)!.en, punto: m.puntos.length - 1, resultado: rnd() < 0.5 ? "BUENA" : "MALA" });
  }
  return actualizarPartido(t, pid, (x) => ({ ...x, estado: "EN_JUEGO", marcador: m }));
}

function base(id: string, d: Parameters<typeof crearTorneoTenis>[0]): TorneoTenis {
  return sortear({ ...crearTorneoTenis(d), id }, 11);
}

export function torneosDemoTenis(prefijo: string, fecha: string): TorneoTenis[] {
  // 1) Cancha dura: singles masculino Open, 8 jugadores, súper tie-break. Cuartos jugados y semis en vivo.
  let dura = base(`${prefijo}tenis-dura`, {
    nombre: "Copa Caracas · Cancha dura",
    superficie: "DURA",
    modalidad: "SINGLES",
    rama: "MASCULINO",
    categoria: "Open",
    reglas: FORMATOS.SUPER_TB.reglas,
    formato: "ELIMINACION",
    fecha,
    canchas: 4,
    inscritos: lista(HOMBRES, 2),
  });
  dura.partidos.filter((p) => p.ronda === 1).forEach((p, i) => (dura = simular(dura, p.id, 100 + i)));
  const semis = dura.partidos.filter((p) => p.ronda === 2);
  dura = simular(dura, semis[0].id, 7, 96);
  dura = { ...dura, partidos: dura.partidos.map((p) => (p.id === semis[0].id ? { ...p, cancha: 1 } : p.id === semis[1].id ? { ...p, cancha: 2, estado: "LLAMADO" } : p)) };

  // 2) Arcilla: singles femenino 2da, 6 jugadoras (byes para las dos primeras), clásico. Un partido en vivo.
  let arcilla = base(`${prefijo}tenis-arcilla`, {
    nombre: "Abierto de Arcilla La Marina",
    superficie: "ARCILLA",
    modalidad: "SINGLES",
    rama: "FEMENINO",
    categoria: "2da",
    reglas: FORMATOS.CLASICO.reglas,
    formato: "ELIMINACION",
    fecha,
    canchas: 3,
    inscritos: lista(MUJERES, 2),
  });
  const reales = arcilla.partidos.filter((p) => p.ronda === 1 && p.a && p.b);
  arcilla = simular(arcilla, reales[0].id, 21, undefined, true);
  arcilla = simular(arcilla, reales[1].id, 22, 70, true);
  arcilla = { ...arcilla, partidos: arcilla.partidos.map((p) => (p.id === reales[1].id ? { ...p, cancha: 1 } : p)) };

  // 3) Amistoso de dobles en arcilla, terminado (suma al ranking por superficie).
  let amistoso = base(`${prefijo}tenis-amistoso`, {
    nombre: "Dobles del sábado",
    superficie: "ARCILLA",
    modalidad: "DOBLES",
    rama: "MASCULINO",
    categoria: "Open",
    reglas: { ...FORMATOS.SETS_CORTOS.reglas },
    formato: "PARTIDO",
    fecha,
    canchas: 1,
    inscritos: parejas([
      [HOMBRES[0], HOMBRES[3]],
      [HOMBRES[1], HOMBRES[2]],
    ]),
  });
  amistoso = simular(amistoso, amistoso.partidos[0].id, 5);
  return [dura, arcilla, amistoso];
}

export const superficiesDemo: Superficie[] = ["DURA", "ARCILLA"];
