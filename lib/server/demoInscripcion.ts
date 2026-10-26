import "server-only";
import { configInscripcionBase, crearInscripcion, confirmarEnTorneo, validarInscripcion } from "@/lib/inscripcion";
import { CLUB_POR_DEFECTO } from "@/lib/horarios";
import { catMaster, catNivel } from "@/lib/torneo/categorias";
import { configurarCategoria, crearTorneo } from "@/lib/torneo/torneo";
import type { Inscripcion, JugadorInscripcion } from "@/types/inscripcion";
import type { Torneo } from "@/types/torneo";
import { getTorneosRepository } from "./repository";
import { guardarInscripcion, listarInscripciones } from "./inscripciones";

/**
 * Torneo de prueba con la inscripción online abierta ("Copa Navidad"), con duplas ya
 * confirmadas y otras esperando que el staff verifique el pago. Los datos son inventados.
 */
const NOMBRES: [string, string, "M" | "F"][] = [
  ["Andrés", "Salazar", "M"], ["Luis", "Guzmán", "M"], ["Diego", "Rondón", "M"], ["Miguel", "Hernández", "M"],
  ["José", "Marcano", "M"], ["Gabriel", "Rojas", "M"], ["Daniel", "Lugo", "M"], ["Rafael", "Bello", "M"],
  ["Valentina", "Pérez", "F"], ["Camila", "Rivas", "F"], ["Sofía", "Mata", "F"], ["Isabella", "Acosta", "F"],
  ["Mariana", "Brito", "F"], ["Gabriela", "Quintero", "F"], ["Carlos", "Mendoza", "M"], ["Ricardo", "Fermín", "M"],
  ["Jesús", "Alcalá", "M"], ["Manuel", "Figueroa", "M"], ["Eduardo", "Rangel", "M"], ["Alejandro", "Díaz", "M"],
  ["Samuel", "Ortega", "M"], ["Javier", "Silva", "M"], ["Óscar", "Requena", "M"], ["Héctor", "Vargas", "M"],
];

const jug = (i: number, extra: Partial<JugadorInscripcion> = {}): JugadorInscripcion => {
  const [nombre, apellido, genero] = NOMBRES[i % NOMBRES.length];
  return {
    nombre,
    apellido,
    genero,
    cedula: `V-${24_100_300 + i * 7919}`,
    correo: `${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${apellido.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@correo.com`,
    telefono: `+58414${String(5_550_100 + i * 37).slice(0, 7)}`,
    talla: (["S", "M", "L", "M", "XL", "L"] as const)[i % 6],
    lado: i % 2 ? "REVES" : "DRIVE",
    alergias: i === 17 ? "Alérgico a los mariscos" : i === 10 ? "Intolerante a la lactosa" : "Ninguna",
    categoriaHabitual: "5ta FVP",
    liga: i % 3 ? "Superliga de Clubes" : "",
    ...extra,
  };
};

const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function cargarDemoInscripcion(prefijo: string, hoy: string): Promise<number> {
  const inicio = sumarDias(hoy, 24);
  let t: Torneo = crearTorneo({
    nombre: "Copa Navidad 2026",
    dias: [0, 1, 2, 3, 4, 5].map((k) => ({ fecha: sumarDias(inicio, k), inicio: k < 5 ? "17:00" : "08:00", fin: "23:00" })),
    canchas: CLUB_POR_DEFECTO.pistas,
    categorias: [
      catNivel("MASCULINO", "3RA"), catNivel("MASCULINO", "4TA"), catNivel("MASCULINO", "5TA"), catNivel("MASCULINO", "6TA"), catNivel("MASCULINO", "7MA"),
      catNivel("FEMENINO", "4TA"), catNivel("FEMENINO", "5TA"), catNivel("FEMENINO", "6TA"),
      catNivel("MIXTO", "5TA"), catMaster("MASCULINO", 45),
    ],
  });
  t = { ...t, id: `${prefijo}copa-navidad` };
  for (const c of t.categorias) t = configurarCategoria(t, c.categoria.id, { cupo: 16 });
  t = {
    ...t,
    patrocinadores: [
      { id: "p1", nombre: "Marina Café", principal: true },
      { id: "p2", nombre: "Óptica Lechería" },
      { id: "p3", nombre: "Hidrata+" },
      { id: "p4", nombre: "Náutica del Morro" },
    ],
    inscripcion: {
      ...configInscripcionBase(),
      abierta: true,
      cierre: sumarDias(inicio, -3),
      precioDupla: 140,
      destacado: "Torneo Estadal · 500 pts para el ranking FVP",
      descripcion: "Cierra el año con el mejor nivel competitivo. Reúne a tu dupla, asegura tu cupo en el cuadro y sé parte de la gran fiesta de cierre de temporada en casa.",
      premios: "Premios en metálico y trofeos para campeones y subcampeones",
      incluye: ["2 juegos garantizados en cuadro", "Franela oficial del torneo", "Hidratación en pista", "Pelotas nuevas por partido", "Arbitraje federado FVP (500 pts)"],
      metodosPago: [
        { id: "pm", tipo: "PAGO_MOVIL", titulo: "Pago Móvil", datos: [{ etiqueta: "Banco", valor: "Banesco (0134)" }, { etiqueta: "Teléfono", valor: "0414-555.01.23" }, { etiqueta: "Cédula / RIF", valor: "J-12345678-9" }], nota: "Monto en bolívares a tasa BCV del día.", pideReferencia: true },
        { id: "zelle", tipo: "ZELLE", titulo: "Zelle", datos: [{ etiqueta: "Correo", valor: "pagos@lamarina.demo" }, { etiqueta: "Titular", valor: "La Marina Sport Club" }], pideReferencia: true },
        { id: "efectivo", tipo: "EFECTIVO", titulo: "Efectivo en el club", datos: [], nota: "Paga en la recepción antes del cierre de inscripciones.", pideReferencia: false },
      ],
      whatsapp: "+58 414 555 0123",
      reglamento: [
        "Cada dupla juega mínimo 2 partidos.",
        "Partidos al mejor de 3 sets con punto de oro y súper tie-break en el tercero.",
        "Tolerancia de 10 minutos: pasado ese tiempo se da W.O.",
        "Es obligatorio jugar con la franela oficial del torneo.",
        "Ningún jugador puede inscribirse por debajo de su categoría del ranking FVP.",
        "La inscripción no es reembolsable una vez publicado el cuadro.",
      ].join("\n"),
    },
  };

  // Seis duplas ya confirmadas en 5ta y 4ta masculino, y cinco esperando al staff.
  const lista: Inscripcion[] = [];
  const hoyInsc = sumarDias(hoy, 0);
  const nueva = (categoriaId: string, a: JugadorInscripcion, b: JugadorInscripcion, pago: { metodoId: string; referencia?: string } | null) => {
    const v = validarInscripcion(t, { categoriaId, jugadores: [a, b], aceptaReglamento: true, pago }, lista, null, hoyInsc);
    if (v.errores.length) return null;
    const i = crearInscripcion(t, { categoriaId, jugadores: [a, b], aceptaReglamento: true, pago }, v.jugadores, v.fvp);
    lista.push(i);
    return i;
  };
  const confirmadas: [string, number, number][] = [["M-5TA", 0, 1], ["M-5TA", 2, 3], ["M-5TA", 6, 7], ["M-4TA", 16, 17], ["M-4TA", 18, 19], ["M-4TA", 20, 21]];
  for (const [k, [cat, a, b]] of confirmadas.entries()) {
    const i = nueva(cat, jug(a), jug(b), { metodoId: "pm", referencia: `00${4510 + k}` });
    if (!i) continue;
    const r = confirmarEnTorneo(t, i, null);
    t = r.torneo;
    Object.assign(i, { estado: "CONFIRMADA", duplaId: r.duplaId, revisadaPor: "Staff La Marina" });
  }
  nueva("M-5TA", jug(14), jug(15), { metodoId: "pm", referencia: "004871" });
  nueva("F-5TA", jug(8), jug(9), { metodoId: "zelle", referencia: "ZL-88213" });
  nueva("X-5TA", jug(4), jug(10), { metodoId: "efectivo" });
  nueva("M-4TA", jug(22), jug(23), null);
  nueva("F-6TA", jug(12), jug(13), { metodoId: "pm", referencia: "" });

  await getTorneosRepository().guardar({ ...t, actualizadoEn: new Date().toISOString() });
  const base = Date.now();
  for (const [n, i] of lista.entries()) {
    const en = new Date(base - (lista.length - n) * 3_600_000 * 5).toISOString();
    await guardarInscripcion({ ...i, creadaEn: en, actualizadaEn: en });
  }
  return lista.length;
}

/** Borra las inscripciones de los torneos de prueba (el torneo se borra aparte). */
export async function borrarDemoInscripcion(torneoIds: string[]): Promise<void> {
  const repo = getTorneosRepository();
  for (const id of torneoIds)
    for (const i of await listarInscripciones(id)) {
      await repo.borrarExtra(`insc:${id}:${i.id}`);
      await repo.borrarExtra(`insc-comp:${id}:${i.id}`);
    }
}
