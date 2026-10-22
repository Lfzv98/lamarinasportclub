# Conexión con PadelReserve (para Juan)

La app funciona sola en **modo DEMO** (datos de `data/mockData.json`, guardados en memoria del servidor y en el `localStorage` de cada dispositivo). Para pasar a producción solo hay que conectar Supabase.

## 1. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase de PadelReserve |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor) |
| `SUPABASE_AMERICANOS_TABLE` | Opcional, por defecto `americanos_eventos` |
| `SUPABASE_CLUB_TABLE` | Opcional, por defecto `club_config` |

Con las dos primeras definidas, `getRepository()` cambia de DEMO a SUPABASE automáticamente y el badge de la app pasa de "Demo" a "En línea".

## 2. Tablas

La opción rápida es correr `supabase/schema.sql`: guarda cada evento como JSONB y no toca las tablas existentes.

Si prefieres usar las tablas normalizadas de PadelReserve (jugadores = usuarios, reservas de pista, etc.), implementa la interfaz `AmericanosRepository` en `lib/server/repository.ts`. Es lo único que hay que cambiar: el frontend solo habla con los endpoints.

```ts
interface AmericanosRepository {
  listar(): Promise<EventoAmericano[]>;
  obtener(id: string): Promise<EventoAmericano | null>;
  guardar(evento: EventoAmericano): Promise<EventoAmericano>;   // upsert por id
  eliminar(id: string): Promise<boolean>;
  obtenerClub(): Promise<ConfigClub>;
  guardarClub(club: ConfigClub): Promise<ConfigClub>;
}
```

Puntos de enganche útiles:

- `Jugador.usuarioId`: id del usuario de PadelReserve (para autocompletar jugadores y fotos con `fotoUrl`).
- `EventoAmericano.reservaIds`: reservas que bloquean las pistas del evento en PadelReserve.
- `EventoAmericano.canchas`: pistas físicas usadas (número, nombre, techada).

## 3. Endpoints

| Método | Ruta | Cuerpo / respuesta |
| --- | --- | --- |
| GET | `/api/americanos` | `{ modo, eventos: EventoAmericano[] }` |
| POST | `/api/americanos` | `{ evento }` → upsert, `201 { modo, evento }` |
| GET | `/api/americanos/:id` | `{ modo, evento, tabla: TablaPosiciones }` |
| PUT | `/api/americanos/:id` | `{ evento }` |
| DELETE | `/api/americanos/:id` | `204` |
| GET | `/api/club` | `{ modo, club: ConfigClub }` |
| POST | `/api/club` | `{ club }` |

Toda la lógica de juego (rotación, validación de marcadores, tabla) es TypeScript puro en `lib/` y se puede reutilizar en el backend o en una Edge Function.

## 4. Tiempo real

Hoy la sincronización es: mismo navegador al instante (BroadcastChannel) y otros dispositivos cada 8 s (polling a `/api/americanos`). Con Supabase se puede cambiar el polling de `components/Providers.tsx` por una suscripción Realtime a `americanos_eventos` sin tocar el resto.
