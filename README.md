# La Marina Sport Club · Americanos & Torneos

PWA de PadelReserve para organizar americanos y torneos de pádel en La Marina Sport Club: setup en 60 segundos, cuadro vivo con cronómetro, marcador táctil, ranking animado en tiempo real y Modo TV para las pantallas de la terraza y el bar.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Zustand. Lista para Vercel.

## Pantallas

| Ruta | Qué hace |
| --- | --- |
| `/` | Eventos activos e historial, acceso rápido a Modo TV |
| `/setup` | Asistente de 5 pasos: categoría, formato y puntuación, pistas y horario, jugadores, resumen con sorteo |
| `/evento/:id` | Cuadro vivo: rondas con hora, cronómetro con alarma, pistas activas, carga de score |
| `/evento/:id/tabla` | Podio + ranking (PJ, PG, PP, PF, PC, +/-, PTS) con animación de posiciones |
| `/evento/:id/tv` | Dashboard fullscreen 1920×1080 que se escala a cualquier pantalla, con QR para seguir el ranking |
| `/club` | Pistas (techada / exterior / habilitada), horarios por día, contacto |

## Reglas soportadas

- **Categorías:** Femenino, Masculino y Mixto en 7ma, 6ta, 5ta, 4ta, 3ra y Open (Open Mixto).
- **Modalidades:** Individual Rotativo (americano tradicional) y Dupla Fija (todos contra todos).
- **Puntuación:** Puntos totales (16/21/24/32), Games con punto de oro (4/6/9) y Sets cortos a 4 (1 set o mejor de 3).
- **Rotación balanceada** (`lib/rotation.ts`): nadie repite compañero mientras sea posible, se minimizan rivales repetidos, se equilibra el nivel entre parejas, los descansos se reparten parejo y en Mixto cada pareja es hombre + mujer. Es determinista por semilla.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests del algoritmo, marcadores y horarios
npm run typecheck
npm run build
```

Sin variables de entorno corre en **modo DEMO** con `data/mockData.json` (regenerable con `node --experimental-strip-types scripts/generar-mock.ts`). Para conectar Supabase ver [docs/BACKEND.md](docs/BACKEND.md).

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework Next.js, sin configuración extra).
2. Asigna el dominio `lamarinasportclub.vercel.app` en Settings → Domains.
3. (Producción) agrega las variables de Supabase de `.env.example`.

## Estructura

```
app/                 páginas y API routes (app/api/americanos, app/api/club)
components/          UI (ScoreModal, Leaderboard, Cronometro, EventoShell, …)
lib/                 lógica pura: rotation, scoring, evento, horarios, store
lib/server/          repositorio DEMO / Supabase
types/americano.ts   Jugador, Pareja, Partido, Ronda, TablaPosiciones, EventoAmericano, ConfigClub
public/              manifest.json, sw.js, iconos y logo
```
