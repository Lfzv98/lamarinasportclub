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
| GET | `/api/americanos` | `{ modo, eventos: EventoAmericano[] }` (sin eliminados; `?todos=1` los incluye) |
| POST | `/api/americanos` | `{ evento }` → upsert con fusión, `201` nuevo / `200` actualizado, `{ modo, evento }` |
| GET | `/api/americanos/:id` | `{ modo, evento, tabla: TablaPosiciones }` · `404` si no existe o está eliminado |
| PUT | `/api/americanos/:id` | `{ evento }` (igual que POST; el id debe coincidir con la URL) |
| DELETE | `/api/americanos/:id` | borrado lógico (`eliminado: true`), `204` |
| GET | `/api/club` | `{ modo, club: ConfigClub }` |
| POST | `/api/club` | `{ club }` → guarda si es más reciente que lo guardado |

### Errores (siempre JSON)

| Código | Cuándo | Cuerpo |
| --- | --- | --- |
| 400 | JSON mal formado | `{ error }` |
| 404 | Evento inexistente o eliminado | `{ error }` |
| 413 | Cuerpo mayor a 1 MB | `{ error }` |
| 422 | Falla la validación | `{ error, detalles: string[] }` con cada problema en español |
| 502 | Supabase no responde o rechaza | `{ error, detalle }` |
| 500 | Cualquier otro error inesperado | `{ error, detalle }` |

La validación (`lib/validacion.ts`) revisa formato de ids, fechas y horas, rangos (pistas 1–6, hasta 48 jugadores y 30 rondas), jugadores duplicados, partidos que referencian jugadores inexistentes o repiten un jugador, y que cada marcador sea posible según el método de puntuación. Es TypeScript puro: se puede reutilizar tal cual en una Edge Function o un trigger.

## Reglas de sincronización (importante al implementar el repositorio)

1. **Nunca sobrescribir a ciegas.** Los endpoints ya hacen `fusionarEventos(guardado, entrante)` antes de `repo.guardar`. Si escribes directo a la base desde otro lado, usa la misma función.
2. **Fusión:** la estructura (rondas, ronda actual, cronómetro, plantel) viene de la versión con `actualizadoEn` más reciente; cada marcador conserva la carga más reciente según `Partido.actualizadoEn`. Así dos celulares cargando pistas distintas no se pisan, y un marcador cargado sin señal sobrevive aunque otro dispositivo ya haya avanzado la ronda.
3. **Marcas de tiempo monotónicas:** cada edición usa `despues(previa)`, que siempre es posterior a la versión editada aunque el reloj del celular esté atrasado.
4. **Borrado lógico:** `eliminado: true` es pegajoso en la fusión; una copia vieja no "resucita" un evento borrado. Si quieres borrar físicamente, hazlo con un job después de unos días.
5. **Re-sorteos:** al retirar o sumar jugadores a mitad del evento, las rondas futuras se regeneran con ids nuevos (`r5-p1-<sufijo>`), así la fusión nunca mezcla un cuadro viejo con uno nuevo.
6. **Offline:** el cliente guarda los ids con cambios sin confirmar en `pendientes` y los reenvía en cada sync y al recuperar la conexión. El servidor debe aceptar el mismo evento varias veces (es idempotente).

## Checklist para pasar a producción

- [ ] Correr `supabase/schema.sql` (o implementar `AmericanosRepository` sobre las tablas de PadelReserve).
- [ ] Definir `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
- [ ] Verificar: el badge de la app dice "En línea" y `GET /api/americanos` responde `"modo": "SUPABASE"`.
- [ ] Correr `npm test` (lógica) y `node tests/e2e/robustez.e2e.mjs` contra el deploy (`APP_URL=https://…`) con una base de pruebas.
- [ ] Opcional: proteger `POST/PUT/DELETE` con la sesión de staff de PadelReserve (hoy cualquiera con el link puede editar; el ranking es público a propósito para el QR).

Toda la lógica de juego (rotación, validación de marcadores, tabla) es TypeScript puro en `lib/` y se puede reutilizar en el backend o en una Edge Function.

## 4. Tiempo real

Hoy la sincronización es: mismo navegador al instante (BroadcastChannel) y otros dispositivos cada 8 s (polling a `/api/americanos`). Con Supabase se puede cambiar el polling de `components/Providers.tsx` por una suscripción Realtime a `americanos_eventos` sin tocar el resto.
