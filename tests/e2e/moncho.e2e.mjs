// Prueba en navegador de las mejoras de Moncho: flecha al paso anterior, formato sin "Mixto",
// casillas de mujeres y hombres, categoría Suma, rondas automáticas, cronómetro apagado,
// duplas en espera, historial y empates. Igual que robustez.e2e.mjs:
//   npm run build && npm start   y luego   node tests/e2e/moncho.e2e.mjs [carpeta-capturas]
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errs = [];
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; console.log((c ? "PASS " : "FAIL ") + m); };
const vp = { viewport: { width: 390, height: 844 } };
const ctx = await b.newContext(vp);
const r = await ctx.request.post(`${U}/api/staff/login`, { data: { pin: PIN } });
if (!r.ok()) throw new Error("No se pudo ingresar como staff");
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());
const espera = (ms = 450) => p.waitForTimeout(ms);
const siguiente = async () => { await p.locator("footer button:has-text('Siguiente')").click(); await espera(1000); };
const titulo = () => p.locator("h1").first().textContent();
const evento = async (id) => (await (await ctx.request.get(`${U}/api/americanos/${id}`)).json()).evento;

/* 1) Flecha de regreso: vuelve al paso anterior, no al inicio */
await p.goto(`${U}/setup`, { waitUntil: "networkidle" }); await espera(800);
await siguiente();
ok((await titulo())?.includes("Formato"), "paso 2: Formato y puntuación");
await p.getByLabel("Volver a Categoría").click(); await espera(1000);
ok((await titulo())?.includes("categoría"), "la flecha de arriba vuelve a Categoría (no al menú)");
await siguiente(); await siguiente();
ok((await titulo())?.includes("Mujeres y hombres"), "paso 3: Jugadores");
await p.goBack(); await espera(1000);
ok((await titulo())?.includes("Formato"), "el 'atrás' del celular también vuelve un paso");
await p.goBack(); await espera(1000);
ok((await titulo())?.includes("categoría"), "y otra vez atrás llega a Categoría");

/* 2) Formato: sin la tarjeta "Mixto"; con rama Mixto se ve Individual mixto y Dupla fija mixta */
await siguiente();
const formatos = await p.locator("button[aria-pressed] span.font-semibold").allTextContents();
ok(formatos.includes("Individual mixto") && formatos.includes("Dupla fija mixta") && !formatos.some((t) => t.trim() === "Mixto"), `formatos: ${formatos.slice(0, 2).join(" · ")} (sin "Mixto")`);
await p.screenshot({ path: `${out}/moncho-formato.png`, fullPage: false });

/* 3) Mixto individual: casilla de mujeres y casilla de hombres */
await siguiente();
await p.fill("input[placeholder='Nombre de la jugadora']", "Ana, Bea, Carla, Dani, Eva"); await p.keyboard.press("Enter"); await espera();
await p.fill("input[placeholder='Nombre del jugador']", "Luis, Moncho, Juan, Pedro"); await p.keyboard.press("Enter"); await espera();
const conteo = await p.locator("span.chip.tabular").allTextContents();
ok(conteo[0] === "5" && conteo[1] === "4", `contadores Mujeres ${conteo[0]} · Hombres ${conteo[1]}`);
ok(await p.locator("text=1 jugador en espera por ronda").count() > 0, "avisa que 1 persona espera por ronda");
await p.screenshot({ path: `${out}/moncho-mixto.png`, fullPage: true });

/* 4) Rondas automáticas + cronómetro apagado */
await siguiente();
ok((await titulo())?.includes("Pistas y rondas"), "paso 4: Pistas y rondas");
ok(await p.locator("text=Automático").count() > 0, "las rondas vienen en automático");
const rondasTxt = await p.locator("p:has-text(' rondas')").first().textContent();
const nRondas = Number(rondasTxt?.match(/(\d+) rondas/)?.[1]);
ok(nRondas >= 3, `rondas automáticas: ${nRondas}`);
ok(await p.locator("text=solo se llenan 2 pista").count() > 0, "avisa que con 9 jugadores solo se llenan 2 pistas");
await p.getByRole("switch", { name: "Cronómetro por ronda" }).click(); await espera();
ok(await p.locator("text=Apagado: cada ronda termina").count() > 0, "cronómetro apagado");
await p.screenshot({ path: `${out}/moncho-rondas.png`, fullPage: true });
await siguiente();
ok(await p.locator("text=sin cronómetro").count() > 0, "resumen: sin cronómetro");
await p.locator("footer button.btn-neon").click(); await p.waitForURL(/\/evento\/evt_/); await espera(1200);
const id1 = p.url().split("/evento/")[1].split(/[/?]/)[0];
const e1 = await evento(id1);
ok(e1.cronometro === false && e1.totalRondas === nRondas, `evento guardado sin cronómetro y con ${e1.totalRondas} rondas`);
ok(e1.rondas.every((ro) => ro.partidos.every((pa) => [pa.parejaA, pa.parejaB].every((x) => x.jugadorIds.map((j) => e1.jugadores.find((y) => y.id === j).genero).sort().join() === "F,M"))), "todas las parejas son hombre + mujer");
ok(await p.locator("aside >> text=Pausar").count() === 0 && (await p.locator("aside >> text=Por empezar").count()) > 0, "vista en vivo: sin reloj, muestra el marcador de ronda");
ok(await p.locator("text=En espera").count() > 0 && (await p.locator("text=Juega en la ronda").count()) > 0, "apartado En espera con la próxima ronda de cada uno");
await p.screenshot({ path: `${out}/moncho-vivo.png`, fullPage: true });
await p.goto(`${U}/evento/${id1}/tv`, { waitUntil: "networkidle" }); await espera(1200);
ok(await p.locator("text=Descansan").count() > 0 && (await p.locator("text=Restante").count()) === 0, "TV: sin cronómetro y con quién descansa");
await p.setViewportSize({ width: 1920, height: 1080 }); await espera(500);
await p.screenshot({ path: `${out}/moncho-tv.png` });
await p.setViewportSize(vp.viewport);

/* 5) Dupla fija Suma 9 con más duplas que pistas */
await p.goto(`${U}/setup`, { waitUntil: "networkidle" }); await espera(800);
await p.locator("text=Empezar de cero").click().catch(() => {}); await espera(800);
await p.locator("button[role='radio']:has-text('Masculino')").click(); await espera(200);
await p.locator("button:has-text('Suma')").first().click(); await espera();
ok(await p.locator("text=Masculino Suma 9").count() > 0, "categoría Masculino Suma 9");
await siguiente();
await p.locator("button:has-text('Dupla fija')").first().click(); await espera(200);
await siguiente();
await p.locator("text=Rellenar con duplas demo").click(); await espera();
await p.locator("input[placeholder='Jugador 1']").fill("Fuerte Uno"); await p.locator("input[placeholder='Jugador 2']").fill("Fuerte Dos");
await p.getByLabel("Categoría del jugador 1").selectOption("3RA"); await p.getByLabel("Categoría del jugador 2").selectOption("4TA");
await p.getByRole("button", { name: "Dupla", exact: true }).click(); await espera();
ok(await p.locator("text=esta dupla es más fuerte que la categoría").count() === 1, "una dupla 3ra + 4ta (7) queda marcada en Suma 9");
await p.screenshot({ path: `${out}/moncho-suma.png`, fullPage: true });
await siguiente();
// 7 duplas, 4 pistas techadas → 3 partidos por ronda, 1 dupla en espera, 7 rondas todos contra todos
ok(await p.locator("text=Todas contra todas: cada dupla juega 6 partidos").count() > 0, "7 duplas: todos contra todos automático (6 partidos cada una)");
await siguiente();
await p.locator("footer button.btn-neon").click(); await p.waitForURL(/\/evento\/evt_/); await espera(1200);
const id2 = p.url().split("/evento/")[1].split(/[/?]/)[0];
const e2 = await evento(id2);
ok(e2.totalRondas === 7 && e2.rondas.every((ro) => ro.descansanIds.length === 1), `dupla fija: ${e2.totalRondas} rondas, 1 dupla en espera cada ronda`);
ok(await p.locator("text=Dupla en espera").count() > 0, "vista en vivo: apartado Dupla en espera");

/* 6) Empate: las dos ganadoras 13-11 quedan empatadas y lo explica; historial muestra los marcadores */
await p.locator("text=Iniciar ronda").click(); await espera();
for (let i = 0; i < 3; i++) {
  await p.locator("button:has-text('Cargar marcador')").first().click(); await espera(500);
  for (let k = 0; k < 13; k++) await p.getByLabel("Sumar").first().click();
  await p.click("text=Guardar resultado"); await espera(500);
}
await p.goto(`${U}/evento/${id2}/tabla`, { waitUntil: "networkidle" }); await espera(1200);
ok(await p.locator("text=Empates en puntos").count() > 0 && (await p.locator("text=comparten posición").count()) > 0, "tabla: explica el empate y comparten posición");
await p.screenshot({ path: `${out}/moncho-tabla.png`, fullPage: true });
await p.locator("button[role='radio']:has-text('Historial')").click(); await espera();
ok(await p.locator("li:has-text('13')").count() >= 3, "historial: aparecen los 3 marcadores");
const opcion = await p.locator("select option").nth(1).getAttribute("value");
await p.locator("select").selectOption(opcion); await espera();
ok(await p.locator("text=PJ").count() > 0, "historial filtrado por dupla con su resumen");
await p.screenshot({ path: `${out}/moncho-historial.png`, fullPage: true });

console.log(errs.length ? "ERRORES JS:\n" + errs.join("\n") : "sin errores de JavaScript");
if (fallos || errs.length) process.exitCode = 1;
await b.close();
