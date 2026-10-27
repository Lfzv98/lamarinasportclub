import "server-only";
import { crearEvento } from "@/lib/evento";
import { catNivel } from "@/lib/torneo/categorias";
import { crearTorneo, inscribirDupla } from "@/lib/torneo/torneo";
import type { EventoAmericano, Jugador } from "@/types/americano";
import type { JugadorTorneo, Torneo } from "@/types/torneo";
import { getRepository, getTorneosRepository } from "./repository";

/**
 * Ajustes → Modo prueba (solo staff): un torneo o un americano de prueba en un toque, con
 * todas las duplas y jugadores ya cargados, para ensayar el sorteo o el cuadro vivo sin
 * escribir nombres. Llevan id "demo-…", así "Borrar datos de prueba" también los quita.
 */
const PREFIJO = "demo-";

const HOMBRES = ["Andrés Salazar", "Luis Guzmán", "Diego Rondón", "Miguel Hernández", "José Marcano", "Gabriel Rojas", "Daniel Lugo", "Rafael Bello", "Carlos Mendoza", "Ricardo Fermín", "Jesús Alcalá", "Manuel Figueroa", "Eduardo Rangel", "Alejandro Díaz", "Samuel Ortega", "Javier Silva", "Óscar Requena", "Héctor Vargas", "Pedro Castillo", "Simón Paredes", "Tomás Herrera", "Iván Morales", "Hugo Navarro", "Raúl Ochoa"];
const MUJERES = ["Valentina Pérez", "Camila Rivas", "Sofía Mata", "Isabella Acosta", "Mariana Brito", "Gabriela Quintero", "Daniela Torres", "Andrea Medina", "Paola Linares", "Carolina Ruiz", "Fernanda Gil", "Natalia Peña", "Lucía Romero", "Victoria Sosa", "Elena Campos", "Adriana León", "Mónica Rivero", "Patricia Lara", "Laura Ponce", "Claudia Rey", "Ana Duarte", "Sara Montes", "Julia Cedeño", "Irene Salas"];

const hoyClub = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
const horaClub = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(11, 16);
const marca = () => Date.now().toString(36);
const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const partir = (completo: string) => {
  const [nombre, ...resto] = completo.split(" ");
  return { nombre, apellido: resto.join(" ") };
};

/** Torneo de hoy y mañana con 3 categorías y 8 duplas en cada una: listo para sortear. */
export async function crearTorneoPrueba(): Promise<Torneo> {
  const m = marca();
  const hoy = hoyClub();
  const club = await getRepository().obtenerClub();
  const canchas = club.pistas.filter((p) => p.activa);
  let t = crearTorneo({
    nombre: `Torneo de prueba ${hoy.slice(8, 10)}/${hoy.slice(5, 7)} · ${horaClub()}`,
    dias: [
      { fecha: hoy, inicio: "17:00", fin: "23:00" },
      { fecha: sumarDias(hoy, 1), inicio: "08:00", fin: "22:00" },
    ],
    canchas: canchas.length ? canchas : club.pistas,
    categorias: [catNivel("MASCULINO", "5TA"), catNivel("FEMENINO", "5TA"), catNivel("MIXTO", "5TA")],
  });
  t = { ...t, id: `${PREFIJO}${m}-torneo` };

  let n = 0;
  const jugador = (completo: string, genero: "M" | "F"): JugadorTorneo => ({ id: `${PREFIJO}${m}-j${++n}`, ...partir(completo), genero });
  const parejas: [string, [JugadorTorneo, JugadorTorneo][]][] = [
    [t.categorias[0].categoria.id, Array.from({ length: 8 }, (_, i) => [jugador(HOMBRES[i * 2], "M"), jugador(HOMBRES[i * 2 + 1], "M")])],
    [t.categorias[1].categoria.id, Array.from({ length: 8 }, (_, i) => [jugador(MUJERES[i * 2], "F"), jugador(MUJERES[i * 2 + 1], "F")])],
    [t.categorias[2].categoria.id, Array.from({ length: 8 }, (_, i) => [jugador(HOMBRES[16 + (i % 8)], "M"), jugador(MUJERES[16 + (i % 8)], "F")])],
  ];
  for (const [catId, duplas] of parejas)
    duplas.forEach(([a, b], i) => {
      // Puntos de ranking descendentes: las dos primeras quedan como cabezas de serie.
      t = inscribirDupla(t, catId, a, b, { id: `${PREFIJO}${m}-${catId}-d${i + 1}`, puntos: 1200 - i * 90, cabezaSerie: i < 2 ? i + 1 : null });
    });
  return getTorneosRepository().guardar({ ...t, actualizadoEn: new Date().toISOString() });
}

/** Americano de hoy, 12 jugadores en 3 pistas, rotación individual a 24 puntos: listo para empezar. */
export async function crearAmericanoPrueba(): Promise<EventoAmericano> {
  const m = marca();
  const club = await getRepository().obtenerClub();
  const canchas = club.pistas.filter((p) => p.activa).slice(0, 3);
  const niveles = [3.8, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0, 2.9, 2.8, 2.7, 2.6];
  const jugadores: Jugador[] = HOMBRES.slice(4, 16).map((completo, i) => ({
    id: `${PREFIJO}${m}-jug${i + 1}`,
    ...partir(completo),
    genero: "M",
    nivel: "5TA",
    rating: niveles[i],
    fotoUrl: null,
    usuarioId: null,
  }));
  const hora = horaClub();
  const e = crearEvento({
    nombre: `Americano de prueba · ${hora}`,
    fecha: hoyClub(),
    horaInicio: hora,
    horaFin: `${String((Number(hora.slice(0, 2)) + 2) % 24).padStart(2, "0")}:${hora.slice(3)}`,
    minutosEntreRondas: club.minutosEntreRondas,
    categoria: { rama: "MASCULINO", nivel: "5TA" },
    modalidad: "INDIVIDUAL_ROTATIVO",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 },
    pistas: canchas.length || 3,
    canchas: canchas.length ? canchas : undefined,
    duracionRondaMin: 15,
    totalRondas: 6,
    jugadores,
  });
  return getRepository().guardar({ ...e, id: `${PREFIJO}${m}-americano` });
}
