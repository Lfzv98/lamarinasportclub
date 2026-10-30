import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Herramientas del asistente. Ninguna se ejecuta en el servidor: cada llamada vuelve
 * al chat como una propuesta que el staff toca para abrir el formulario ya lleno.
 * Todo va como requerido con null para "no lo dijo". No se usa `strict`: estos esquemas pasan el
 * tope de campos opcionales de la API; el cliente valida y normaliza cada propuesta (lib/asistente/ejecutar.ts).
 */
type Esquema = Record<string, unknown>;

const obj = (props: Record<string, Esquema>): Esquema => ({
  type: "object",
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
});
const nulo = (e: Esquema): Esquema => ({ anyOf: [e, { type: "null" }] });
const texto = (description?: string): Esquema => ({ type: "string", ...(description ? { description } : {}) });
const entero = (description?: string): Esquema => ({ type: "integer", ...(description ? { description } : {}) });
const lista = (items: Esquema, description?: string): Esquema => ({ type: "array", items, ...(description ? { description } : {}) });
const enumerado = (valores: string[], description?: string): Esquema => ({ type: "string", enum: valores, ...(description ? { description } : {}) });

const RAMA = enumerado(["FEMENINO", "MASCULINO", "MIXTO"]);
const NIVEL = enumerado(["7MA", "6TA", "5TA", "4TA", "3RA", "2DA", "OPEN"], "En Femenino no existe 2DA.");
const MODALIDAD = enumerado(["INDIVIDUAL_ROTATIVO", "DUPLA_FIJA"], "INDIVIDUAL_ROTATIVO = americano tradicional (y mixto, con rama MIXTO). DUPLA_FIJA = la pareja no cambia.");

const PERSONA = obj({
  nombre: texto("Nombre de pila, con mayúscula inicial."),
  apellido: nulo(texto()),
  genero: nulo(enumerado(["M", "F"], "M hombre, F mujer. Dedúcelo del nombre solo en mixto; si no se puede, null.")),
  nivel: nulo(NIVEL),
});
const DUPLA = obj({ a: PERSONA, b: PERSONA });

const PUNTUACION = obj({
  metodo: enumerado(["PUNTOS_TOTALES", "GAMES_PUNTO_ORO", "SETS_CORTOS"]),
  valor: nulo(entero("Puntos por partido (PUNTOS_TOTALES, ej. 16, 21, 24, 32), games por partido (GAMES_PUNTO_ORO, ej. 4, 6, 9) o games por set (SETS_CORTOS, 4 o 6).")),
  sets: nulo(entero("Solo SETS_CORTOS: 1 o 3.")),
});

const JUGADOR_TORNEO = obj({
  nombre: texto(),
  apellido: nulo(texto()),
  cedula: nulo(texto("Cédula venezolana tal como la dijo, ej. V-12345678.")),
});
const DUPLA_TORNEO = obj({
  categoriaId: texto("Id de la categoría del torneo, ej. M-5TA, F-4TA, X-6TA, M-MASTER40, F-SUB14."),
  a: JUGADOR_TORNEO,
  b: JUGADOR_TORNEO,
  puntos: nulo(entero("Puntos de ranking para la siembra, si los dijo.")),
});

const herramienta = (name: string, description: string, input_schema: Esquema): Anthropic.Beta.BetaTool => ({
  name,
  description,
  input_schema: input_schema as Anthropic.Beta.BetaTool["input_schema"],
});

export const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  herramienta(
    "armar_americano",
    "Llena el asistente 'Nuevo americano' (/setup) con la configuración y los jugadores o duplas, y lo abre en el último paso para que el staff revise y toque 'Empezar'. Úsala para crear un americano o para agregar jugadores/duplas al americano que se está armando. Lo que el staff no dijo va en null y se queda como esté en el borrador.",
    obj({
      reemplazar: { type: "boolean", description: "true = la lista dicha reemplaza a los jugadores del borrador; false = se suman a los que ya hay." },
      nombre: nulo(texto()),
      fecha: nulo(texto("YYYY-MM-DD")),
      horaInicio: nulo(texto("HH:MM, 24 h")),
      horaFin: nulo(texto("HH:MM, 24 h")),
      rama: nulo(RAMA),
      nivel: nulo(NIVEL),
      suma: nulo(entero("Solo categoría por suma (ej. 9 = 4ta + 5ta).")),
      modalidad: nulo(MODALIDAD),
      puntuacion: nulo(PUNTUACION),
      pistas: nulo(lista(entero(), "Números de pista del club.")),
      duracionRondaMin: nulo(entero()),
      jugadores: lista(PERSONA, "Individual o mixto: cada jugador suelto. En dupla fija va vacío."),
      duplas: lista(DUPLA, "Dupla fija: cada pareja. En individual va vacío."),
    }),
  ),
  herramienta(
    "armar_americano_torneo",
    "Llena el asistente 'Nuevo Americano Torneo' (/habibi/nuevo): dos grupos A y B (americanos) y después una llave. Lo abre en el último paso para que el staff revise y toque crear. Si el staff no dijo qué dupla va en cada grupo, repártelas alternando (1ª al A, 2ª al B…).",
    obj({
      reemplazar: { type: "boolean", description: "true = arma el torneo de cero; false = suma estas duplas/jugadores a las que ya están cargadas en la pantalla." },
      nombre: nulo(texto()),
      fecha: nulo(texto("YYYY-MM-DD")),
      hora: nulo(texto("HH:MM de inicio")),
      rama: nulo(RAMA),
      nivel: nulo(NIVEL),
      modalidad: nulo(MODALIDAD),
      grupoA: obj({ duplas: lista(DUPLA), jugadores: lista(PERSONA) }),
      grupoB: obj({ duplas: lista(DUPLA), jugadores: lista(PERSONA) }),
      puntuacionGrupos: nulo(PUNTUACION),
      inicio: nulo(enumerado(["OCTAVOS", "CUARTOS", "SEMIS"], "Dónde arranca la llave.")),
      tercerPuesto: nulo({ type: "boolean" }),
      puntuacionLlave: nulo(PUNTUACION),
    }),
  ),
  herramienta(
    "crear_torneo",
    "Llena 'Nuevo torneo de pádel' (/torneos/nuevo) con nombre, días, pistas y categorías. Al crearlo, si hay duplas, se abre 'Pegar lista' de cada categoría con esas duplas para que el staff las inscriba.",
    obj({
      nombre: texto(),
      fechaInicio: nulo(texto("YYYY-MM-DD del primer día")),
      dias: nulo(entero("Cantidad de días, 1 a 10.")),
      pistas: nulo(lista(entero())),
      categorias: lista(texto(), "Ids de categoría: M-, F- o X- + 7MA…1RA (ej. M-5TA, X-6TA); Master M-MASTER40/45/55 y F-MASTER40/45/55; Junior M-SUB12/13/14/16/18 y F-SUB…"),
      descansoMin: nulo(entero("Descanso mínimo entre partidos de un jugador, en minutos.")),
      toleranciaWO: nulo(entero("Minutos de tolerancia antes del W.O.")),
      duplas: lista(DUPLA_TORNEO),
    }),
  ),
  herramienta(
    "inscribir_duplas_torneo",
    "Abre 'Pegar lista' en las categorías de un torneo que ya existe, con las duplas dichas, para que el staff toque 'Inscribir'. Usa el id del torneo y de la categoría que vienen en el contexto.",
    obj({ torneoId: texto(), duplas: lista(DUPLA_TORNEO) }),
  ),
  herramienta(
    "abrir_pantalla",
    "Lleva al staff a una pantalla de la app (ej. /americanos, /evento/ID, /evento/ID/tv, /habibi/ID, /torneos/ID/programacion, /club). Solo rutas internas que empiecen con /.",
    obj({ ruta: texto(), titulo: texto("Nombre corto de la pantalla, para el botón.") }),
  ),
];

export const NOMBRES_HERRAMIENTAS = new Set(HERRAMIENTAS.map((h) => h.name));
