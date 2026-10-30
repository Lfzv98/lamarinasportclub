// Modo TV del americano con todo tipo de evento: dupla fija, individual y mixto; puntos, games y
// sets; de 1 a 6 pistas; pocos o muchos en espera; con y sin una pista suspendida por lluvia.
// Verifica que ninguna tarjeta de pista ni la lista "En espera" se monten una sobre otra ni se
// desborden, en TV horizontal, laptop y pantalla vertical. Igual que las otras:
//   npm run build && npm start   y luego   node tests/e2e/tv-espera.e2e.mjs [carpeta-capturas]
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const U = process.env.APP_URL ?? "http://localhost:3000";
const PIN = process.env.STAFF_PIN ?? "1234";
let fallos = 0;
const ok = (c, m) => { if (!c) fallos++; if (!c || process.env.VERBOSO) console.log((c ? "PASS " : "FAIL ") + m); };

const CASOS = [
  ["DUPLA_FIJA", 4, 2, "PUNTOS_TOTALES"], ["DUPLA_FIJA", 5, 2, "GAMES_PUNTO_ORO"], ["DUPLA_FIJA", 8, 4, "SETS_CORTOS"],
  ["DUPLA_FIJA", 16, 4, "PUNTOS_TOTALES"], ["DUPLA_FIJA", 20, 6, "GAMES_PUNTO_ORO"], ["DUPLA_FIJA", 3, 1, "PUNTOS_TOTALES"],
  ["INDIVIDUAL", 8, 2, "PUNTOS_TOTALES"], ["INDIVIDUAL", 13, 3, "GAMES_PUNTO_ORO"], ["INDIVIDUAL", 30, 6, "SETS_CORTOS"],
  ["INDIVIDUAL", 48, 6, "PUNTOS_TOTALES"], ["INDIVIDUAL", 22, 4, "PUNTOS_TOTALES"], ["MIXTO", 12, 3, "GAMES_PUNTO_ORO"], ["MIXTO", 26, 5, "PUNTOS_TOTALES"],
];

const eventos = JSON.parse(execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "-e", `
  const { crearEvento, iniciarRonda, cargarResultado, suspenderPista } = await import("./lib/evento.ts");
  const nombres = ["Arturo","Josué","Víctor","Aníbal","Jesús","Junior","Mario","Hugo","Luis","Pedro","Raúl","Iván","Omar","Saúl","Tomás","Ángel","Daniela","Valentina","Gabriela","Mariángel","Alejandro","Sebastián","Fernando","Rosalía"];
  const cfg = { PUNTOS_TOTALES: [{ metodo: "PUNTOS_TOTALES", puntosPorPartido: 24 }, { puntosA: 14, puntosB: 10 }], GAMES_PUNTO_ORO: [{ metodo: "GAMES_PUNTO_ORO", gamesPorPartido: 6 }, { puntosA: 6, puntosB: 4 }], SETS_CORTOS: [{ metodo: "SETS_CORTOS", gamesPorPartido: 4, setsMaximos: 3 }, { puntosA: 0, puntosB: 0, sets: [{ a: 4, b: 2 }, { a: 3, b: 4 }, { a: 4, b: 1 }] }] };
  const salida = [];
  for (const [mod, n, pistas, metodo] of ${JSON.stringify(CASOS)}) for (const lluvia of [false, true]) {
    const dupla = mod === "DUPLA_FIJA";
    const js = [], ps = [];
    const k = dupla ? n * 2 : n;
    for (let i = 0; i < k; i++) js.push({ id: "j" + i, nombre: nombres[i % nombres.length], apellido: "Apellidolargo" + i, genero: mod === "MIXTO" ? (i % 2 ? "F" : "M") : "M" });
    if (dupla) for (let i = 0; i < n; i++) ps.push({ id: "p" + i, jugadorIds: ["j" + 2 * i, "j" + (2 * i + 1)], nombre: js[2 * i].nombre + " / " + js[2 * i + 1].nombre });
    const canchas = Array.from({ length: pistas }, (_, i) => ({ numero: i + 1, nombre: "Pista " + (i + 1), techada: i > 0, activa: true }));
    let e = iniciarRonda(crearEvento({ nombre: mod + " " + n + " en " + pistas + (lluvia ? " con lluvia" : ""), categoria: { rama: mod === "MIXTO" ? "MIXTO" : "MASCULINO", nivel: "5TA" }, modalidad: dupla ? "DUPLA_FIJA" : "INDIVIDUAL_ROTATIVO",
      puntuacion: cfg[metodo][0], pistas, canchas, duracionRondaMin: 15, totalRondas: 4, jugadores: js, parejas: ps, semilla: 9 }));
    const r1 = e.rondas[0].partidos;
    if (r1.length) e = cargarResultado(e, r1[0].id, cfg[metodo][1]);
    if (lluvia && pistas > 1) e = suspenderPista(e, r1.at(-1).pista, { marcador: "3-2" });
    salida.push(e);
  }
  console.log(JSON.stringify(salida));
`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await b.newContext();
if (!(await ctx.request.post(`${U}/api/staff/login`, { data: { pin: PIN } })).ok()) throw new Error("No se pudo ingresar como staff");
for (const e of eventos) ok((await ctx.request.post(`${U}/api/americanos`, { data: { evento: e } })).ok(), `se guarda ${e.nombre}`);

const PANTALLAS = [["tv", 1920, 1080], ["laptop", 1366, 768], ["vertical", 1080, 1920]];
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
let revisados = 0;
for (const [pantalla, w, h] of PANTALLAS) {
  await p.setViewportSize({ width: w, height: h });
  for (const e of eventos) {
    await p.goto(`${U}/evento/${e.id}/tv`, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const cajas = [...document.querySelectorAll("[data-pista-tv], [data-espera-tv]")].map((el) => ({ el, r: el.getBoundingClientRect() }));
      const choques = [];
      for (let i = 0; i < cajas.length; i++)
        for (let j = i + 1; j < cajas.length; j++) {
          const a = cajas[i].r, c = cajas[j].r;
          if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) choques.push(`${i}-${j}`);
        }
      const desbordes = cajas.filter(({ el }) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2).length;
      return { pistas: document.querySelectorAll("[data-pista-tv]").length, choques, desbordes };
    });
    const msg = `${pantalla}: ${e.nombre}`;
    ok(r.pistas === e.rondas[0].partidos.length, `${msg} muestra ${r.pistas} pistas`);
    ok(!r.choques.length, `${msg} sin tarjetas montadas (${r.choques.join(", ")})`);
    ok(!r.desbordes, `${msg} sin textos desbordados (${r.desbordes})`);
    if (!r.choques.length && !r.desbordes) revisados++;
    else await p.screenshot({ path: `${out}/tv-falla-${pantalla}-${e.nombre.replace(/\W+/g, "-")}.png` });
  }
}
ok(!errs.length, `sin errores en la página ${errs.join(" | ")}`);
await b.close();
console.log(`${revisados} pantallas revisadas sin problemas`);
console.log(fallos ? `${fallos} FALLOS` : "TODO OK");
process.exit(fallos ? 1 : 0);
