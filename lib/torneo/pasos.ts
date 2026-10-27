/**
 * Los 7 pasos de un torneo, en orden, con lo que falta en cada uno y por qué va ahí.
 * Es la guía del operador: siempre dice en qué paso está el torneo y qué hacer ahora.
 */
import type { Torneo } from "@/types/torneo";
import { nombreCorto } from "./categorias.ts";
import { duplasActivas } from "./cuadro.ts";
import { todosLosPartidos } from "./torneo.ts";

export type EstadoPaso = "HECHO" | "ACTUAL" | "PENDIENTE";

export interface PasoTorneo {
  n: number;
  titulo: string;
  estado: EstadoPaso;
  /** Cómo va, en una frase ("12 duplas en 3 categorías"). */
  detalle: string;
  /** Aviso que hay que atender antes de seguir (null = nada). */
  aviso: string | null;
  porQue: string;
  /** Sección de la app donde se hace (relativa al torneo: "", "/categorias", …). */
  ir: string;
  boton: string;
}

const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function pasosTorneo(t: Torneo): PasoTorneo[] {
  const cats = t.categorias;
  const nombres = (xs: typeof cats) => xs.map((c) => nombreCorto(c.categoria)).join(", ");
  const duplas = cats.reduce((s, c) => s + duplasActivas(c.duplas).length, 0);
  const sinDuplas = cats.filter((c) => duplasActivas(c.duplas).length < 2);
  const fvp = t.validarFvp === false ? 0 : cats.flatMap((c) => duplasActivas(c.duplas)).filter((d) => d.fvp?.estado === "POR_VERIFICAR" || d.fvp?.estado === "BLOQUEADA").length;
  const sorteadas = cats.filter((c) => c.cuadro);
  const sinSorteo = cats.filter((c) => !c.cuadro && duplasActivas(c.duplas).length >= 2);
  const publicadas = cats.filter((c) => c.cuadro?.publicado);
  const sinPublicar = sorteadas.filter((c) => !c.cuadro!.publicado);
  const partidos = todosLosPartidos(t).filter((p) => !p.bye);
  const sinHorario = partidos.filter((p) => p.estado === "PENDIENTE" && !p.programacion && publicadas.some((c) => c.categoria.id === p.categoriaId)).length;
  const turnos = t.arbitros?.turnos?.length ?? 0;
  const jugados = partidos.filter((p) => p.estado === "FINALIZADO").length;
  const porRevisar = partidos.filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR").length;
  const pistas = t.canchas.filter((c) => c.activa).length;
  const terminado = partidos.length > 0 && jugados === partidos.length;
  const inscripcionAbierta = !!t.inscripcion?.abierta;

  const hechos = [
    t.dias.length > 0 && pistas > 0 && cats.length > 0,
    cats.length > 0 && sinDuplas.length === 0 && fvp === 0,
    cats.length > 0 && sorteadas.length === cats.length && !inscripcionAbierta,
    sorteadas.length > 0 && sinPublicar.length === 0 && sinHorario === 0,
    turnos > 0,
    terminado && porRevisar === 0,
    terminado && porRevisar === 0,
  ];
  // Los pasos 1 a 5 se preparan antes; el 6 arranca con el primer partido jugado o en juego.
  const enJuego = partidos.some((p) => p.estado !== "PENDIENTE");
  const actual = enJuego && !hechos[5] ? 5 : hechos.findIndex((h) => !h);
  const estado = (i: number): EstadoPaso => (i === actual ? "ACTUAL" : hechos[i] ? "HECHO" : "PENDIENTE");

  const pasos: Omit<PasoTorneo, "estado" | "n">[] = [
    {
      titulo: "Crear el torneo",
      detalle: `${pl(t.dias.length, "día")} · ${pl(pistas, "pista")} · ${pl(cats.length, "categoría")}`,
      aviso: !cats.length ? "Agrega al menos una categoría." : !pistas ? "Activa al menos una pista." : null,
      porQue: "Todo depende de cuántos días, horas y pistas hay: con eso la app calcula si caben todos los partidos.",
      ir: "/ajustes",
      boton: "Ajustes del torneo",
    },
    {
      titulo: "Inscribir duplas",
      detalle: `${pl(duplas, "dupla")} en ${pl(cats.length, "categoría")}`,
      aviso: sinDuplas.length
        ? `Con menos de 2 duplas no se puede sortear: ${nombres(sinDuplas)}.`
        : fvp
          ? `${pl(fvp, "dupla")} sin verificar en el ranking FVP: revísalas o autoriza la excepción.`
          : null,
      porQue: "El sorteo necesita las duplas definitivas y verificadas. Las restricciones de horario de cada dupla se cargan aquí, antes de programar.",
      ir: "/categorias",
      boton: "Ir a Inscritos",
    },
    {
      titulo: "Cerrar inscripciones y sortear",
      detalle: `${sorteadas.length} de ${pl(cats.length, "categoría")} con sorteo`,
      aviso: inscripcionAbierta
        ? "La inscripción online sigue abierta: ciérrala en Ajustes antes de sortear."
        : sinSorteo.length
          ? `Falta el sorteo de ${nombres(sinSorteo)}.`
          : null,
      porQue: "Una dupla que entra después del sorteo obliga a rehacer el cuadro y los horarios de su categoría.",
      ir: inscripcionAbierta ? "/ajustes" : "/categorias",
      boton: inscripcionAbierta ? "Cerrar inscripción" : "Ir al sorteo",
    },
    {
      titulo: "Programar y publicar horarios",
      detalle: `${publicadas.length} de ${pl(sorteadas.length, "categoría")} publicadas`,
      aviso: sinPublicar.length
        ? `Falta publicar ${nombres(sinPublicar)} (Sorteo → Publicar y programar).`
        : sinHorario
          ? `${pl(sinHorario, "partido")} sin horario: no caben en los días y pistas. Agrega horas, un día o una sede.`
          : null,
      porQue: "Sin cruces no hay partidos que programar. Al publicar, cada jugador ve en «¿Cuándo juego?» su día, hora y pista.",
      ir: sinPublicar.length ? "/categorias" : "/programacion",
      boton: sinPublicar.length ? "Publicar" : "Ver horarios",
    },
    {
      titulo: "Árbitros y mesa técnica",
      detalle: turnos ? `${pl(turnos, "turno")} repartidos` : "Sin turnos",
      aviso: turnos ? null : "Reparte los turnos por pista y marca al árbitro principal en el plantel.",
      porQue: "Cada pista necesita su árbitro con tablet. Los turnos van después de los horarios porque dependen de las franjas de cada día.",
      ir: "/arbitros",
      boton: "Árbitros y turnos",
    },
    {
      titulo: "Día de juego",
      detalle: partidos.length ? `${jugados} de ${pl(partidos.length, "partido")} jugados${porRevisar ? ` · ${porRevisar} por revisar` : ""}` : "Sin partidos todavía",
      aviso: porRevisar ? `${pl(porRevisar, "resultado")} esperando revisión en mesa técnica.` : null,
      porQue: "Es el ciclo de todo el día: mesa técnica llama, el árbitro anota en su tablet y el resultado llega solo a mesa técnica, al cuadro y a la TV.",
      ir: "/mesa",
      boton: "Abrir mesa técnica",
    },
    {
      titulo: "Cierre",
      detalle: terminado ? "Todos los partidos jugados" : "Cuando termine el último partido",
      aviso: null,
      porQue: "Con todo jugado y revisado salen el podio, las estadísticas y el resumen para el club.",
      ir: "/estadisticas",
      boton: "Stats y resumen",
    },
  ];
  return pasos.map((p, i) => ({ ...p, n: i + 1, estado: estado(i) }));
}
