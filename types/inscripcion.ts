/**
 * Inscripción online de duplas a un torneo (página pública /inscripcion/:torneoId).
 *
 * La configuración (precio, qué incluye, métodos de pago, reglamento, WhatsApp) vive en
 * `Torneo.inscripcion` y es pública. Cada inscripción se guarda aparte del torneo
 * (tabla `eventos_extras`, tipo "inscripcion") porque trae datos personales que solo ve
 * el staff. Cuando el staff confirma el pago, la dupla entra al torneo como cualquier otra.
 */
import type { Genero } from "./americano";
import type { NivelTorneo } from "./torneo";

export type Talla = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export type LadoJuego = "DRIVE" | "REVES" | "AMBOS";

export type TipoMetodoPago = "PAGO_MOVIL" | "TRANSFERENCIA" | "ZELLE" | "BINANCE" | "EFECTIVO" | "OTRO";

export interface DatoPago {
  /** "Banco", "Teléfono", "Cédula / RIF", "Correo"… */
  etiqueta: string;
  valor: string;
}

export interface MetodoPago {
  id: string;
  tipo: TipoMetodoPago;
  /** Nombre que ve el jugador ("Pago Móvil Banesco"). */
  titulo: string;
  datos: DatoPago[];
  /** Indicación extra ("Monto en bolívares a tasa BCV del día"). */
  nota?: string;
  /** Pide número de referencia (no aplica a efectivo). */
  pideReferencia: boolean;
}

export interface ConfigInscripcion {
  /** Inscripción abierta al público. */
  abierta: boolean;
  /** YYYY-MM-DD: último día para inscribirse (incluido). */
  cierre?: string | null;
  /** Precio por dupla en USD. 0 = gratis. */
  precioDupla: number;
  /** Frase destacada ("Torneo Estadal · 500 pts para el ranking FVP"). */
  destacado?: string;
  /** Texto de presentación. */
  descripcion?: string;
  /** Qué incluye ("Franela oficial", "2 juegos garantizados"…). */
  incluye: string[];
  /** Premios ("Premios en metálico y trofeos"). */
  premios?: string;
  metodosPago: MetodoPago[];
  /** WhatsApp de ayuda (solo dígitos con código de país: 584141234567). */
  whatsapp?: string;
  /** Reglamento en texto (cada línea, un punto). */
  reglamento?: string;
  /** Enlace a un PDF o página con el reglamento completo. */
  reglamentoUrl?: string;
  instagram?: string;
  /** Categorías abiertas a inscripción online (vacío = todas las del torneo). */
  categorias?: string[];
  /** Pedir talla de franela (si el torneo la regala). */
  pideTalla: boolean;
}

export interface JugadorInscripcion {
  nombre: string;
  apellido: string;
  /** "V-12345678" */
  cedula: string;
  correo: string;
  telefono: string;
  genero: Genero;
  /** YYYY-MM-DD. Solo se pide en Master y Junior. */
  fechaNacimiento?: string | null;
  talla?: Talla | null;
  lado: LadoJuego;
  /** "4ta", "5ta FVP"… */
  categoriaHabitual?: string;
  /** Liga o torneo donde juega. */
  liga?: string;
  /** Últimos torneos jugados y resultados. */
  historial?: string;
  /** Alergias o restricciones alimenticias ("Ninguna" si no tiene). */
  alergias: string;
}

/**
 * - PENDIENTE_PAGO: se inscribieron y aún no reportan el pago (o pagan en el club).
 * - PAGO_REPORTADO: mandaron referencia o comprobante; el staff lo verifica.
 * - CONFIRMADA: pago verificado, la dupla ya está en el torneo.
 * - RECHAZADA: el staff la rechazó (con motivo).
 */
export type EstadoInscripcion = "PENDIENTE_PAGO" | "PAGO_REPORTADO" | "CONFIRMADA" | "RECHAZADA";

export interface PagoReportado {
  metodoId: string;
  referencia?: string;
  /** Hay una foto del comprobante (se guarda aparte). */
  comprobante: boolean;
  reportadoEn: string;
}

export interface Inscripcion {
  id: string;
  /** Código corto que recibe la dupla ("LM-7K4Q"). */
  codigo: string;
  torneoId: string;
  categoriaId: string;
  jugadores: [JugadorInscripcion, JugadorInscripcion];
  aceptaReglamento: true;
  pago?: PagoReportado | null;
  estado: EstadoInscripcion;
  /** Lo que dice el ranking FVP de cada uno al inscribirse (null = no aparece). */
  fvp?: { categorias: [NivelTorneo | null, NivelTorneo | null]; lista?: string | null } | null;
  /** Motivo del rechazo o nota del staff. */
  nota?: string;
  revisadaPor?: string;
  /** Dupla creada en el torneo al confirmar. */
  duplaId?: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

/** Cupos de una categoría como los ve el público. */
export interface CupoCategoria {
  id: string;
  nombre: string;
  grupo: string;
  /** null = sin cupo máximo. */
  cupo: number | null;
  /** Duplas inscritas + inscripciones en curso. */
  ocupados: number;
  pideEdad: boolean;
  rama: "MASCULINO" | "FEMENINO" | "MIXTO";
  nivel?: NivelTorneo;
}

/** GET /api/inscripciones/:torneoId */
export interface ApiInscripcionPublica {
  torneo: { id: string; nombre: string; dias: { fecha: string; inicio: string; fin: string }[]; sede: string; estado: string; patrocinadores: { id: string; nombre: string; logo?: string | null; principal?: boolean }[] };
  config: ConfigInscripcion | null;
  /** Abierta de verdad: configurada, no vencida y con el torneo en inscripción. */
  abierta: boolean;
  motivoCerrada?: string;
  categorias: CupoCategoria[];
  /** Solo para el staff. */
  inscripciones?: Inscripcion[];
}
