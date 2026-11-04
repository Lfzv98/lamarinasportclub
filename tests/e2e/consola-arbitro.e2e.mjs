// Prueba en navegador de la consola del árbitro en una sola pantalla (tablet de pista):
// previa sin pasos (sorteo, saque, lados), un toque por punto, detalle opcional, cambio de lado,
// falta y doble falta, sanción, médico, cambiar sacador, retiro, fin con cuenta regresiva y envío
// solo a mesa, todo sin diálogos y con Deshacer. También revisa que el servidor y la TV de la pista
// reciban cada punto. Con el servidor recién levantado (datos de prueba limpios):
//   npm run build && npm start   y luego   node tests/e2e/consola-arbitro.e2e.mjs [carpeta] [ancho] [alto] [escala]
//   (1180 820 = tablet horizontal, 820 1180 = vertical, 390 844 = celular)
import { chromium } from "playwright";
const U = process.env.APP_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? ".";
const vw = Number(process.argv[3] ?? 1180), vh = Number(process.argv[4] ?? 820), dsf = Number(process.argv[5] ?? 1);
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const staff = await b.newContext();
await staff.request.post(`${U}/api/staff/login`, { data: { pin: "1234" } });
await staff.request.post(`${U}/api/demo`, { data: { accion: "cargar" } });
const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, hasTouch: true });
await ctx.request.post(`${U}/api/arbitro`, { data: { arbitroId: "arb-demo-ana", codigo: "1234" } });
const p = await ctx.newPage();
const errs = [];
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; console.log((c ? "PASS " : "FAIL ") + m); };
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => { errs.push("DIALOGO: " + d.message()); d.dismiss(); });
const espera = (ms = 400) => p.waitForTimeout(ms);
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
const texto = () => p.locator("main").innerText();
await p.goto(`${U}/arbitro`, { waitUntil: "networkidle" });
await espera(2500);
// Sin turno a esta hora: la tablet pregunta la pista una vez.
if (await p.locator("text=¿En qué pista está esta tablet?").count()) {
  await shot("00-elegir-pista");
  await p.getByRole("button", { name: /Pista 3/ }).click();
  await espera(1500);
}
// Sin scroll: la consola entra entera en la pantalla.
const scroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
ok(scroll <= 1, `previa sin scroll (${scroll}px de más)`);
await shot("01-previa");
// Sorteo con la pelota
await p.getByRole("button", { name: "Sortear con la pelota" }).click();
await espera(1500);
ok(/Ganó /.test(await texto()), "la pelota sortea un ganador");
await p.getByRole("button", { name: "Sacar", exact: true }).click();
await espera(200);
let t = await texto();
const falta = t.match(/Toca quién saca primero en ([^\n]+)/)?.[1];
ok(!!falta, `tras el sorteo falta elegir sacador: ${falta}`);
// primer sacador de cada dupla: el primero de cada columna
const jugadores = p.locator("button[aria-pressed]:has(span.font-display)");
const n = await jugadores.count();
ok(n === 4, `4 jugadores para elegir sacador (${n})`);
await jugadores.nth(0).click(); await jugadores.nth(2).click();
await espera(200);
await shot("02-previa-lista");
// cambiar lados
const izqAntes = await p.locator("p.font-display").first().innerText();
await p.getByRole("button", { name: "Cambiar lados" }).click();
await espera(700);
const izqDespues = await p.locator("p.font-display").first().innerText();
ok(izqAntes !== izqDespues, `cambiar lados mueve las duplas (${izqAntes} → ${izqDespues})`);
await p.getByRole("button", { name: /Empezar partido/ }).click();
await espera(1500);
t = await texto();
ok(await p.locator("button[aria-label^='Punto para']").count() === 2, "empieza el partido en la misma pantalla");
ok(await p.evaluate(() => document.documentElement.scrollHeight - innerHeight) <= 1, "en juego sin scroll");
await shot("03-en-juego");
const puntoIzq = p.locator("button[aria-label^='Punto para']").first();
const puntoDer = p.locator("button[aria-label^='Punto para']").nth(1);
const nombreIzq = (await puntoIzq.getAttribute("aria-label")).replace("Punto para ", "");
const puntos = async () => [await puntoIzq.locator("span.font-display").innerText(), await puntoDer.locator("span.font-display").innerText()];
// Winner del jugador de la izquierda: un toque = punto para su dupla + estadística
const winnerIzq = p.locator("button[aria-label^='Winner de']").first();
ok(await winnerIzq.isVisible() && await p.locator("button[aria-label^='Error no forzado de']").count() === 4 && await p.locator("button[aria-label^='Error forzado de']").count() === 4, "winner, error no forzado y forzado de cada jugador siempre a la vista");
await winnerIzq.click();
await espera(400);
ok(JSON.stringify(await puntos()) === '["15","0"]', `el winner suma el punto a su dupla (${await puntos()})`);
ok(await p.getByRole("button", { name: /^remate$/i }).isVisible(), "después del winner, el golpe (opcional) en la franja de abajo");
await shot("04-detalle");
await p.getByRole("button", { name: /^remate$/i }).click();
await espera(300);
ok(/Deshacer\nWinner de /.test(await texto()), "deshacer dice qué deshace (winner)");
await p.getByRole("button", { name: /^Deshacer/ }).click();
await espera(400);
// Error no forzado del jugador de la izquierda: el punto es para la otra dupla
await p.locator("button[aria-label^='Error no forzado de']").first().click();
await espera(400);
ok(JSON.stringify(await puntos()) === '["0","15"]', `el error no forzado da el punto a la otra dupla (${await puntos()})`);
await p.getByRole("button", { name: /^volea$/i }).click();
await espera(300);
ok(/Errores no forzados\n+0 · 1/i.test(await texto()), "las estadísticas de abajo se actualizan al instante");
await p.getByRole("button", { name: "Estadísticas del partido" }).click();
await espera(500);
ok(/Remates ganadores/i.test(await p.locator("body").innerText()), "la hoja de estadísticas trae la comparativa completa");
await shot("04c-estadisticas");
await p.keyboard.press("Escape");
await p.locator("[aria-label='Cerrar']").first().click().catch(() => {});
await espera(500);
await p.getByRole("button", { name: /^Deshacer/ }).click();
await espera(400);
// Toque simple en la mitad: punto sin detalle
await puntoIzq.click();
await espera(400);
// el punto se deshace con su detalle
ok(/Deshacer\nPunto de /.test(await texto()), "deshacer dice qué deshace (punto simple)");
await p.getByRole("button", { name: /^Deshacer/ }).click();
await espera(500);
t = await texto();
ok(/Nada por deshacer/.test(t), "deshacer el único punto deja el marcador en cero");
// game completo: 4 puntos seguidos para la izquierda → cambio de lado (1-0)
for (let i = 0; i < 4; i++) { await puntoIzq.click(); await espera(150); }
await espera(500);
t = await texto();
ok(/Cambien de lado ya|Cambio de lado/.test(t), "tras el 1-0 avisa el cambio de lado en la franja");
const nombreIzq2 = (await p.locator("button[aria-label^='Punto para']").first().getAttribute("aria-label")).replace("Punto para ", "");
ok(nombreIzq2 !== nombreIzq, `las duplas se cambiaron solas de lado (${nombreIzq} → ${nombreIzq2})`);
await shot("05-cambio-lado");
// Sincronía: el servidor tiene los 4 puntos y la TV de la pista muestra el cambio de lado
const lista = await (await ctx.request.get(`${U}/api/torneos`)).json();
const tor = lista.torneos.find((x) => /Open La Marina/.test(x.nombre));
await espera(1500);
const ms = (await (await ctx.request.get(`${U}/api/marcadores?torneoId=${encodeURIComponent(tor.id)}`)).json()).marcadores;
const mio = ms.find((x) => x.pista === 3 && !x.finalizado && x.anotadores?.some((a) => a.id === "arb-demo-ana"));
ok(mio && mio.puntos.length === 4, `el servidor ya tiene los 4 puntos (${mio?.puntos.length})`);
ok(mio && mio.puntos.every((x) => x.por === "arb-demo-ana"), "cada punto firmado por la árbitro");
const tv = await ctx.newPage();
await tv.setViewportSize({ width: 1920, height: 1080 });
await tv.goto(`${U}/torneos/${encodeURIComponent(tor.id)}/pista/3`, { waitUntil: "networkidle" });
await tv.waitForTimeout(2500);
const ttv = await tv.locator("body").innerText();
ok(/cambio de lado/i.test(ttv), "la TV de la pista muestra el cambio de lado al mismo tiempo");
ok(/sets\s+games\s+puntos/i.test(ttv), "la TV de la pista lee SETS · GAMES · PUNTOS");
await tv.screenshot({ path: `${out}/05b-tv-pista.png` });
await tv.close();
// Falta y doble falta
await p.getByRole("button", { name: /^Falta$/ }).click(); await espera(200);
ok(/2ª falta = punto/.test(await texto()), "primera falta queda pendiente");
await p.getByRole("button", { name: /2ª falta/ }).click(); await espera(300);
ok(/Doble falta/.test(await texto()), "la doble falta suma punto y se puede deshacer");
await p.getByRole("button", { name: /^Deshacer/ }).click(); await espera(300);
ok(/2ª falta = punto/.test(await texto()), "deshacer la doble falta vuelve a la primera falta");
await p.getByRole("button", { name: /^Deshacer/ }).click(); await espera(300);
// Sanción: advertencia sin diálogo, se deshace
await p.getByRole("button", { name: /Sanción/ }).first().click(); await espera(300);
await shot("06-sancion");
await p.getByRole("button", { name: "Demora en el juego" }).click(); await espera(300);
ok(/Deshacer\nAdvertencia a /.test(await texto()), "la advertencia se aplica al instante y se puede deshacer");
await p.getByRole("button", { name: /^Deshacer/ }).click(); await espera(300);
ok(!/Deshacer\nAdvertencia/.test(await texto()), "advertencia deshecha");
// Médico
await p.getByRole("button", { name: /Médico/ }).first().click(); await espera(300);
await p.getByRole("button", { name: /Lesión · 3 min/ }).first().click(); await espera(400);
ok(/Atención médica ·/.test(await texto()), "atención médica con cuenta regresiva en la franja");
await shot("07-medico");
await p.getByRole("button", { name: /^Deshacer/ }).click(); await espera(300);
// Cambiar sacador
await espera(21000);
const chip = () => p.locator("div.ring-2 span.bg-lima.text-marino-2").first().innerText().catch(() => null);
const sacaAntes = await chip();
const ladoSaca = await p.locator("div.ring-2 button:has-text('Cambiar sacador')").first();
await ladoSaca.click(); await espera(300);
const sacaDespues = await chip();
ok(sacaAntes && sacaDespues && sacaAntes !== sacaDespues, `cambiar sacador al toque (${sacaAntes} → ${sacaDespues})`);
await p.getByRole("button", { name: /^Deshacer/ }).click(); await espera(300);
ok((await chip()) === sacaAntes, "deshacer devuelve el sacador");
// Retiro: cuenta regresiva y deshacer
await p.getByRole("button", { name: /Se retira|Retiro/ }).first().click(); await espera(500);
ok(/Se envía solo a mesa técnica/.test(await texto()), "el retiro abre la cuenta para enviar, sin diálogo");
await shot("08-retiro");
await p.getByRole("button", { name: /Deshacer retiro/ }).click(); await espera(500);
ok(await p.locator("button[aria-label^='Punto para']:not([disabled])").count() === 2 && !/Se envía solo/.test(await texto()), "deshacer retiro vuelve al partido");
// Terminar el partido: punto a punto para la derecha hasta el final (con detalle apagado)
await p.getByRole("button", { name: /Golpe sí/ }).click();
for (let i = 0; i < 120; i++) {
  if (/Partido terminado/i.test(await texto())) break;
  await p.locator(`button[aria-label='Punto para ${nombreIzq}']`).click();
  await espera(60);
}
await espera(500);
t = await texto();
ok(/Partido terminado/i.test(t) && /Se envía solo/.test(t), "al terminar, cuenta regresiva para mesa");
await shot("09-fin");
// Deshacer el último punto reabre
await p.getByRole("button", { name: /Deshacer último punto/ }).click(); await espera(600);
ok(!/Partido terminado/i.test(await texto()), "deshacer el punto final reabre el partido");
await p.locator(`button[aria-label='Punto para ${nombreIzq}']`).click();
await espera(600);
// esperar a que se envíe solo
await espera(11500);
t = await texto();
ok(!/Partido terminado/i.test(t), "se envió solo y la consola pasó a lo siguiente de la pista");
await shot("10-siguiente");
ok(errs.length === 0, `sin errores ni diálogos (${errs.join(" / ")})`);
console.log(fallos ? `${fallos} FALLOS` : "TODO OK");
await b.close();
process.exit(fallos ? 1 : 0);
