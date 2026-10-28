// Prueba en navegador del Americano HABIBI Tournament de punta a punta:
// el staff arma el torneo (8 + 8 duplas), se juegan los grupos, se arma la llave
// desde octavos y se cargan todos los cruces hasta la final (con un empate que se
// define con punto de oro). También revisa la vista del jugador (QR) y el Modo TV.
// Requiere la app corriendo:  npm run build && npm start
//   node tests/e2e/habibi.e2e.mjs [carpeta-capturas]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2];
if (out) mkdirSync(out, { recursive: true });
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errs = [];
let fallos = 0;
const ok = (c, m) => {
  if (!c) fallos++;
  console.log((c ? "PASS " : "FAIL ") + m);
};
const foto = async (p, nombre, full = false) => {
  if (!out) return;
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${nombre}.png`, fullPage: full });
};
const nuevo = async (ctx) => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept(d.type() === "prompt" ? "REHACER" : undefined));
  return p;
};
const MOV = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const S = await b.newContext(MOV);
if (!(await S.request.post(`${U}/api/staff/login`, { data: { pin: PIN } })).ok()) throw new Error("No se pudo ingresar como staff");
const p = await nuevo(S);

// 1) Inicio: la tarjeta nueva está entre Americanos y Torneos
await p.goto(U, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const titulos = await p.locator("main h2").allTextContents();
const iA = titulos.findIndex((t) => t.trim() === "Americanos");
const iH = titulos.findIndex((t) => t.includes("HABIBI"));
const iT = titulos.findIndex((t) => t.trim() === "Torneos");
ok(iA >= 0 && iA < iH && iH < iT, `inicio: HABIBI va entre Americanos y Torneos (${titulos.join(" | ")})`);
await foto(p, "01-inicio", true);
await p.click("text=Americano HABIBI Tournament");
await p.waitForURL("**/habibi");
await foto(p, "02-habibi");

// 2) Asistente
await p.goto(`${U}/habibi/nuevo`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await foto(p, "03-paso-torneo", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
ok(await p.locator("text=Duplas por grupo").count() > 0, "asistente: paso de duplas");
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(400);
ok(await p.locator("text=Duplas por grupo").count() > 0, "asistente: sin duplas no deja avanzar");
const NOMBRES = ["Luis", "Ana", "Juan", "Sofía", "Pedro", "Carla", "José", "María", "Diego", "Lucía", "Andrés", "Valentina", "Carlos", "Paola", "Miguel", "Daniela"];
for (const [g, letra] of [[0, "A"], [1, "B"]]) {
  await p.getByRole("button", { name: new RegExp(`Grupo\\s*${letra}`) }).click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await p.getByLabel("Hombre de la dupla").fill(`${NOMBRES[i * 2]} ${letra}${i + 1}`);
    await p.getByLabel("Mujer de la dupla").fill(`${NOMBRES[i * 2 + 1]} ${letra}${i + 1}`);
    await p.getByLabel("Mujer de la dupla").press("Enter");
    await p.waitForTimeout(80);
  }
  ok((await p.locator("li", { hasText: `${letra}${8}` }).count()) > 0, `asistente: 8 duplas en el grupo ${letra}`);
}
await foto(p, "04-paso-duplas", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
ok(await p.locator("text=Fase de grupos").count() > 0, "asistente: paso de grupos");
await foto(p, "05-paso-grupos", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
ok(await p.locator("text=1A vs 3A").count() > 0 || (await p.locator("text=/1A\\s*vs\\s*3A/").count()) > 0, "asistente: muestra los cruces de octavos de la hoja");
await p.getByRole("switch", { name: "Partido por el 3er puesto" }).click();
await foto(p, "06-paso-llave", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
await foto(p, "07-paso-listo", true);
await p.click("button:has-text('Crear torneo')");
await p.waitForURL(/\/habibi\/hab_/);
const id = p.url().split("/habibi/")[1];
await p.waitForTimeout(1500);
ok(await p.locator("text=Grupo A").count() > 0 && (await p.locator("text=Grupo B").count()) > 0, "torneo: muestra los dos grupos");
await foto(p, "08-torneo-grupos", true);

// Un grupo se juega desde su cuadro vivo: cargar un marcador real por la interfaz
const grupoA = await p.locator("a:has-text('Cuadro y marcadores')").first().getAttribute("href");
await p.goto(U + grupoA, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
ok(await p.locator("text=HABIBI · Grupo A").count() > 0, "grupo: se identifica como parte del HABIBI");
await p.locator("button:has-text('Cargar marcador')").first().click();
await p.waitForTimeout(400);
for (let i = 0; i < 9; i++) await p.getByLabel("Sumar").first().click();
await p.click("text=Guardar resultado");
await p.waitForTimeout(600);
await foto(p, "09-grupo-cuadro");

// 3) El resto de los grupos se carga por la API (lo mismo que haría el staff en cada pista)
await p.evaluate(async (torneo) => {
  const { eventos } = await (await fetch("/api/americanos?todos=1")).json();
  for (const e of eventos.filter((x) => x.habibi?.torneoId === torneo)) {
    const orden = e.parejas.map((x) => x.id);
    const ahora = new Date(Date.now() + 5000).toISOString();
    for (const r of e.rondas) {
      r.estado = "FINALIZADA";
      for (const m of r.partidos) {
        if (m.resultado) continue;
        const gana = orden.indexOf(m.parejaA.id) < orden.indexOf(m.parejaB.id);
        m.resultado = gana ? { puntosA: 10, puntosB: 6 } : { puntosA: 6, puntosB: 10 };
        m.estado = "FINALIZADO";
        m.actualizadoEn = ahora;
      }
    }
    e.estado = "FINALIZADO";
    e.actualizadoEn = ahora;
    await fetch("/api/americanos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento: e }) });
  }
}, id);
await p.goto(`${U}/habibi/${id}`, { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
ok(await p.locator("text=Grupos terminados").count() > 0, "torneo: detecta que los grupos terminaron");
await foto(p, "10-grupos-terminados", true);

// TV en fase de grupos
const TV = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await nuevo(TV);
await tv.goto(`${U}/habibi/${id}/tv`, { waitUntil: "networkidle" });
await tv.waitForTimeout(2000);
ok((await tv.locator("img[src='/brand/logo.png']").count()) === 1, "TV: un solo logo (el de fondo), sin logo arriba a la izquierda");
ok(await tv.locator("h2:has-text('Grupo A')").count() > 0, "TV: tablas de los grupos");
await foto(tv, "11-tv-grupos");

// 4) Armar la llave
await p.click("button:has-text('Armar la llave')");
await p.waitForTimeout(1200);
const semillas = await p.locator("text=/^[1-8][AB]$/").allTextContents();
ok(semillas.slice(0, 4).join(",") === "1A,3A,6B,8B", `llave: octavos en el orden de la hoja (${semillas.slice(0, 8).join(",")})`);
await foto(p, "12-llave-armada", true);

// 5) Cargar todos los cruces desde la interfaz; uno empatado se define con punto de oro
let cargados = 0;
let empate = false;
for (let vuelta = 0; vuelta < 20; vuelta++) {
  const tarjeta = p.locator("button:has-text('Por jugar')").first();
  if (!(await tarjeta.count())) break;
  await tarjeta.click();
  await p.waitForTimeout(400);
  const clics = !empate ? 8 : 9;
  for (let i = 0; i < clics; i++) await p.getByLabel("Sumar").first().click();
  if (!empate) {
    ok(await p.locator("text=¿Quién ganó el punto de oro?").count() > 0, "llave: 8-8 pide el punto de oro");
    ok(await p.locator("button:has-text('Guardar resultado')").isDisabled(), "llave: sin elegir no deja guardar el empate");
    await foto(p, "13-empate-punto-de-oro");
    await p.locator("text=¿Quién ganó el punto de oro?").locator("..").locator("button").nth(1).click();
    empate = true;
  }
  await p.click("button:has-text('Guardar resultado')");
  await p.waitForTimeout(500);
  cargados++;
}
ok(cargados === 16, `llave: 8 octavos + 4 cuartos + 2 semis + 3er puesto + final = ${cargados} partidos`);
await p.waitForTimeout(800);
ok(await p.locator("text=Campeones").count() > 0, "llave: muestra a los campeones");
await foto(p, "14-campeones", true);
await tv.waitForTimeout(3000);
await foto(tv, "15-tv-final");

// 6) Jugador que escanea el QR: ve todo y no puede cargar
const J = await b.newContext(MOV);
const pj = await nuevo(J);
await pj.goto(`${U}/habibi/${id}`, { waitUntil: "networkidle" });
await pj.waitForTimeout(2000);
ok(await pj.locator("text=Modo espectador").count() > 0, "jugador: modo espectador");
ok(await pj.locator("text=Campeones").count() > 0, "jugador: ve el podio");
await foto(pj, "16-jugador", true);

// 7) TV en plena llave: rehacer y cargar solo octavos
await p.click("button:has-text('Rehacer la llave')");
await p.waitForTimeout(1200);
for (let i = 0; i < 8; i++) {
  await p.locator("button:has-text('Octavos'):has-text('Por jugar')").first().click();
  await p.waitForTimeout(300);
  for (let k = 0; k < 10; k++) await p.getByLabel("Sumar").first().click();
  await p.click("button:has-text('Guardar resultado')");
  await p.waitForTimeout(400);
}
// La TV está en otro equipo: se entera en la siguiente sincronización.
const pasa = await tv.locator("h2:has-text('Cuartos de final')").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
ok(pasa, "TV: pasa sola a cuartos");
await foto(tv, "17-tv-cuartos");

// 8) Grupos individuales (mixto): cambian de pareja cada ronda y las duplas de la llave salen del ranking
await p.goto(`${U}/habibi/nuevo`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
await p.click("button:has-text('Individual')");
await p.waitForTimeout(300);
ok(await p.locator("text=Jugadores por grupo").count() > 0, "individual: el paso pasa a jugadores");
for (const letra of ["A", "B"]) {
  await p.getByRole("button", { name: new RegExp(`Grupo\\s*${letra}`) }).click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 16; i++) {
    await p.getByRole("button", { name: i % 2 ? "Ella" : "Él", exact: true }).click();
    await p.getByLabel("Nombre del jugador").fill(`${NOMBRES[i]} ${letra}${i + 1}`);
    await p.getByLabel("Nombre del jugador").press("Enter");
    await p.waitForTimeout(60);
  }
  ok(await p.locator("text=8 hombres y 8 mujeres").count() > 0, `individual: 16 jugadores en el grupo ${letra} (8 y 8)`);
}
await foto(p, "18-individual-jugadores", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
ok(await p.locator("text=/Cada jugador juega/").count() > 0, "individual: plan de rondas por jugador");
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
ok(await p.locator("text=¿Cómo se forman las duplas de la llave?").count() > 0, "individual: elige cómo se forman las duplas de la llave");
await foto(p, "19-individual-llave", true);
await p.click("button:has-text('Siguiente')");
await p.waitForTimeout(500);
await p.click("button:has-text('Crear torneo')");
await p.waitForURL(/\/habibi\/hab_/);
const id2 = p.url().split("/habibi/")[1];
await p.waitForTimeout(1500);
ok(await p.locator("text=/16 jugadores · individual/").count() === 2, "individual: los dos grupos son individuales");
await p.evaluate(async (torneo) => {
  const { eventos } = await (await fetch("/api/americanos?todos=1")).json();
  for (const e of eventos.filter((x) => x.habibi?.torneoId === torneo)) {
    const ahora = new Date(Date.now() + 5000).toISOString();
    for (const r of e.rondas) {
      r.estado = "FINALIZADA";
      for (const m of r.partidos) {
        m.resultado = { puntosA: 10, puntosB: 6 };
        m.estado = "FINALIZADO";
        m.actualizadoEn = ahora;
      }
    }
    e.estado = "FINALIZADO";
    e.actualizadoEn = ahora;
    await fetch("/api/americanos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento: e }) });
  }
}, id2);
await p.goto(`${U}/habibi/${id2}`, { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
await foto(p, "20-individual-grupos", true);
await p.click("button:has-text('Armar la llave')");
await p.waitForTimeout(1200);
ok((await p.locator("button:has-text('Por jugar')").count()) === 8, "individual: la llave arma 8 octavos con duplas del ranking");
await foto(p, "21-individual-llave-armada", true);

console.log(errs.length ? "Errores JS:\n" + [...new Set(errs)].join("\n") : "Sin errores JS");
await b.close();
if (fallos || errs.length) process.exit(1);
