// Prueba en navegador de "Suspender pista" (lluvia) en un americano en dupla fija con 16 duplas
// y 4 pistas: se suspende una pista con un toque, el partido queda en espera con su marcador,
// el cuadro sigue en 3 pistas, se ve en la TV y se reactiva. Igual que las otras:
//   npm run build && npm start   y luego   node tests/e2e/lluvia.e2e.mjs [carpeta-capturas]
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; console.log((c ? "PASS " : "FAIL ") + m); };

// El evento se arma con la misma lógica de la app (16 duplas, 4 pistas, ronda 1 en juego).
const evento = JSON.parse(execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "-e", `
  const { crearEvento, iniciarRonda } = await import("./lib/evento.ts");
  const js = [], ps = [];
  const nombres = ["Arturo","Josué","Víctor","Aníbal","Jesús","Junior","Mario","Hugo","Luis","Pedro","Raúl","Iván","Omar","Saúl","Tomás","Ángel"];
  for (let i = 0; i < 16; i++) {
    js.push({ id: "a" + i, nombre: nombres[i], apellido: "Uno", genero: "M" }, { id: "b" + i, nombre: nombres[15 - i], apellido: "Dos", genero: "M" });
    ps.push({ id: "p" + i, jugadorIds: ["a" + i, "b" + i], nombre: nombres[i] + " / " + nombres[15 - i] });
  }
  const canchas = [1, 2, 3, 4].map((n) => ({ numero: n, nombre: "Pista " + n, techada: n < 4, activa: true }));
  const e = iniciarRonda(crearEvento({ nombre: "Americano con lluvia", categoria: { rama: "MASCULINO", nivel: "5TA" }, modalidad: "DUPLA_FIJA",
    puntuacion: { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16 }, pistas: 4, canchas, duracionRondaMin: 15, totalRondas: 8, jugadores: js, parejas: ps, semilla: 5 }));
  console.log(JSON.stringify(e));
`], { encoding: "utf8" }));

const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const r = await ctx.request.post(`${U}/api/staff/login`, { data: { pin: PIN } });
if (!r.ok()) throw new Error("No se pudo ingresar como staff");
ok((await ctx.request.post(`${U}/api/americanos`, { data: { evento } })).ok(), "se guarda el americano de prueba");
const servidor = async () => (await (await ctx.request.get(`${U}/api/americanos/${evento.id}`)).json()).evento;
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());
const espera = (ms = 500) => p.waitForTimeout(ms);

await p.goto(`${U}/evento/${evento.id}`, { waitUntil: "networkidle" }); await espera(1200);
ok(await p.locator("[aria-label='Suspender Pista 3']").count() === 1, "cada pista tiene su botón Suspender");
await p.screenshot({ path: `${out}/lluvia-1-antes.png`, fullPage: true });

// Un toque en la pista 3: hoja con Lluvia ya elegida y cómo iban.
await p.locator("[aria-label='Suspender Pista 3']").click(); await espera(600);
ok(await p.locator("text=Suspender Pista 3").count() > 0, "abre la confirmación");
const inputs = p.locator("input[inputmode='numeric']");
await inputs.nth(0).fill("8"); await inputs.nth(1).fill("6");
await p.screenshot({ path: `${out}/lluvia-2-hoja.png` });
await p.getByRole("button", { name: "Suspender pista", exact: true }).click(); await espera(1500);
await p.screenshot({ path: `${out}/lluvia-3-despues.png`, fullPage: true });
ok(await p.locator("text=Reactivar Pista 3").count() === 1, "la pista 3 queda suspendida con botón Reactivar");
ok(await p.locator("text=iban 8-6").count() > 0, "el partido queda en espera con su marcador");
ok(await p.locator("text=siguen primero en la ronda 2").count() > 0, "dice cuándo y dónde sigue");

await espera(2500);
const e1 = await servidor();
ok(e1.pistasSuspendidas?.[0]?.numero === 3, "el servidor guarda la pista suspendida");
const r2 = e1.rondas.find((x) => x.numero === 2);
ok(r2.partidos.length === 3 && r2.partidos.every((x) => x.pista !== 3), "la ronda 2 ya está armada en 3 pistas");
ok(r2.partidos[0].suspendido?.marcador === "8-6", "el suspendido juega primero en la ronda 2");

// Ronda 2: la tarjeta muestra "Sigue · iban 8-6".
await p.locator("button:has-text('R2')").first().click(); await espera(800);
ok(await p.locator("text=Sigue · iban 8-6").count() === 1, "la tarjeta de la ronda 2 avisa que sigue el partido suspendido");
await p.screenshot({ path: `${out}/lluvia-4-ronda2.png`, fullPage: true });

// TV
const tv = await ctx.newPage();
await tv.setViewportSize({ width: 1920, height: 1080 });
await tv.goto(`${U}/evento/${evento.id}/tv`, { waitUntil: "networkidle" }); await tv.waitForTimeout(1500);
ok(await tv.locator("text=Pista 3 suspendida (lluvia)").count() === 1, "la TV avisa la pista suspendida");
await tv.screenshot({ path: `${out}/lluvia-5-tv.png` });

// Reactivar
await p.locator("button:has-text('Reactivar Pista 3')").click(); await espera(2500);
const e2 = await servidor();
ok(!e2.pistasSuspendidas?.length, "se reactiva la pista");
ok(e2.rondas.filter((x) => x.numero >= 3).some((x) => x.partidos.some((y) => y.pista === 3)), "las rondas que faltan vuelven a usar la pista 3");
ok(!errs.length, `sin errores en la página ${errs.join(" | ")}`);
await b.close();
console.log(fallos ? `${fallos} FALLOS` : "TODO OK");
process.exit(fallos ? 1 : 0);
