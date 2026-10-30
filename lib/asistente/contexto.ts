"use client";

/**
 * Foto de lo que está pasando en la app, para que el asistente responda "¿cuántas
 * duplas llevo?" o "¿quién va ganando?" sin inventar. Solo nombres y números:
 * nada de teléfonos, cédulas ni pagos.
 */
import { categoriaLabel, formatoLabel } from "@/lib/categories";
import { DIAS, horarioDelDia } from "@/lib/horarios";
import { descripcionPuntuacion, calcularTabla, nombreCompleto } from "@/lib/scoring";
import { useAmericanos } from "@/lib/store";
import { duplasActivas } from "@/lib/torneo/cuadro";
import { estadoCategoria, nombresCompletosDupla } from "@/lib/torneo/torneo";
import { nombreCategoria } from "@/lib/torneo/categorias";
import { useTorneos } from "@/lib/torneosStore";
import type { EventoAmericano, Jugador, Pareja } from "@/types/americano";
import { contextoPantalla } from "./pantalla";
import type { ContextoAsistente } from "./tipos";

const CLAVE_BORRADOR = "lamarina-setup-borrador";

const hoyIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function persona(j: Jugador): string {
  return `${[j.nombre, j.apellido].filter(Boolean).join(" ")} (${j.genero}${j.nivel ? `, ${j.nivel}` : ""})`;
}

function borradorAmericano() {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "{}") as Record<string, unknown> & { jugadores?: Jugador[]; parejas?: Pareja[]; _t?: number };
    if (!b._t || Date.now() - b._t > 12 * 3600_000) return null;
    const jugadores = b.jugadores ?? [];
    const porId = new Map(jugadores.map((j) => [j.id, j]));
    return {
      nombre: b.nombre || null,
      rama: b.rama ?? null,
      nivel: b.nivel ?? null,
      suma: b.suma ?? null,
      modalidad: b.modalidad ?? null,
      puntuacion: b.puntuacion ?? null,
      pistas: b.seleccion ?? null,
      fecha: b.fecha ?? null,
      horaInicio: b.horaInicio ?? null,
      horaFin: b.horaFin ?? null,
      jugadores: b.modalidad === "DUPLA_FIJA" ? undefined : jugadores.map(persona),
      duplas: b.modalidad === "DUPLA_FIJA" ? (b.parejas ?? []).map((p) => p.jugadorIds.map((id) => (porId.get(id) ? persona(porId.get(id)!) : "?")).join(" / ")) : undefined,
    };
  } catch {
    return null;
  }
}

function resumenEvento(e: EventoAmericano, detalle: boolean) {
  const base = {
    id: e.id,
    nombre: e.nombre,
    categoria: categoriaLabel(e.categoria),
    formato: formatoLabel(e.modalidad, e.categoria.rama),
    puntuacion: descripcionPuntuacion(e.puntuacion),
    fecha: e.fecha,
    horario: `${e.horaInicio}-${e.horaFin}`,
    estado: e.estado,
    ronda: `${e.rondaActual} de ${e.totalRondas}`,
    pistas: e.canchas?.map((c) => c.numero) ?? e.pistas,
    jugadores: e.jugadores.length,
    duplas: e.modalidad === "DUPLA_FIJA" ? e.parejas.length : undefined,
    americanoTorneo: e.habibi ? (e.habibi.rol === "LLAVE" ? "llave" : `grupo ${e.habibi.letra}`) : undefined,
  };
  if (!detalle) return base;
  let ranking: string[] = [];
  try {
    ranking = calcularTabla(e).filas.slice(0, 8).map((f) => `${f.posicion}. ${f.nombre} · PJ ${f.pj} PG ${f.pg} · ${f.puntosAFavor}-${f.puntosEnContra}`);
  } catch {
    /* evento sin partidos */
  }
  return { ...base, nombresJugadores: e.jugadores.map((j) => nombreCompleto(j)), ranking };
}

export function contextoActual(): ContextoAsistente {
  const ruta = typeof location !== "undefined" ? location.pathname : "/";
  const ahora = new Date();
  const { club, eventos } = useAmericanos.getState();
  const { torneos } = useTorneos.getState();
  const hoy = hoyIso(ahora);
  const horario = horarioDelDia(club, hoy);

  const eventoAbierto = ruta.match(/^\/(?:evento|habibi)\/([^/]+)/)?.[1];
  const torneoAbierto = ruta.match(/^\/torneos\/([^/]+)/)?.[1];

  const lista = Object.values(eventos)
    .filter((e) => !e.eliminado && (e.habibi?.rol !== "GRUPO" || e.id === eventoAbierto))
    .filter((e) => e.estado !== "FINALIZADO" || e.fecha >= hoy || e.id === eventoAbierto)
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .slice(0, 12);

  const listaTorneos = Object.values(torneos)
    .filter((t) => !t.eliminado)
    .sort((a, b) => (b.dias[0]?.fecha ?? "").localeCompare(a.dias[0]?.fecha ?? ""))
    .slice(0, 8);

  return {
    ahora: `${hoy} ${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")} (${DIAS[ahora.getDay()] ?? ""})`,
    pantalla: ruta,
    club: {
      nombre: club.nombre,
      pistasActivas: club.pistas.filter((p) => p.activa).map((p) => ({ numero: p.numero, nombre: p.nombre, techada: p.techada })),
      minutosEntreRondas: club.minutosEntreRondas,
      horarioHoy: horario.abierto ? `${horario.apertura}-${horario.cierre}` : "cerrado",
    },
    formularioEnPantalla: contextoPantalla() ?? undefined,
    americanoEnArmado: borradorAmericano(),
    americanos: lista.map((e) => resumenEvento(e, e.id === eventoAbierto)),
    torneos: listaTorneos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      dias: t.dias.map((d) => `${d.fecha} ${d.inicio}-${d.fin}`),
      pistas: t.canchas.map((c) => c.numero),
      categorias: t.categorias.map((c) => ({
        id: c.categoria.id,
        nombre: nombreCategoria(c.categoria),
        estado: estadoCategoria(c),
        duplas: duplasActivas(c.duplas).length,
        nombresDuplas: t.id === torneoAbierto ? duplasActivas(c.duplas).map((d) => nombresCompletosDupla(t, d).join(" / ")) : undefined,
      })),
    })),
  };
}
