/**
 * Inscripción online: reglas puras que comparten la página pública, la API y el panel del staff.
 *
 * Flujo: la dupla llena el formulario → queda "Pendiente de pago" o "Pago por verificar"
 * (si mandó referencia o comprobante) → el staff confirma el pago y la dupla entra al
 * torneo con `inscribirDupla`, como si la hubiera cargado a mano.
 */
import type { CategoriaTorneo, JugadorTorneo, NivelTorneo, Torneo, VerificacionFvp } from "@/types/torneo";
import type {
  ConfigInscripcion,
  CupoCategoria,
  EstadoInscripcion,
  Inscripcion,
  JugadorInscripcion,
  LadoJuego,
  MetodoPago,
  Talla,
  TipoMetodoPago,
} from "@/types/inscripcion";
import type { AtletaFvp } from "@/types/ranking";
import { nombreCategoria, validarDupla } from "./torneo/categorias.ts";
import { anioTorneo, categoria, inscribirDupla, nuevoId } from "./torneo/torneo.ts";
import { claveCedula, etiquetaNivel, formatoCedula, puedeJugar } from "./ranking/fvp.ts";

export const TALLAS: Talla[] = ["XS", "S", "M", "L", "XL", "XXL"];

export const LADOS: { id: LadoJuego; label: string }[] = [
  { id: "DRIVE", label: "Derecha" },
  { id: "REVES", label: "Revés" },
  { id: "AMBOS", label: "Ambos" },
];

export const TIPOS_PAGO: { id: TipoMetodoPago; label: string; pideReferencia: boolean; datos: string[] }[] = [
  { id: "PAGO_MOVIL", label: "Pago Móvil", pideReferencia: true, datos: ["Banco", "Teléfono", "Cédula / RIF"] },
  { id: "TRANSFERENCIA", label: "Transferencia", pideReferencia: true, datos: ["Banco", "Cuenta", "Titular", "Cédula / RIF"] },
  { id: "ZELLE", label: "Zelle", pideReferencia: true, datos: ["Correo", "Titular"] },
  { id: "BINANCE", label: "Binance Pay", pideReferencia: true, datos: ["Pay ID", "Correo"] },
  { id: "EFECTIVO", label: "Efectivo en el club", pideReferencia: false, datos: [] },
  { id: "OTRO", label: "Otro", pideReferencia: true, datos: [] },
];

export const ESTADOS_INSCRIPCION: Record<EstadoInscripcion, { label: string; corto: string }> = {
  PENDIENTE_PAGO: { label: "Pendiente de pago", corto: "Sin pago" },
  PAGO_REPORTADO: { label: "Pago por verificar", corto: "Por verificar" },
  CONFIRMADA: { label: "Confirmada", corto: "Confirmada" },
  RECHAZADA: { label: "Rechazada", corto: "Rechazada" },
};

export const MAX_INSCRIPCIONES_TORNEO = 600;
export const MAX_COMPROBANTE = 450_000;

export function configInscripcionBase(): ConfigInscripcion {
  return {
    abierta: false,
    cierre: null,
    precioDupla: 0,
    destacado: "",
    descripcion: "",
    incluye: ["2 juegos garantizados", "Pelotas nuevas por partido", "Hidratación en pista", "Franela oficial del torneo"],
    premios: "",
    metodosPago: [
      { id: "pm", tipo: "PAGO_MOVIL", titulo: "Pago Móvil", datos: [{ etiqueta: "Banco", valor: "" }, { etiqueta: "Teléfono", valor: "" }, { etiqueta: "Cédula / RIF", valor: "" }], nota: "Monto en bolívares a tasa BCV del día.", pideReferencia: true },
      { id: "zelle", tipo: "ZELLE", titulo: "Zelle", datos: [{ etiqueta: "Correo", valor: "" }, { etiqueta: "Titular", valor: "" }], pideReferencia: true },
      { id: "efectivo", tipo: "EFECTIVO", titulo: "Efectivo en el club", datos: [], nota: "Paga en la recepción de La Marina antes del cierre de inscripciones.", pideReferencia: false },
    ],
    whatsapp: "",
    reglamento: "",
    reglamentoUrl: "",
    instagram: "lamarinasportclub",
    categorias: [],
    pideTalla: true,
  };
}

/** Hoy en Venezuela (UTC-4), YYYY-MM-DD. */
export const hoyVenezuela = (ahora = Date.now()) => new Date(ahora - 4 * 3600_000).toISOString().slice(0, 10);

/** ¿Se puede inscribir hoy? Devuelve el motivo si no. */
export function aperturaInscripcion(t: Torneo, hoy = hoyVenezuela()): { abierta: boolean; motivo?: string } {
  const c = t.inscripcion;
  if (t.eliminado) return { abierta: false, motivo: "Este torneo ya no existe." };
  if (!c?.abierta) return { abierta: false, motivo: "Las inscripciones online están cerradas." };
  if (t.estado !== "INSCRIPCION") return { abierta: false, motivo: "El torneo ya está programado: las inscripciones cerraron." };
  if (c.cierre && hoy > c.cierre) return { abierta: false, motivo: "La fecha de inscripción ya pasó." };
  if (!categoriasInscribibles(t).length) return { abierta: false, motivo: "No hay categorías abiertas." };
  return { abierta: true };
}

export function categoriasInscribibles(t: Torneo): CategoriaTorneo[] {
  const ids = t.inscripcion?.categorias ?? [];
  return t.categorias.map((c) => c.categoria).filter((c) => !ids.length || ids.includes(c.id));
}

/** Inscripciones que todavía ocupan cupo (no rechazadas ni ya convertidas en dupla). */
const enCurso = (lista: Inscripcion[]) => lista.filter((i) => i.estado === "PENDIENTE_PAGO" || i.estado === "PAGO_REPORTADO");

const GRUPO: Record<CategoriaTorneo["tipo"], string> = { NIVEL: "", MASTER: "Master", JUNIOR: "Junior", LIBRE: "Otras" };
const RAMA: Record<CategoriaTorneo["rama"], string> = { MASCULINO: "Masculino", FEMENINO: "Femenino", MIXTO: "Mixto" };

export function cuposCategorias(t: Torneo, inscripciones: Inscripcion[]): CupoCategoria[] {
  const vivas = enCurso(inscripciones);
  return categoriasInscribibles(t).map((c) => {
    const ct = categoria(t, c.id)!;
    return {
      id: c.id,
      nombre: nombreCategoria(c),
      grupo: GRUPO[c.tipo] ? `${GRUPO[c.tipo]} ${RAMA[c.rama]}` : RAMA[c.rama],
      cupo: ct.cupo ?? null,
      ocupados: ct.duplas.filter((d) => d.estado === "ACTIVA").length + vivas.filter((i) => i.categoriaId === c.id).length,
      pideEdad: c.tipo === "MASTER" || c.tipo === "JUNIOR",
      rama: c.rama,
      nivel: c.nivel,
    };
  });
}

export const libres = (c: CupoCategoria) => (c.cupo == null ? null : Math.max(0, c.cupo - c.ocupados));

/* ---------- validación ---------- */

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const limpio = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
const multilinea = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\r/g, "").trim().slice(0, max) : "");

/** Nombre propio con mayúscula inicial: "carlos  MENDOZA" → "Carlos Mendoza". */
export const nombrePropio = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    .trim();

/** Solo dígitos y un + inicial: "+58 (414) 123-4567" → "+584141234567". */
export const limpiarTelefono = (s: string) => {
  const d = s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return d.startsWith("0") ? `+58${d.slice(1)}` : d;
};

export function normalizarJugador(x: unknown, pideTalla: boolean): JugadorInscripcion {
  const j = (x ?? {}) as Record<string, unknown>;
  return {
    nombre: nombrePropio(limpio(j.nombre, 50)),
    apellido: nombrePropio(limpio(j.apellido, 50)),
    cedula: limpio(j.cedula, 20) ? formatoCedula(limpio(j.cedula, 20)) : "",
    correo: limpio(j.correo, 120).toLowerCase(),
    telefono: limpiarTelefono(limpio(j.telefono, 25)),
    genero: j.genero === "F" ? "F" : j.genero === "M" ? "M" : (undefined as unknown as "M"),
    fechaNacimiento: typeof j.fechaNacimiento === "string" && FECHA.test(j.fechaNacimiento) ? j.fechaNacimiento : null,
    talla: pideTalla && TALLAS.includes(j.talla as Talla) ? (j.talla as Talla) : null,
    lado: LADOS.some((l) => l.id === j.lado) ? (j.lado as LadoJuego) : (undefined as unknown as LadoJuego),
    categoriaHabitual: limpio(j.categoriaHabitual, 60),
    liga: limpio(j.liga, 120),
    historial: multilinea(j.historial, 500),
    alergias: limpio(j.alergias, 200),
  };
}

/** Errores de un jugador, por campo (para marcarlos en el formulario). */
export function erroresJugador(j: JugadorInscripcion, opciones: { pideTalla: boolean; pideEdad: boolean }): Partial<Record<keyof JugadorInscripcion, string>> {
  const e: Partial<Record<keyof JugadorInscripcion, string>> = {};
  if (j.nombre.length < 2) e.nombre = "Escribe el nombre.";
  if (j.apellido.length < 2) e.apellido = "Escribe el apellido.";
  if (!claveCedula(j.cedula)) e.cedula = "Cédula inválida (ej. V-18456789).";
  if (!CORREO.test(j.correo)) e.correo = "Correo inválido.";
  if (j.telefono.replace(/\D/g, "").length < 10) e.telefono = "Teléfono con código de área (ej. 0414 123 4567).";
  if (j.genero !== "M" && j.genero !== "F") e.genero = "Elige masculino o femenino.";
  if (opciones.pideEdad && !j.fechaNacimiento) e.fechaNacimiento = "Esta categoría pide fecha de nacimiento.";
  if (opciones.pideTalla && !j.talla) e.talla = "Elige la talla.";
  if (!j.lado) e.lado = "Elige el lado.";
  if (!j.alergias) e.alergias = "Escribe \"Ninguna\" si no tienes.";
  return e;
}

export interface EntradaInscripcion {
  categoriaId: string;
  jugadores: [unknown, unknown];
  aceptaReglamento: boolean;
  pago?: { metodoId?: string; referencia?: string } | null;
  comprobante?: boolean;
}

/** Jugador de inscripción visto como jugador de torneo (para las reglas de categoría). */
const comoJugadorTorneo = (j: JugadorInscripcion, id: string): JugadorTorneo => ({
  id,
  nombre: j.nombre,
  apellido: j.apellido,
  genero: j.genero,
  fechaNacimiento: j.fechaNacimiento ?? null,
  cedula: j.cedula,
  telefono: j.telefono,
  lado: j.lado === "AMBOS" ? undefined : j.lado,
});

export const nombreInscrito = (j: Pick<JugadorInscripcion, "nombre" | "apellido">) => `${j.nombre} ${j.apellido}`.trim();

/**
 * Valida una inscripción nueva contra el torneo, los cupos, las inscripciones previas y el ranking FVP.
 * `buscarFvp` null = no hay lista cargada (los jugadores quedan por verificar).
 */
export function validarInscripcion(
  t: Torneo,
  entrada: EntradaInscripcion,
  previas: Inscripcion[],
  buscarFvp: ((cedula: string) => AtletaFvp | null) | null,
  hoy = hoyVenezuela(),
): { errores: string[]; jugadores: [JugadorInscripcion, JugadorInscripcion]; fvp: [NivelTorneo | null, NivelTorneo | null] } {
  const cfg = t.inscripcion;
  const pideTalla = !!cfg?.pideTalla;
  const jugadores = [normalizarJugador(entrada.jugadores?.[0], pideTalla), normalizarJugador(entrada.jugadores?.[1], pideTalla)] as [JugadorInscripcion, JugadorInscripcion];
  const fvp: [NivelTorneo | null, NivelTorneo | null] = [null, null];
  const errores: string[] = [];
  const ap = aperturaInscripcion(t, hoy);
  if (!ap.abierta) return { errores: [ap.motivo!], jugadores, fvp };
  const cat = categoriasInscribibles(t).find((c) => c.id === entrada.categoriaId);
  if (!cat) return { errores: ["Elige una categoría del torneo."], jugadores, fvp };
  const cupo = cuposCategorias(t, previas).find((c) => c.id === cat.id)!;
  if (libres(cupo) === 0) errores.push(`No quedan cupos en ${cupo.nombre}.`);

  const pideEdad = cat.tipo === "MASTER" || cat.tipo === "JUNIOR";
  jugadores.forEach((j, i) => {
    const e = erroresJugador(j, { pideTalla, pideEdad });
    for (const m of Object.values(e)) errores.push(`Jugador ${i + 1}: ${m}`);
  });
  if (errores.length) return { errores, jugadores, fvp };

  const [a, b] = jugadores;
  if (claveCedula(a.cedula) === claveCedula(b.cedula)) errores.push("Los dos jugadores tienen la misma cédula.");
  const regla = validarDupla(cat, comoJugadorTorneo(a, "a"), comoJugadorTorneo(b, "b"), anioTorneo(t));
  if (regla) errores.push(regla);

  // Nadie se inscribe dos veces en la misma categoría (ni online ni cargado por el staff).
  const ct = categoria(t, cat.id)!;
  const yaEnTorneo = new Set(
    ct.duplas
      .filter((d) => d.estado === "ACTIVA")
      .flatMap((d) => d.jugadorIds.map((id) => claveCedula(t.jugadores.find((x) => x.id === id)?.cedula)))
      .filter(Boolean),
  );
  const yaOnline = new Set(enCurso(previas).filter((i) => i.categoriaId === cat.id).flatMap((i) => i.jugadores.map((j) => claveCedula(j.cedula))));
  for (const j of jugadores) {
    const c = claveCedula(j.cedula);
    if (yaEnTorneo.has(c) || yaOnline.has(c)) errores.push(`${nombreInscrito(j)} (${j.cedula}) ya está inscrito en ${cupo.nombre}.`);
  }

  // Ranking FVP: en categorías por nivel nadie juega por debajo de su categoría. Quien no aparece, igual se inscribe.
  if (buscarFvp) {
    jugadores.forEach((j, i) => {
      const atleta = buscarFvp(j.cedula);
      fvp[i] = atleta?.categoria ?? null;
      if (cat.tipo === "NIVEL" && cat.nivel && atleta?.categoria && !puedeJugar(cat.nivel, atleta.categoria))
        errores.push(`${nombreInscrito(j)} es ${etiquetaNivel(atleta.categoria)} en el ranking FVP: no puede jugar ${cupo.nombre}. Elige ${etiquetaNivel(atleta.categoria)} o una más alta.`);
    });
  }

  if (!entrada.aceptaReglamento) errores.push("Deben aceptar el reglamento del torneo.");
  const metodo = entrada.pago?.metodoId ? cfg?.metodosPago.find((m) => m.id === entrada.pago!.metodoId) : null;
  if (entrada.pago?.metodoId && !metodo) errores.push("Ese método de pago ya no está disponible.");
  return { errores, jugadores, fvp };
}

/** Código corto para la dupla: sin letras que se confunden (0/O, 1/I/L). */
export function codigoInscripcion(): string {
  const abc = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const b = new Uint32Array(4);
  globalThis.crypto.getRandomValues(b);
  return `LM-${[...b].map((x) => abc[x % abc.length]).join("")}`;
}

/** Estado inicial: si reportó pago (referencia, comprobante) o es gratis, queda por verificar. */
export function estadoInicial(t: Torneo, entrada: EntradaInscripcion): EstadoInscripcion {
  const metodo = t.inscripcion?.metodosPago.find((m) => m.id === entrada.pago?.metodoId);
  if (!(t.inscripcion?.precioDupla ?? 0)) return "PAGO_REPORTADO";
  if (metodo && (entrada.comprobante || (metodo.pideReferencia && limpio(entrada.pago?.referencia, 60)))) return "PAGO_REPORTADO";
  return "PENDIENTE_PAGO";
}

export function crearInscripcion(t: Torneo, entrada: EntradaInscripcion, jugadores: [JugadorInscripcion, JugadorInscripcion], fvp: [NivelTorneo | null, NivelTorneo | null], lista?: string | null): Inscripcion {
  const ahora = new Date().toISOString();
  const metodoId = entrada.pago?.metodoId && t.inscripcion?.metodosPago.some((m) => m.id === entrada.pago!.metodoId) ? entrada.pago.metodoId : null;
  return {
    id: nuevoId("i-"),
    codigo: codigoInscripcion(),
    torneoId: t.id,
    categoriaId: entrada.categoriaId,
    jugadores,
    aceptaReglamento: true,
    pago: metodoId ? { metodoId, referencia: limpio(entrada.pago?.referencia, 60) || undefined, comprobante: !!entrada.comprobante, reportadoEn: ahora } : null,
    estado: estadoInicial(t, entrada),
    fvp: { categorias: fvp, lista: lista ?? null },
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
}

/**
 * Pasa la inscripción al torneo: reusa al jugador si ya está en el padrón (misma cédula),
 * y crea la dupla en la categoría con su chequeo FVP.
 */
export function confirmarEnTorneo(t: Torneo, insc: Inscripcion, fvp: VerificacionFvp | null): { torneo: Torneo; duplaId: string } {
  const padron = new Map(t.jugadores.filter((j) => claveCedula(j.cedula)).map((j) => [claveCedula(j.cedula)!, j]));
  const [a, b] = insc.jugadores.map((j) => {
    const previo = padron.get(claveCedula(j.cedula)!);
    return { ...comoJugadorTorneo(j, previo?.id ?? nuevoId("j-")), fotoUrl: previo?.fotoUrl ?? null, usuarioId: previo?.usuarioId ?? null };
  });
  const duplaId = nuevoId("d-");
  const torneo = inscribirDupla(t, insc.categoriaId, a, b, { id: duplaId, ...(fvp ? { fvp } : {}) });
  return { torneo, duplaId };
}

/* ---------- panel del staff ---------- */

export function resumenInscripciones(lista: Inscripcion[], cfg?: ConfigInscripcion | null) {
  const por = (e: EstadoInscripcion) => lista.filter((i) => i.estado === e).length;
  const vivas = lista.filter((i) => i.estado !== "RECHAZADA");
  const tallas = Object.fromEntries(TALLAS.map((x) => [x, 0])) as Record<Talla, number>;
  for (const i of vivas) for (const j of i.jugadores) if (j.talla) tallas[j.talla]++;
  const alergias = vivas.flatMap((i) => i.jugadores.filter((j) => j.alergias && !/^(ninguna?|no|n\/a|-|nada)\.?$/i.test(j.alergias)).map((j) => ({ nombre: nombreInscrito(j), alergias: j.alergias })));
  const precio = cfg?.precioDupla ?? 0;
  return {
    total: vivas.length,
    pendientes: por("PENDIENTE_PAGO"),
    porVerificar: por("PAGO_REPORTADO"),
    confirmadas: por("CONFIRMADA"),
    rechazadas: por("RECHAZADA"),
    cobrado: por("CONFIRMADA") * precio,
    porCobrar: (por("PENDIENTE_PAGO") + por("PAGO_REPORTADO")) * precio,
    tallas,
    alergias,
  };
}

const celdaCsv = (x: unknown) => {
  const s = String(x ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV para Excel (separado por punto y coma, con BOM para los acentos). */
export function csvInscripciones(t: Torneo, lista: Inscripcion[]): string {
  const cat = (id: string) => {
    const c = t.categorias.find((x) => x.categoria.id === id)?.categoria;
    return c ? nombreCategoria(c) : id;
  };
  const metodo = (id?: string) => t.inscripcion?.metodosPago.find((m) => m.id === id)?.titulo ?? "";
  const cab = ["Código", "Estado", "Categoría", "Inscrita", "Método de pago", "Referencia"];
  const porJugador = ["Nombre", "Apellido", "Cédula", "Correo", "Teléfono", "Género", "Nacimiento", "Talla", "Lado", "Categoría habitual", "Liga", "Historial", "Alergias", "FVP"];
  const filas = [[...cab, ...porJugador.map((x) => `J1 ${x}`), ...porJugador.map((x) => `J2 ${x}`)]];
  for (const i of lista) {
    filas.push([
      i.codigo,
      ESTADOS_INSCRIPCION[i.estado].label,
      cat(i.categoriaId),
      i.creadaEn.slice(0, 16).replace("T", " "),
      metodo(i.pago?.metodoId),
      i.pago?.referencia ?? "",
      ...i.jugadores.flatMap((j, k) => [
        j.nombre,
        j.apellido,
        j.cedula,
        j.correo,
        j.telefono,
        j.genero === "F" ? "F" : "M",
        j.fechaNacimiento ?? "",
        j.talla ?? "",
        LADOS.find((l) => l.id === j.lado)?.label ?? "",
        j.categoriaHabitual ?? "",
        j.liga ?? "",
        j.historial ?? "",
        j.alergias,
        i.fvp?.categorias[k] ? etiquetaNivel(i.fvp.categorias[k]!) : "No aparece",
      ]),
    ]);
  }
  return "﻿" + filas.map((f) => f.map(celdaCsv).join(";")).join("\n");
}

/** Enlace de WhatsApp: acepta "0414-123.45.67", "+58 414…" o "58414…". */
export function enlaceWhatsapp(numero: string, texto?: string): string {
  const tel = limpiarTelefono(numero).replace(/\D/g, "");
  return `https://wa.me/${tel}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** Valida la configuración que guarda el staff (lista vacía = válida). */
export function validarConfigInscripcion(c: unknown): string[] {
  if (c == null) return [];
  const x = c as Partial<ConfigInscripcion>;
  const e: string[] = [];
  if (typeof x.abierta !== "boolean") e.push("inscripcion.abierta debe ser sí o no.");
  if (typeof x.precioDupla !== "number" || x.precioDupla < 0 || x.precioDupla > 100_000) e.push("inscripcion.precioDupla inválido.");
  if (x.cierre != null && !FECHA.test(x.cierre)) e.push("inscripcion.cierre debe ser YYYY-MM-DD.");
  if (!Array.isArray(x.incluye) || x.incluye.length > 20 || x.incluye.some((s) => typeof s !== "string" || s.length > 120)) e.push("inscripcion.incluye: máximo 20 líneas.");
  if (!Array.isArray(x.metodosPago) || x.metodosPago.length > 10) e.push("inscripcion.metodosPago: máximo 10.");
  else if (x.metodosPago.some((m: MetodoPago) => !m?.id || typeof m.titulo !== "string" || m.titulo.length > 80 || !Array.isArray(m.datos) || m.datos.length > 8))
    e.push("Cada método de pago necesita nombre y hasta 8 datos.");
  for (const k of ["destacado", "premios", "whatsapp", "reglamentoUrl", "instagram"] as const)
    if (x[k] != null && (typeof x[k] !== "string" || (x[k] as string).length > 300)) e.push(`inscripcion.${k} muy largo.`);
  for (const k of ["descripcion", "reglamento"] as const) if (x[k] != null && (typeof x[k] !== "string" || (x[k] as string).length > 8000)) e.push(`inscripcion.${k} muy largo.`);
  return e;
}
