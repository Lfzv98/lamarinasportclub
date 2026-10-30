// Prueba en navegador del Modo TV renovado y las fotos del americano: foto de cada dupla al
// inscribirla, vallas publicitarias en Ajustes y en la TV (sin podio, logo de fondo) e imagen
// del podio para redes al terminar. Igual que las otras:
//   npm run build && npm start   y luego   node tests/e2e/tv-fotos.e2e.mjs [carpeta-capturas]
import { writeFileSync } from "node:fs";
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
const evento = async (id) => (await (await ctx.request.get(`${U}/api/americanos/${id}`)).json()).evento;

/** Imagen de prueba (una "foto" o un banner) dibujada en el navegador. */
async function imagen(w, h, color, texto, tipo = "image/jpeg") {
  const data = await p.evaluate(([w, h, color, texto, tipo]) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = color;
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#fff";
    x.font = `bold ${Math.round(h / 3)}px sans-serif`;
    x.textBaseline = "middle";
    x.fillText(texto, w * 0.08, h / 2);
    return c.toDataURL(tipo);
  }, [w, h, color, texto, tipo]);
  return { name: `${texto}.${tipo === "image/png" ? "png" : "jpg"}`, mimeType: tipo, buffer: Buffer.from(data.split(",")[1], "base64") };
}

/* 1) Registro de duplas con foto antes de presionar "Dupla" y tocando el avatar después */
await p.goto(`${U}/setup`, { waitUntil: "networkidle" }); await espera(800);
await p.locator("text=Empezar de cero").click().catch(() => {}); await espera(800);
await p.locator("button[role='radio']:has-text('Masculino')").click(); await espera(200);
await siguiente();
await p.locator("button:has-text('Dupla fija')").first().click(); await espera(200);
await siguiente();
const colores = ["#e4572e", "#2e86de", "#10ac84", "#8e44ad"];
const duplas = [["Arturo Pérez", "Josué Díaz"], ["Víctor Mora", "Aníbal Ruiz"], ["Jesús Paz", "Junior León"], ["Mario Sosa", "Hugo Vera"]];
for (const [i, [a, bb]] of duplas.entries()) {
  await p.locator("input[placeholder='Jugador 1']").fill(a); await p.locator("input[placeholder='Jugador 2']").fill(bb);
  if (i < 2) {
    await p.locator("button[aria-label='Foto de la dupla'] + input[type=file]").setInputFiles(await imagen(800, 600, colores[i], `D${i + 1}`));
    await p.waitForSelector("img[alt='Foto de la dupla']");
  }
  await p.getByRole("button", { name: "Dupla", exact: true }).click(); await espera(300);
}
ok(await p.locator("text=Pide permiso antes de tomarla").count() > 0, "aviso de permiso junto a las fotos");
await p.locator(`button[aria-label='Foto de ${duplas[2][0].split(" ")[0]} y ${duplas[2][1].split(" ")[0]}'] + input[type=file]`).setInputFiles(await imagen(800, 600, colores[2], "D3"));
await espera(800);
ok(await p.locator("ul img[alt*=' y ']").count() === 3, "3 duplas con foto en la lista (2 antes de agregar, 1 tocando el avatar)");
await p.screenshot({ path: `${out}/registro-fotos.png`, fullPage: true });
await siguiente(); await siguiente();
await p.locator("footer button.btn-neon").click(); await p.waitForURL(/\/evento\/evt_/);
const id = p.url().split("/evento/")[1].split(/[/?]/)[0];
let e = null;
for (let i = 0; i < 20; i++) {
  await espera(1000);
  e = await evento(id).catch(() => null);
  if (e && e.parejas.filter((x) => x.fotoUrl).length === 3) break;
}
ok(e?.parejas.filter((x) => x.fotoUrl).length === 3, `las fotos se subieron solas al crear el evento (${e?.parejas.filter((x) => x.fotoUrl).length ?? 0}/3)`);
const foto = e?.parejas.find((x) => x.fotoUrl)?.fotoUrl;
ok(foto && (await ctx.request.get(`${U}${foto}`)).headers()["content-type"]?.startsWith("image/"), "la foto de la dupla se sirve como imagen");

/* 2) Ajustes de Americanos → Publicidad del Modo TV: 3 logos subidos de una vez y 1 marca solo con nombre */
const clubAntes = (await (await ctx.request.get(`${U}/api/club`)).json()).club;
await ctx.request.post(`${U}/api/club`, { data: { club: { ...clubAntes, vallas: [], actualizadoEn: new Date(Date.now() + 1000).toISOString() } } });
await p.goto(`${U}/americanos/ajustes`, { waitUntil: "networkidle" }); await espera(1500);
// Dos piezas de 1700 × 500 (cubren su tramo) y un logo de otra medida (centrado sobre negro).
const marcas = [["PADEL PRO", "#d62828", 1700, 500], ["POLAR", "#1d3fa8", 1700, 500], ["BANESCO", "#0b8a5b", 1200, 300]];
await p.locator("input[aria-label='Subir logos de marcas']").setInputFiles(await Promise.all(marcas.map(async ([n, c, w, h]) => ({ ...(await imagen(w, h, c, n, "image/png")), name: `${n}.png` }))));
await p.waitForFunction(() => document.querySelectorAll("input[aria-label^='Nombre de la marca']").length === 3, null, { timeout: 15_000 });
await p.locator("button:has-text('Marca sin logo')").click();
await p.getByLabel("Nombre de la marca 4").fill("Head");
await p.screenshot({ path: `${out}/ajustes-vallas.png`, fullPage: false });
await p.locator("footer button:has-text('Guardar cambios')").click(); await espera(1500);
const club = (await (await ctx.request.get(`${U}/api/club`)).json()).club;
ok(club.vallas?.length === 4 && club.vallas.filter((v) => v.img).length === 3 && club.vallas[3].nombre === "Head", "club guardado con 4 marcas (3 con logo, 1 solo nombre)");
ok(club.vallas[0].pieza === true && club.vallas[1].pieza === true && club.vallas[2].pieza === false, "1700 × 500 queda como pieza completa; otra medida, como logo");
ok(await p.locator("text=Pieza completa").count() === 2 && await p.locator("text=1700 × 500 px exactos").count() === 1, "Ajustes: medida pedida y etiqueta de cada marca");

/* 3) Modo TV en vivo: sin logo arriba, logo de fondo, vallas a la izquierda, sin podio */
await p.setViewportSize({ width: 1920, height: 1080 });
await p.goto(`${U}/evento/${id}/tv`, { waitUntil: "networkidle" }); await espera(2000);
ok(await p.locator("header img[alt='La Marina Sport Club']").count() === 1, "TV: logo arriba a la izquierda");
ok(await p.locator("main > div[aria-hidden] img[src='/brand/logo.png']").count() === 1, "TV: logo grande difuminado de fondo");
ok(await p.locator("aside[aria-label='Publicidad'] .valla-cinta").count() === 1, "TV: banda publicitaria abajo que corre");
ok(await p.locator("text=Podio").count() === 0, "TV: sin podio");
await p.screenshot({ path: `${out}/tv-vivo.png` });
ok(await p.locator("aside[aria-label='Publicidad'] .valla-cinta img.object-cover").count() > 0, "TV: las piezas cubren su tramo de borde a borde");

// Termina el americano con marcadores (más alto para la dupla 1).
const ev = await evento(id);
const fuerza = Object.fromEntries(ev.parejas.map((x, i) => [x.id, 4 - i]));
const ahora = new Date().toISOString();
for (const ro of ev.rondas) {
  ro.estado = "FINALIZADA";
  for (const pa of ro.partidos) {
    const a = fuerza[pa.parejaA.id] >= fuerza[pa.parejaB.id];
    pa.resultado = { puntosA: a ? 14 : 10, puntosB: a ? 10 : 14 };
    pa.estado = "FINALIZADO";
    pa.actualizadoEn = ahora;
  }
}
ev.estado = "FINALIZADO";
ev.actualizadoEn = ahora;
ok((await ctx.request.post(`${U}/api/americanos`, { data: { evento: ev } })).ok(), "americano terminado");
await p.goto(`${U}/evento/${id}/tv`, { waitUntil: "networkidle" }); await espera(2500);
ok(await p.locator("text=Resultado final").count() > 0 && (await p.locator("text=Podio").count()) === 0, "TV final: tabla con letra grande, sin podio");
await p.screenshot({ path: `${out}/tv-final.png` });
await p.setViewportSize({ width: 1080, height: 1920 }); await espera(1200);
await p.screenshot({ path: `${out}/tv-vertical.png` });

/* 4) Celular con el QR (sin sesión): botón de la imagen del podio solo al terminar */
const publico = await b.newContext({ ...vp, deviceScaleFactor: 2 });
const m = await publico.newPage();
m.on("pageerror", (e) => errs.push(e.message));
await m.goto(`${U}/evento/${id}/tabla`, { waitUntil: "networkidle" }); await m.waitForTimeout(2000);
ok(await m.locator("text=Descarga tu imagen del podio").count() === 1, "QR: botón para descargar la imagen del podio");
await m.screenshot({ path: `${out}/qr-boton.png` });
await m.locator("text=Descarga tu imagen del podio").click(); await m.waitForTimeout(600);
await m.locator("[role=dialog] ul button").first().click();
await m.waitForSelector("[role=dialog] img[alt^='Campeones']", { timeout: 15_000 });
await m.waitForTimeout(400);
await m.screenshot({ path: `${out}/qr-imagen.png` });
const png = await m.evaluate(async () => {
  const src = document.querySelector("[role=dialog] img[alt^='Campeones']").src;
  const blob = await (await fetch(src)).blob();
  return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
});
writeFileSync(`${out}/imagen-podio.png`, Buffer.from(png.split(",")[1], "base64"));
ok(png.length > 50_000, "imagen del podio generada (1080 × 1350)");
ok(await m.locator("[role=dialog] a[download]:has-text('Descargar')").count() === 1, "botón Descargar");

// Un americano en curso no muestra el botón.
const p2 = await (await ctx.request.post(`${U}/api/demo`, { data: { accion: "americano" } })).json();
await m.goto(`${U}/evento/${p2.id}/tabla`, { waitUntil: "networkidle" }); await m.waitForTimeout(1500);
ok(await m.locator("text=Descarga tu imagen del podio").count() === 0, "QR: sin botón mientras el americano no termina");

ok(errs.length === 0, `sin errores en la página${errs.length ? `: ${errs.join(" | ")}` : ""}`);
await b.close();
console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTODO OK");
process.exit(fallos ? 1 : 0);
