import type { Categoria, MetodoPuntuacion, Modalidad, Nivel, Rama } from "@/types/americano";

export const RAMAS: { id: Rama; label: string }[] = [
  { id: "FEMENINO", label: "Femenino" },
  { id: "MASCULINO", label: "Masculino" },
  { id: "MIXTO", label: "Mixto" },
];

export const NIVELES: Nivel[] = ["7MA", "6TA", "5TA", "4TA", "3RA", "2DA", "OPEN"];

/** Niveles de cada rama: en Femenino no existe 2da (de 3ra se pasa a Open). */
export function nivelesPara(rama: Rama): Nivel[] {
  return rama === "FEMENINO" ? NIVELES.filter((n) => n !== "2DA") : NIVELES;
}

const NIVEL_LABEL: Record<Nivel, string> = {
  "7MA": "7ma",
  "6TA": "6ta",
  "5TA": "5ta",
  "4TA": "4ta",
  "3RA": "3ra",
  "2DA": "2da",
  OPEN: "Open",
};

/** Rating base por nivel, usado para balancear parejas (7ma = 1 … Open = 7). */
export const RATING_NIVEL: Record<Nivel, number> = {
  "7MA": 1,
  "6TA": 2,
  "5TA": 3,
  "4TA": 4,
  "3RA": 5,
  "2DA": 6,
  OPEN: 7,
};

/** Número de la categoría para las sumas (7ma = 7 … 2da = 2, Open = 1). */
export const NUMERO_NIVEL: Record<Nivel, number> = {
  "7MA": 7,
  "6TA": 6,
  "5TA": 5,
  "4TA": 4,
  "3RA": 3,
  "2DA": 2,
  OPEN: 1,
};

/** Sumas posibles (Open + Open = 2 … 7ma + 7ma = 14). */
export const LIMITES_SUMA = { min: 2, max: 14 };

export function nivelLabel(nivel: Nivel, rama?: Rama): string {
  if (nivel === "OPEN" && rama === "MIXTO") return "Open Mixto";
  return NIVEL_LABEL[nivel];
}

export const esSuma = (c: Pick<Categoria, "suma">) => typeof c.suma === "number" && c.suma > 0;

/** Suma de categorías de una pareja (ej. 4ta + 5ta = 9). */
export function sumaPareja(a?: Nivel, b?: Nivel): number | null {
  return a && b ? NUMERO_NIVEL[a] + NUMERO_NIVEL[b] : null;
}

/** La pareja cumple la suma si no es más fuerte que lo permitido (suma ≥ N). */
export function cumpleSuma(c: Pick<Categoria, "suma">, a?: Nivel, b?: Nivel): boolean {
  const s = sumaPareja(a, b);
  return !esSuma(c) || s === null || s >= c.suma!;
}

/** Ejemplos legibles de parejas que dan exactamente la suma (ej. "4ta + 5ta · 3ra + 6ta"). */
export function ejemplosSuma(suma: number): string {
  const out: string[] = [];
  for (let a = 1; a <= 7; a++) {
    const b = suma - a;
    if (b < a || b > 7) continue;
    const na = NIVELES.find((n) => NUMERO_NIVEL[n] === a)!;
    const nb = NIVELES.find((n) => NUMERO_NIVEL[n] === b)!;
    out.push(`${NIVEL_LABEL[nb]} + ${NIVEL_LABEL[na]}`);
  }
  return out.slice(0, 3).join(" · ");
}

/** Nivel por defecto de los jugadores en una categoría por suma (Suma 9 → 5ta). */
export function nivelParaSuma(suma: number): Nivel {
  const n = Math.min(7, Math.max(1, Math.ceil(suma / 2)));
  return NIVELES.find((x) => NUMERO_NIVEL[x] === n)!;
}

export function categoriaLabel(c: Categoria): string {
  if (c.nombre?.trim()) return c.nombre.trim();
  const rama = RAMAS.find((r) => r.id === c.rama)?.label ?? c.rama;
  if (esSuma(c)) return `${rama} Suma ${c.suma}`;
  return c.nivel === "OPEN" && c.rama === "MIXTO" ? "Open Mixto" : `${rama} ${NIVEL_LABEL[c.nivel]}`;
}

/** Etiqueta corta de la categoría base, para mostrar junto a un nombre personalizado. */
export function categoriaBase(c: Categoria): string {
  return categoriaLabel({ ...c, nombre: null });
}

export const MODALIDADES: { id: Modalidad; label: string; descripcion: string }[] = [
  {
    id: "INDIVIDUAL_ROTATIVO",
    label: "Individual",
    descripcion: "Americano tradicional: cambias de pareja cada ronda y sumas puntos individuales. En categoría Mixto, siempre hombre + mujer.",
  },
  {
    id: "DUPLA_FIJA",
    label: "Dupla Fija",
    descripcion: "Parejas inscritas que juegan todos contra todos. En categoría Mixto, cada pareja es hombre + mujer.",
  },
];

/**
 * Formatos tal como los ve el staff. Mixto no es un formato sino una categoría:
 * en Mixto, Individual arma siempre hombre + mujer y Dupla fija pide duplas mixtas.
 */
export type Formato = "INDIVIDUAL" | "DUPLA_FIJA";

export function formatosPara(rama: Rama): { id: Formato; label: string; descripcion: string }[] {
  const mixto = rama === "MIXTO";
  return [
    {
      id: "INDIVIDUAL",
      label: mixto ? "Individual mixto" : "Individual",
      descripcion: mixto
        ? "Cada ronda, un hombre + una mujer al azar, sin repetir pareja. Puntos individuales."
        : "Americano tradicional: cambias de pareja cada ronda y sumas puntos individuales.",
    },
    {
      id: "DUPLA_FIJA",
      label: mixto ? "Dupla fija mixta" : "Dupla fija",
      descripcion: mixto ? "Duplas inscritas (hombre + mujer) que juegan todas contra todas." : "Duplas inscritas que juegan todas contra todas.",
    },
  ];
}

export const FORMATOS = formatosPara("MASCULINO");

export function formatoDe(modalidad: Modalidad): Formato {
  return modalidad === "DUPLA_FIJA" ? "DUPLA_FIJA" : "INDIVIDUAL";
}

export function formatoLabel(modalidad: Modalidad, rama: Rama): string {
  return formatosPara(rama).find((x) => x.id === formatoDe(modalidad))!.label;
}

export const METODOS: { id: MetodoPuntuacion; label: string; descripcion: string }[] = [
  { id: "PUNTOS_TOTALES", label: "Puntos", descripcion: "Se cuentan puntos: 24 en total, a 13, o lo que quieran." },
  { id: "GAMES_PUNTO_ORO", label: "Games", descripcion: "Se cuentan games, con tie-break opcional si empatan." },
  { id: "SETS_CORTOS", label: "Sets", descripcion: "Sets a 4 o 6 games, al mejor de 3, con super tie opcional." },
];
