# La Marina Sport Club · Americanos & Torneos

PWA de PadelReserve para organizar americanos y torneos de pádel en La Marina Sport Club: setup en 60 segundos, cuadro vivo con cronómetro, marcador táctil, ranking animado en tiempo real y Modo TV para las pantallas de la terraza y el bar.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Zustand. Lista para Vercel.

## Pantallas

| Ruta | Qué hace |
| --- | --- |
| `/` | Inicio: cuatro entradas, **Americanos**, **Americano HABIBI Tournament**, **Torneos** y **Árbitros** (y **Tenis** solo si el club lo tiene encendido) |
| Menú (☰ arriba a la derecha) | Todas las secciones: Americanos, Torneos, Árbitros, Nuevo americano/torneo de pádel (Tenis y Nuevo torneo de tenis solo en clubes con tenis), Ranking FVP, Manual y Ajustes (Mi club, Árbitros del club, Claves). Lo del staff lleva candado y pide el mismo PIN del staff |
| `/arbitro` | Panel del árbitro (tablet): se registra una sola vez en el club (nombre, teléfono, PIN de árbitros y un código propio de 4 dígitos) y sirve para todos los torneos, luego entra tocando su nombre y su código. Ve su turno y su pista, llama, empieza, anota y toma las fotos de las duplas |
| `/americanos` | Eventos activos e historial, acceso rápido a Modo TV |
| `/setup` | Asistente de 5 pasos: categoría, formato y puntuación, pistas y horario, jugadores, resumen con sorteo |
| `/evento/:id` | Cuadro vivo: rondas con hora, cronómetro con alarma, pistas activas, carga de score |
| `/evento/:id/tabla` | Podio + ranking (PJ, PG, PP, PF, PC, +/-, PTS) con animación de posiciones |
| `/evento/:id/tv` | Dashboard fullscreen 1920×1080 que se escala a cualquier pantalla, con QR para seguir el ranking |
| `/habibi` | **Americano HABIBI Tournament**: torneos activos, historial y cómo se juega |
| `/habibi/nuevo` | (staff) Asistente de 5 pasos: nombre y categoría, duplas de los grupos A y B, reglas y pistas de los grupos, dónde arranca la llave (octavos, cuartos o semis directo), reglas de la llave y de la final, 3er puesto |
| `/habibi/:id` | El torneo: tablas de los dos grupos con la línea de clasificación, botón "Armar la llave" y la llave completa; el staff toca un cruce para cargar el marcador y el ganador avanza solo. Es también lo que abre el QR |
| `/habibi/:id/tv` | Modo TV del HABIBI: logo del club grande y difuminado de fondo, grupos lado a lado, después la ronda en juego y el camino a la final, y al terminar los campeones |
| `/club` | Ajustes (staff): pistas, horarios por día, contacto y **claves de torneos** |
| `/torneos` | Torneos del club; crear uno nuevo (staff) |
| `/torneos/:id` | En vivo: pistas, llamados, W.O., próximos, resultados; Imprevistos (staff) |
| `/torneos/:id/categorias` | Inscritos por categoría, cabezas de serie, pegar lista, reglas y **Sorteo** |
| `/torneos/:id/cuadros` | Grupos con tabla y "¿Por qué este orden?", llaves con byes, 3er puesto, consolación |
| `/torneos/:id/programacion` | Horarios por día y pista, "¿Cuándo juego?", Programar / Desde ahora / Imprevistos |
| `/torneos/:id/partido/:partido` | Partido para los atletas (con la clave): comparativa de estadísticas, tabla por jugador y punto a punto |
| `/torneos/:id/anotar/:partido` | Anotador del árbitro o del staff: asistente previo (fotos, sorteo con la pelota según FIP, lado, quién saca), un toque por punto, detalle opcional sin barra de tiempo, saque solo y aviso de cambio de lado con cronómetro FIP (directo tras el 1-0, 1:30 en impares, 2:00 entre sets) que también sale en la TV de la pista |
| `/torneos/:id/arbitros` | Árbitros (staff): el plantel del club con lo que anotó cada uno en ese torneo, pausar o borrar, y turnos por día, franja y pista con reparto automático |
| `/torneos/:id/pista/:n` | Pantalla de la esquina de cada pista (1920×1080) para el público: marcador, datos por dupla y relato sin métricas individuales |
| `/torneos/:id/tv` | Modo TV del torneo: todas las pistas, próximos, resultados y patrocinadores |
| `/torneos/:id/estadisticas` | Rankings y ficha por jugador; resumen para el club (staff) |
| `/inscripcion/:id` | **Inscripción online** (pública): portada del torneo, cupos por categoría, formulario paso a paso de la dupla (datos, talla, lado, alergias, reglamento), pago con datos para copiar, referencia y foto del comprobante, código para consultar el estado y ayuda por WhatsApp |
| `/torneos/:id/inscripciones` | Inscripciones online (staff): verificar pagos, confirmar (la dupla entra a Inscritos con su chequeo FVP) o rechazar con motivo, tallas de franelas, alergias, QR del enlace y Excel |
| `/torneos/:id/ajustes` | Días, pistas, desempates, patrocinadores, historial y eliminar (staff) |
| `/manual` | Manual de la app de la A a la Z como libro digital (americanos, torneos, árbitros, pantallas, jugadores, dueño), con capturas |
| `/manual/imprimir` | El mismo manual hoja por hoja en A5, para imprimir o guardar como PDF |

| `/tenis` | Tenis: dos puertas, **Cancha dura** (hard court) y **Arcilla** (clay court), y los partidos en cancha ahora |
| `/tenis/:superficie` | `dura` o `arcilla`: torneos, partidos en vivo y consejos de esa superficie, con su color |
| `/tenis/nuevo` | (staff) Torneo con cuadro, liga o partido rápido; singles o dobles; formato ITF; pega la lista con `(1)`, `(2)` para las cabezas de serie |
| `/tenis/t/:id` | Cuadro (o tabla de la liga), partidos e inscritos; llamar a cancha, anotar, W.O. o retiro |
| `/tenis/t/:id/p/:partido` | Partido para el público: marcador vivo, cancha con quién saca, gráfico de impulso y estadísticas |
| `/tenis/t/:id/p/:partido/anotar` | Anotador (staff o árbitro): sorteo con moneda, orden de saque, faltas y doble falta, ace, reloj de 25 s, cambios de lado y descansos ITF, canto en voz alta y revisión de marca en arcilla |
| `/tenis/t/:id/tv` | Modo TV de tenis con el color de la superficie |
| `/tenis/jugadores` | Ranking de jugadores con su récord en cancha dura y en arcilla |

## Asistente IA (staff)

Botón verde **IA** abajo a la derecha (solo con sesión de staff) y **Registrar con IA** en el paso de jugadores del americano, en el del Americano Torneo y en las categorías de un torneo. Se le habla (dictado del navegador, gratis) o se le escribe.

- **Arma** un americano, un Americano Torneo o un torneo con sus duplas, y **suma** jugadores o duplas dictados a lo que ya está cargado. Nunca crea ni inscribe solo: deja lleno el formulario de siempre (setup en *Listo*, Americano Torneo en *Listo*, Nuevo torneo y después *Pegar lista* con su chequeo FVP) y el staff confirma.
- **Responde** cómo se hace algo con el manual de la app (`components/manual/paginas.tsx`, que va en el prompt) y lo que pasa ahora (eventos activos, borrador, ranking) con un resumen que manda la pantalla, sin teléfonos ni cédulas. Lo que no es de la app lo rechaza.
- `app/api/asistente/route.ts` (solo staff, tope de 60 mensajes cada 10 min por IP) llama a Claude (`claude-opus-5-5`, esfuerzo bajo, cambiable con `ASISTENTE_MODELO`) con herramientas que solo devuelven propuestas; `lib/asistente/ejecutar.ts` las valida y llena cada formulario. Requiere `ANTHROPIC_API_KEY`.

## Reglas soportadas

- **Categorías:** Femenino, Masculino y Mixto en 7ma, 6ta, 5ta, 4ta, 3ra y Open (Open Mixto).
- **Formatos:** Individual (americano tradicional, cambias de pareja cada ronda), Dupla fija (todos contra todos) y Mixto (como Individual, pero cada pareja es siempre hombre + mujer). Internamente Mixto = `INDIVIDUAL_ROTATIVO` + categoría `MIXTO`.
- **Puntuación:** Puntos totales (16/21/24/32), Games con punto de oro (4/6/9) y Sets cortos a 4 (1 set o mejor de 3).
- **Lluvia / pista suspendida** (`lib/evento.ts`, `lib/lluvia.ts`): el staff toca **Suspender** en una pista del cuadro vivo. El partido que se jugaba ahí queda en espera con su marcador y entra primero en la ronda siguiente, en otra pista; las rondas que faltan se vuelven a sortear con las pistas que quedan, sin repetir cruces (si era la última ronda, se agrega una para terminarlo). **Reactivar** devuelve la pista. En el Americano Torneo se aplica a los grupos y a la llave a la vez; en Torneos, el botón de la tarjeta de cada pista hace lo mismo que Imprevistos para esa pista.
- **Rotación balanceada** (`lib/rotation.ts`): nadie repite compañero mientras sea posible, se minimizan rivales repetidos, se equilibra el nivel entre parejas, los descansos se reparten parejo y en Mixto cada pareja es hombre + mujer. Es determinista por semilla.

## Americano HABIBI Tournament

Torneo recreativo de dos fases (`lib/habibi.ts`):

1. **Grupos A y B**: cada grupo es un americano **individual** (cambian de pareja cada ronda) o en **dupla fija** (todos contra todos), a elección del staff (por defecto 8 duplas y 16 puntos), con su cuadro vivo, ranking y TV de siempre. En individual, al terminar los grupos las duplas de la llave se forman con el ranking de cada grupo: *equilibradas* (1º con el último que pasa, 2º con el penúltimo…) o *por orden* (1º con 2º, 3º con 4º…); en mixto siempre hombre + mujer.
2. **Llave**: con las posiciones finales se cruzan las duplas. El staff elige dónde arranca:
   - **Octavos** (8 por grupo), la hoja del creador del formato: 1A-3A, 6B-8B, 2A-4A, 5B-7B, 5A-7A, 2B-4B, 6A-8A, 1B-3B. Los cruces vecinos se enfrentan en cuartos (siempre un ganador del A contra uno del B).
   - **Cuartos** (4 por grupo): 1A-4B, 2B-3A, 1B-4A, 2A-3B.
   - **Semis directo** (2 por grupo): 1A-2B, 1B-2A.
   En las tres, 1A y 1B (y 2A y 2B) van en mitades opuestas: solo se pueden ver en la final.
3. **Reglas de la llave a gusto del staff**: puntos, games o sets (con todas las opciones del americano), la final con reglas propias y el 3er puesto opcional. En la llave no hay empates: un marcador igualado se define con un punto de oro y se anota quién lo ganó.

Se guarda como eventos normales de `/api/americanos` (no hace falta tabla nueva): cada grupo lleva `habibi = { rol: "GRUPO", torneoId, letra }` y la llave, que es la ficha del torneo, `habibi = { rol: "LLAVE", grupos, inicio, tercerPuesto, siembra }`; sus rondas son las fases y la final puede traer su propia `puntuacion`. Si se corrige un marcador de la llave, avanza el nuevo ganador y se limpia lo que dependía del anterior.

## Torneos

- **Categorías:** 7ma a 1ra en Masculino, Femenino y Mixto, Master +40, +45 y +55 (M/F) y Junior Sub-12/13/14/16/18 (las mismas que usa la FVP), con validación de edad (año del torneo) y de género en Mixto.
- **Sorteo automático por categoría:** propone el formato según inscritos (eliminación, liga, liga + final, grupos + llave) y explica por qué; byes a los mejores sembrados; 2dos de un grupo en la mitad opuesta a su 1ro; cabezas de serie y puntos de ranking.
- **Desempates explicados:** 2 empatadas → partido entre ellas; 3 o más → sets y games entre las empatadas, luego en todo el grupo y por último sorteo registrado. El orden de criterios se ajusta por torneo.
- **Programación sin choques:** pistas, descanso mínimo (también entre categorías), dependencias de la llave, finales el último día en la pista principal, franjas bloqueadas y disponibilidad de cada dupla.
- **Imprevistos:** suspender pistas por lluvia (el partido en juego guarda su marcador y se reanuda), reanudar, sumar una sede de apoyo con su horario y tiempo de traslado, agregar un día. Todo reprograma solo.
- **Anotador punto a punto:** punto de oro, tie-break y súper tie-break, orden de saque, faltas, aces, winners y errores por jugador y golpe; estadísticas por jugador al instante.
- **Reglamento FIP (rev. 2021):** puntuación con ventaja o punto de oro (en mixto resta el del mismo sexo), mini set a 4 con tie-break 4-4, tie-break decisivo a 10 o a 7, tercer set sin tie-break; cambios de lado en games impares y cada 6 puntos del tie-break; cada dupla elige quién saca al empezar cada set; descansos de 20 s, 90 s y 120 s (sin descanso tras el primer game); W.O. a los 10 min de la hora prevista (o 5 min después de que terminó el partido anterior en la pista); peloteo de 0, 3 o 5 min al reanudar una suspensión; atención médica de 3 min una vez por jugador y accidente de hasta 15 min; tabla de penalizaciones (advertencia, pérdida de punto, descalificación) acumulada por dupla. El orden de desempate en grupos no lo fija el reglamento de juego: se configura por torneo.
- **Categorías verificadas con el ranking FVP:** la app lee cada día la lista oficial de la Federación Venezolana de Pádel y cruza a cada jugador por cédula. Nadie se inscribe por debajo de su categoría; lo dudoso queda "por verificar" y frena el sorteo hasta que el staff lo revise o autorice una excepción con motivo. Los jugadores que no están en la lista (no federados) se inscriben con **Inscribir igual (excepción del staff)**, que ya trae el motivo escrito y queda firmada; si el ranking no contesta en 8 s, la dupla se inscribe igual como "por verificar". Lista, búsqueda y carga manual en `/torneos/ranking`.
- **Inscripción online:** cada torneo puede abrir su página pública de inscripción (Ajustes → Inscripción online: precio, cierre, qué incluye, premios, métodos de pago, WhatsApp, reglamento y categorías abiertas). El formulario valida la rama, la edad en Master/Junior, los cupos, que nadie se inscriba dos veces y que nadie juegue por debajo de su categoría FVP (quien no aparece en la lista igual se inscribe y el staff lo revisa). Las inscripciones se guardan aparte del torneo (`eventos_extras`, tipo `inscripcion`) porque traen datos personales; al confirmar el pago la dupla entra al torneo como si el staff la hubiera cargado.
- **Clave de participantes:** una por torneo, vence al terminar el último día; el staff la ve y cambia en Ajustes. Cambiarla deja fuera a quien entró con la anterior.
- **Árbitros:** rol aparte del staff. El club tiene un solo PIN de árbitros, que el staff crea y cambia en Ajustes (página protegida con el PIN del staff). Sirve para que cada árbitro se registre una vez en el plantel del club; después entra con su nombre y su código en todos los torneos y únicamente puede llamar, empezar y anotar partidos: no abre cuadros, horarios ni ajustes. Cambiar el PIN cierra las sesiones abiertas. Cada árbitro se registra con nombre, apellido, teléfono y un código propio (guardado solo como HMAC), así cada punto queda firmado con su nombre y no hay "yo no fui". El staff asigna turnos por pista y franja (o los reparte solo) y ve cuántos partidos y puntos anotó cada uno.
- **Fotos de duplas y jugadores:** el árbitro (o el staff) fotografía a cada dupla en la pista; la foto sale junto a sus nombres en el anotador, la TV de la pista y la página del partido. En Americanos ("Jugadores y fotos") y en Inscritos de Torneos el staff puede fotografiar a cada jugador; su cara sale en cuadros, ranking y TV. Se comprimen en el dispositivo (≤400 KB).
- **Tres públicos:** la tablet del árbitro anota; las pantallas de TV muestran marcador y relato público; las estadísticas de cada atleta solo se ven con la clave del torneo.

## Tenis

> **Apagado por defecto.** La Marina no tiene tenis: esta sección es para ofrecer el sistema en clubes de Caracas. Se enciende con `NEXT_PUBLIC_TENIS=1` en el despliegue de ese club (`lib/tenis/activo.ts`). Apagado no sale en el inicio ni en el menú, `/tenis` da 404, `/api/tenis` no responde y los datos de prueba no cargan tenis.

- **Superficies:** cancha dura (azul) y arcilla (terracota), cada una con su look, su cancha dibujada a escala y sus consejos. En arcilla el anotador permite **revisar la marca** y al terminar recuerda pasar la rastra.
- **Reglas ITF** (`lib/tenis/marcador.ts`): 15-30-40 con ventaja o sin ventaja (punto decisivo); sets a 6 con tie-break a 7; formatos Clásico, Súper tie-break (tercer set a 10), Sets cortos (a 4), Pro set (a 8) y Grand Slam (mejor de 5, tie-break a 10 en 6-6 del quinto). Saque que rota por juego (en dobles entre los cuatro), en el tie-break 1 y luego 2; cambios de lado en juegos impares (sin descanso tras el primero, 90 s), 120 s entre sets y cada 6 puntos del tie-break.
- **Cuadros** (`lib/tenis/torneo.ts`): eliminación con cabezas de serie en sus líneas y byes para los mejores, liga todos contra todos con tabla, o partido único. El ganador avanza solo.
- **Estadísticas:** aces, dobles faltas, % de primer saque, puntos ganados con 1º y 2º saque, quiebres, winners y errores, rachas y gráfico de impulso.
- **Permisos:** solo el staff crea torneos y partidos (sin límite); los árbitros del club solo anotan y llaman partidos; el público ve todo.
- **Datos:** `/api/tenis` (GET público, POST staff o árbitro). Por ahora cada torneo es una fila de `eventos_extras` (`evento_id = 'tenis'`, `tipo = 'tenis'`), así no hace falta una tabla nueva.

## Permisos

Los jugadores ven todo sin cuenta (cuadro, ranking, Modo TV y el QR). Crear eventos, cargar marcadores y configurar el club es solo para el staff: PIN del club (demo: `1234`, cámbialo con `STAFF_PIN`) o usuario de PadelReserve con rol staff.

## Ranking del formato Individual

Al crear el evento se elige cómo suma cada jugador: **todos los puntos** de su pareja en cada partido (americano clásico, por defecto), **solo los de las rondas ganadas**, o **por victorias** (3 por ganar, 1 por empate).

## A prueba de errores

- **Dos o más celulares a la vez:** cada marcador se fusiona por partido; nadie pisa lo que cargó otro.
- **Sin señal en pista:** todo se guarda en el dispositivo y se sube solo al volver la conexión (el badge muestra cuántos cambios faltan subir).
- **Recargar o cerrar la app:** el cronómetro sigue (se basa en la hora de inicio) y el setup a medio armar se recupera.
- **Errores de carga:** marcadores imposibles bloqueados con mensaje claro, doble toque ignorado, "Deshacer" al guardar, corregir, borrar y cerrar ronda; no se puede cargar una ronda que aún no empieza.
- **Cambios de plantel:** retirar a alguien (conserva sus puntos) o sumar a quien llegó tarde; se re-sortean solo las rondas que faltan, sin repetir compañeros.
- **Borrar evento:** doble confirmación y borrado lógico que se propaga a todos los dispositivos.
- **Datos locales dañados o almacenamiento lleno:** la app arranca igual y sigue trabajando contra la API.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests: americanos (rotación, marcadores, horarios, fusión, plantel, validación) y torneos (sorteo, desempates, programación, lluvia, sedes, anotador, reglamento FIP)
node tests/e2e/robustez.e2e.mjs   # 22 pruebas en navegador (con la app corriendo)
node tests/e2e/horario.e2e.mjs    # 18 pruebas del selector de fecha y horas (celular y computadora)
node tests/e2e/habibi.e2e.mjs     # Americano HABIBI de punta a punta: asistente, grupos, llave desde octavos, empate con punto de oro, campeones, TV
npm run typecheck
npm run build
```

Sin variables de entorno corre en **modo DEMO**, en memoria y **vacía**. Para enseñarla se cargan datos de prueba con `POST /api/demo` (staff, `{"accion":"cargar"}`; ya no hay botón en Ajustes): crea 3 americanos, un torneo de hoy en pleno juego (clave `MARINA`), la Copa Navidad con la inscripción online abierta y 6 árbitros de ejemplo (código `1234`, PIN de árbitros `2468` si no había uno); `{"accion":"borrar"}` los quita sin tocar lo real. Los datos salen de `data/mockData.json` (americanos: `node --experimental-strip-types scripts/generar-mock.ts`; torneo: `node --experimental-strip-types scripts/generar-torneo-demo.ts`). Las pruebas de navegador los cargan solas. Para conectar Supabase ver [docs/BACKEND.md](docs/BACKEND.md).

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework Next.js, sin configuración extra).
2. Asigna el dominio `lamarinasportclub.vercel.app` en Settings → Domains.
3. Agrega `STAFF_PIN` y `STAFF_SECRET` (y luego las de Supabase) en Settings → Environment Variables. Ver `.env.example`.

## Estructura

```
app/                 páginas y API routes (app/api/americanos, club, torneos, marcadores, staff)
components/          UI (ScoreModal, Leaderboard, Cronometro, EventoShell, …) y components/torneo/
lib/                 lógica pura: rotation, scoring, evento, horarios, store, torneosStore
lib/torneo/          categorias, cuadro, tabla, torneo, programacion, imprevistos, marcador, acceso, validacion
lib/server/          repositorio DEMO / Supabase, sesión de staff y acceso a torneos
types/               americano.ts y torneo.ts
public/              manifest.json, sw.js, iconos y logo
```
