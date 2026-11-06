// Prueba en navegador de los arreglos tras la demo de venta del americano:
// 1) "Nuevo Americano" sin sesión: después del PIN sigue directo al setup.
// 2) Un borrador viejo (de otro día) no se recupera: el americano sale con la fecha de hoy.
// 3) Servidor reiniciado (memoria vacía): el QR y la TV muestran "Buscando el evento…"
//    y se abren solos cuando el celular del staff lo vuelve a subir.
// 4) Celular del staff con la sesión vencida y el servidor sin sus americanos: pide el PIN.
//   npm run build && npm start   y luego   node tests/e2e/demo-venta.e2e.mjs [carpeta-capturas]
// Las pruebas 3 y 4 reinician el servidor (como un deploy o un servidor nuevo en Vercel en
// modo DEMO) con el comando de REINICIAR; sin esa variable se saltan. Ejemplo:
//   REINICIAR='pkill -f ^next-server; (npm start > /dev/null 2>&1 &)' node tests/e2e/demo-venta.e2e.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; console.log((c ? "PASS " : "FAIL ") + m); };
const errs = [];
const vp = { viewport: { width: 390, height: 844 } };
const hoy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

const A = await b.newContext(vp);
const p = await A.newPage();
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());
const w = (ms = 600) => p.waitForTimeout(ms);

/* 1) PIN → setup */
await p.goto(`${U}/americanos`, { waitUntil: "networkidle" }); await w(800);
// Borrador abandonado de hace 2 semanas, con fecha vieja y un jugador.
await p.evaluate(() => localStorage.setItem("lamarina-setup-borrador", JSON.stringify({ fecha: "2026-01-02", jugadores: [{ id: "jug_viejo", nombre: "Viejo", genero: "M", nivel: "5TA" }], _t: Date.now() - 14 * 86400_000 })));
await p.locator("text=Nuevo Americano").first().click(); await w(800);
ok(await p.locator("[aria-label='Ingreso de staff']").isVisible(), "sin sesión, Nuevo Americano pide el PIN");
for (const d of PIN) { await p.getByRole("button", { name: d, exact: true }).click(); await w(120); }
await p.waitForURL(/\/setup/, { timeout: 8000 }).catch(() => {});
ok(p.url().includes("/setup"), "después del PIN sigue directo al setup");

/* 2) Borrador viejo descartado */
await w(800);
let vioViejo = false;
for (let i = 0; i < 8 && !(await p.locator("footer button:has-text('Crear y abrir cuadro')").count()); i++) {
  if (await p.locator("text=Viejo").count()) vioViejo = true;
  const llenar = async (sel, nombres) => { if (await p.locator(sel).count()) { await p.fill(sel, nombres); await p.keyboard.press("Enter"); await w(); } };
  await llenar("input[placeholder='Nombre de la jugadora']", "Ana, Bea, Carla, Dani, Eva, Fabi, Gaby, Hilda");
  await llenar("input[placeholder='Nombre del jugador']", "Luis, Moncho, Juan, Pedro, Raul, Saul, Tito, Uri");
  await llenar("input[placeholder^='Nombre Apellido']", "Ana, Bea, Carla, Dani, Eva, Fabi, Gaby, Hilda");
  await p.locator("footer button:has-text('Siguiente')").click(); await w(900);
}
ok(!vioViejo, "el borrador de hace 2 semanas no se recupera (sin jugadores viejos)");
await p.locator("footer button:has-text('Crear y abrir cuadro')").click();
await p.waitForURL(/\/evento\/evt_/, { timeout: 15000 });
const id = p.url().split("/evento/")[1].split("/")[0];
await w(1500);
const ev = (await (await A.request.get(`${U}/api/americanos/${id}`)).json()).evento;
ok(ev?.fecha === hoy, `el americano nuevo sale con la fecha de hoy (${ev?.fecha})`);

async function reiniciar() {
  execSync(process.env.REINICIAR, { stdio: "ignore", shell: "/bin/bash" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { if ((await fetch(`${U}/api/americanos`)).ok) return; } catch { /* arrancando */ }
  }
  throw new Error("El servidor no volvió a arrancar");
}

/* 3) Servidor sin el evento: QR y TV esperan y se recuperan solos */
if (process.env.REINICIAR) {
  await reiniciar();
  // El reinicio no borra la sesión firmada (STAFF_SECRET), pero sí la memoria.
  const borrado = (await fetch(`${U}/api/americanos/${id}`)).status;
  ok(borrado === 404, "tras reiniciar, el servidor ya no tiene el americano (modo DEMO)");
  const P = await b.newContext(vp); const q = await P.newPage();
  await q.goto(`${U}/evento/${id}/tabla`, { waitUntil: "networkidle" }); await q.waitForTimeout(2500);
  ok(await q.locator("text=Buscando el evento").isVisible(), "QR sin el evento en el servidor: 'Buscando el evento…' (no un callejón sin salida)");
  await q.screenshot({ path: `${out}/dv-buscando.png` });
  // El celular del staff abre la app: lo vuelve a subir.
  await p.reload({ waitUntil: "networkidle" }); await w(2500);
  await q.waitForSelector("text=Ranking", { timeout: 15000 }).catch(() => {});
  ok(!(await q.locator("text=Buscando el evento").count()), "en cuanto el staff abre la app, el QR muestra el ranking solo");
  await P.close();

  /* 4) Sesión vencida en el celular del staff */
  await A.clearCookies();
  await reiniciar();
  await p.goto(`${U}/americanos`, { waitUntil: "networkidle" }); await w(2500);
  ok(await p.locator("[aria-label='Ingreso de staff']").isVisible(), "sesión vencida y el servidor sin el americano: pide el PIN para volver a publicarlo");
  for (const d of PIN) { await p.getByRole("button", { name: d, exact: true }).click(); await w(120); }
  await w(2500);
  ok((await fetch(`${U}/api/americanos/${id}`)).status === 200, "con el PIN, el americano vuelve a estar en el servidor");
} else console.log("SKIP pruebas 3 y 4: falta REINICIAR");
ok(errs.length === 0, "sin errores de JavaScript" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
console.log(fallos ? `${fallos} fallo(s)` : "Todo OK");
process.exit(fallos ? 1 : 0);
