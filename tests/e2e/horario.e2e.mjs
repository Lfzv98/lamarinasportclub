// Prueba en navegador del selector de fecha y horas (paso Pistas y rondas), en celular y computadora:
//   npm run build && npm start   y luego   node tests/e2e/horario.e2e.mjs [carpeta-capturas]
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errs = [];
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; console.log((c ? "PASS " : "FAIL ") + m); };

for (const [nombre, viewport] of [["celular", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport });
  await ctx.request.post(`${U}/api/staff/login`, { data: { pin: PIN } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  const espera = (ms = 450) => p.waitForTimeout(ms);
  const boton = (et) => p.locator(`button[aria-label^='${et}:']`);
  const dialogo = p.getByRole("dialog");
  await p.goto(`${U}/setup?paso=2`, { waitUntil: "networkidle" }); await espera(1000);
  await p.locator("text=Rellenar con jugadores demo").click(); await espera();
  await p.locator("footer button:has-text('Siguiente')").click(); await espera(1000);
  ok(await boton("Fecha").count() === 1 && (await boton("Inicio").count()) === 1 && (await boton("Fin").count()) === 1, `${nombre}: botones Fecha, Inicio y Fin`);
  await p.screenshot({ path: `${out}/horario-${nombre}.png`, fullPage: true });

  // Fecha: calendario con atajos
  await boton("Fecha").click(); await espera(700);
  ok(await dialogo.count() === 1, `${nombre}: se abre el calendario`);
  const caja = await dialogo.boundingBox();
  if (nombre === "celular") ok(Math.abs(caja.y + caja.height - viewport.height) < 4, `celular: sube desde abajo (bottom sheet)`);
  else ok(caja.y > 20 && caja.y + caja.height < viewport.height - 20, `desktop: aparece centrada`);
  await p.screenshot({ path: `${out}/horario-${nombre}-fecha.png` });
  await dialogo.getByRole("button", { name: "Mañana" }).click(); await espera(700);
  ok(await dialogo.count() === 0, `${nombre}: al elegir Mañana se cierra`);
  const manana = new Date(Date.now() + 864e5);
  const dd = String(manana.getDate());
  ok((await boton("Fecha").getAttribute("aria-label")).includes(dd), `${nombre}: la fecha queda en mañana (${dd})`);

  // Inicio: 18:30
  await boton("Inicio").click(); await espera(700);
  await dialogo.getByRole("button", { name: "18", exact: true }).click();
  await dialogo.getByRole("button", { name: ":30" }).click();
  await p.screenshot({ path: `${out}/horario-${nombre}-inicio.png` });
  await dialogo.getByRole("button", { name: /Listo · 18:30/ }).click(); await espera(700);
  ok((await boton("Inicio").getAttribute("aria-label")).includes("18:30"), `${nombre}: inicio 18:30`);

  // Fin: atajo 2 h 30 min → 21:00
  await boton("Fin").click(); await espera(700);
  await dialogo.getByRole("button", { name: "2 h 30 min" }).click();
  await p.screenshot({ path: `${out}/horario-${nombre}-fin.png` });
  await dialogo.getByRole("button", { name: /Listo · 21:00/ }).click(); await espera(700);
  ok((await boton("Fin").getAttribute("aria-label")).includes("21:00"), `${nombre}: fin 21:00 con el atajo 2 h 30 min`);

  // Escape cierra sin cambiar
  await boton("Fin").click(); await espera(600);
  await p.keyboard.press("Escape"); await espera(600);
  ok(await dialogo.count() === 0 && (await boton("Fin").getAttribute("aria-label")).includes("21:00"), `${nombre}: Escape cierra sin cambiar`);
  ok(await p.locator("text=Reservado de 18:30 a 21:00").count() + (await p.locator("text=termina aprox").count()) > 0, `${nombre}: el resumen usa el horario elegido`);
  await p.screenshot({ path: `${out}/horario-${nombre}-final.png`, fullPage: true });
  await ctx.close();
}
console.log(errs.length ? "ERRORES JS:\n" + errs.join("\n") : "sin errores de JavaScript");
if (fallos || errs.length) process.exitCode = 1;
await b.close();
