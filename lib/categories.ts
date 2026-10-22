import type { Categoria, MetodoPuntuacion, Modalidad, Nivel, Rama } from "@/types/americano";

export const RAMAS: { id: Rama; label: string }[] = [
  { id: "FEMENINO", label: "Femenino" },
  { id: "MASCULINO", label: "Masculino" },
  { id: "MIXTO", label: "Mixto" },
];

export const NIVELES: Nivel[] = ["7MA", "6TA", "5TA", "4TA", "3RA", "OPEN"];

const NIVEL_LABEL: Record<Nivel, string> = {
  "7MA": "7ma",
  "6TA": "6ta",
  "5TA": "5ta",
  "4TA": "4ta",
  "3RA": "3ra",
  OPEN: "Open",
};

/** Rating base por nivel, usado para balancear parejas (7ma = 1 … Open = 6). */
export const RATING_NIVEL: Record<Nivel, number> = {
  "7MA": 1,
  "6TA": 2,
  "5TA": 3,
  "4TA": 4,
  "3RA": 5,
  OPEN: 6,
};

export function nivelLabel(nivel: Nivel, rama?: Rama): string {
  if (nivel === "OPEN" && rama === "MIXTO") return "Open Mixto";
  return NIVEL_LABEL[nivel];
}

export function categoriaLabel(c: Categoria): string {
  const rama = RAMAS.find((r) => r.id === c.rama)?.label ?? c.rama;
  return c.nivel === "OPEN" && c.rama === "MIXTO" ? "Open Mixto" : `${rama} ${NIVEL_LABEL[c.nivel]}`;
}

export const MODALIDADES: { id: Modalidad; label: string; descripcion: string }[] = [
  {
    id: "INDIVIDUAL_ROTATIVO",
    label: "Individual Rotativo",
    descripcion: "Americano tradicional: cambias de pareja cada ronda y sumas puntos individuales.",
  },
  {
    id: "DUPLA_FIJA",
    label: "Dupla Fija",
    descripcion: "Parejas inscritas que juegan todos contra todos.",
  },
];

export const METODOS: { id: MetodoPuntuacion; label: string; descripcion: string }[] = [
  { id: "PUNTOS_TOTALES", label: "Puntos Totales", descripcion: "Partido a un total fijo de puntos (ej. 24)." },
  { id: "GAMES_PUNTO_ORO", label: "Games · Punto de Oro", descripcion: "Partido a N games, 40-40 se define con un punto." },
  { id: "SETS_CORTOS", label: "Sets Cortos", descripcion: "Sets a 4 games, al mejor de 3." },
];
