"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Camera,
  CircleAlert,
  FileText,
  HeartPulse,
  IdCard,
  Loader2,
  Mail,
  Medal,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { comprimirFoto } from "@/lib/fotos";
import { vibrar } from "@/lib/feedback";
import { erroresJugador, LADOS, libres, nombreInscrito, nombrePropio, normalizarJugador, TALLAS, TIPOS_PAGO } from "@/lib/inscripcion";
import type { ApiInscripcionPublica, CupoCategoria, JugadorInscripcion, MetodoPago } from "@/types/inscripcion";
import { Campo, DatoCopiable, Entrada, Opciones } from "./piezas";

type Borrador = {
  categoriaId: string;
  jugadores: [Partial<JugadorInscripcion>, Partial<JugadorInscripcion>];
  acepta: boolean;
  metodoId: string;
  referencia: string;
};

const VACIO: Borrador = { categoriaId: "", jugadores: [{}, {}], acepta: false, metodoId: "", referencia: "" };

export interface Resultado {
  codigo: string;
  estado: string;
  categoria: string;
  dupla: string;
  metodo?: string;
}

const leer = (k: string) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null");
  } catch {
    return null;
  }
};
const escribir = (k: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
};

/** Formulario paso a paso: categoría → jugador 1 → jugador 2 → reglamento → pago. Guarda el borrador en el dispositivo. */
export function Formulario({ data, onListo }: { data: ApiInscripcionPublica; onListo: (r: Resultado) => void }) {
  const cfg = data.config!;
  const claveBorrador = `lm-insc-borrador:${data.torneo.id}`;
  const [b, setB] = useState<Borrador>(VACIO);
  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[] | null>(null);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [web, setWeb] = useState("");
  // Si el ranking FVP dice que el jugador no puede jugar esta categoría, no se avanza.
  const [fvpBloquea, setFvpBloquea] = useState<string | null>(null);
  const arriba = useRef<HTMLDivElement>(null);
  const cargado = useRef(false);

  useEffect(() => {
    const x = leer(claveBorrador) as Borrador | null;
    if (x?.jugadores) setB({ ...VACIO, ...x });
    cargado.current = true;
  }, [claveBorrador]);
  useEffect(() => {
    if (cargado.current) escribir(claveBorrador, b);
  }, [b, claveBorrador]);

  const cat = data.categorias.find((c) => c.id === b.categoriaId);
  const conPago = cfg.precioDupla > 0 && cfg.metodosPago.length > 0;
  const pasos = ["Categoría", "Jugador 1", "Jugador 2", "Reglamento", ...(conPago ? ["Pago"] : [])];
  const metodo = cfg.metodosPago.find((m) => m.id === b.metodoId);

  const setJ = (i: 0 | 1, cambios: Partial<JugadorInscripcion>) => {
    // Al corregir un campo se borra su aviso.
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in cambios))));
    setB((x) => {
      const js = [...x.jugadores] as Borrador["jugadores"];
      js[i] = { ...js[i], ...cambios };
      return { ...x, jugadores: js };
    });
  };

  /** En categorías de una sola rama el género se deduce. */
  const generoFijo = cat?.rama === "MASCULINO" ? "M" : cat?.rama === "FEMENINO" ? "F" : null;

  const mover = (a: number) => {
    setPaso(a);
    setErrores({});
    setFvpBloquea(null);
    requestAnimationFrame(() => arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const validarPaso = (): boolean => {
    const e: Record<string, string> = {};
    if (paso === 0 && !cat) e.categoria = "Elige la categoría en la que juegan.";
    if (paso === 1 || paso === 2) {
      const i = (paso - 1) as 0 | 1;
      const j = normalizarJugador({ ...b.jugadores[i], genero: generoFijo ?? b.jugadores[i].genero }, cfg.pideTalla);
      Object.assign(e, erroresJugador(j, { pideTalla: cfg.pideTalla, pideEdad: !!cat?.pideEdad }));
      if (paso === 2) {
        const otra = normalizarJugador(b.jugadores[0], false);
        if (otra.cedula && otra.cedula === j.cedula) e.cedula = "Es la misma cédula del jugador 1.";
        if (cat?.rama === "MIXTO" && j.genero && otra.genero === j.genero) e.genero = "En Mixto la dupla es un hombre y una mujer.";
      }
      if (fvpBloquea && !e.cedula) e.fvp = fvpBloquea;
    }
    if (paso === 3 && !b.acepta) e.acepta = "Para inscribirse, los dos deben aceptar el reglamento.";
    setErrores(e);
    if (Object.keys(e).length) vibrar([20, 40, 20]);
    if (e.fvp) arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return !Object.keys(e).length;
  };

  const siguiente = () => {
    if (!validarPaso()) return;
    if (paso < pasos.length - 1) mover(paso + 1);
    else enviar();
  };

  const enviar = async () => {
    setEnviando(true);
    setErrorServidor(null);
    try {
      const jugadores = b.jugadores.map((j) => ({ ...j, genero: generoFijo ?? j.genero }));
      const r = await fetch(`/api/inscripciones/${encodeURIComponent(data.torneo.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoriaId: b.categoriaId,
          jugadores,
          aceptaReglamento: b.acepta,
          pago: conPago && b.metodoId ? { metodoId: b.metodoId, referencia: b.referencia } : null,
          comprobante: conPago ? comprobante : null,
          web,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { codigo?: string; estado?: string; error?: string; detalles?: string[] };
      if (!r.ok || !d.codigo) {
        setErrorServidor(d.detalles?.length ? d.detalles : [d.error ?? "No se pudo enviar. Intenta de nuevo."]);
        vibrar([20, 40, 20]);
        return;
      }
      vibrar([10, 30, 10, 30, 60]);
      escribir(claveBorrador, null);
      onListo({
        codigo: d.codigo,
        estado: d.estado ?? "PENDIENTE_PAGO",
        categoria: cat!.nombre,
        dupla: jugadores.map((j) => nombrePropio(nombreInscrito({ nombre: j.nombre ?? "", apellido: j.apellido ?? "" }))).join(" / "),
        metodo: metodo?.titulo,
      });
    } catch {
      setErrorServidor(["Sin conexión. Revisa tu internet: tus datos siguen guardados en este teléfono."]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div ref={arriba} className="scroll-mt-4">
      {/* Progreso */}
      <div className="mb-5 flex items-center gap-1.5" aria-label={`Paso ${paso + 1} de ${pasos.length}`}>
        {pasos.map((p, i) => (
          <button
            key={p}
            type="button"
            disabled={i > paso}
            onClick={() => i < paso && mover(i)}
            className="group flex flex-1 flex-col gap-1.5 text-left disabled:cursor-default"
          >
            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.span className="block h-full rounded-full bg-lima" initial={false} animate={{ width: i < paso ? "100%" : i === paso ? "50%" : "0%" }} transition={{ duration: 0.4 }} />
            </span>
            <span className={clsx("hidden text-[11px] font-semibold sm:block", i === paso ? "text-lima" : i < paso ? "text-white/70" : "text-white/35")}>{p}</span>
          </button>
        ))}
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-lima sm:hidden">
        Paso {paso + 1} de {pasos.length} · {pasos[paso]}
      </p>

      <AnimatePresence mode="wait">
        <motion.div key={paso} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {paso === 0 && <PasoCategoria categorias={data.categorias} valor={b.categoriaId} onChange={(id) => {
                setErrores({});
                setB({ ...b, categoriaId: id });
              }}
              error={errores.categoria} />}
          {(paso === 1 || paso === 2) && (
            <PasoJugador
              key={paso}
              n={paso as 1 | 2}
              torneoId={data.torneo.id}
              cat={cat!}
              j={b.jugadores[paso - 1]}
              set={(c) => setJ((paso - 1) as 0 | 1, c)}
              errores={errores}
              pideTalla={cfg.pideTalla}
              generoFijo={generoFijo}
              onFvp={setFvpBloquea}
            />
          )}
          {paso === 3 && <PasoReglamento b={b} cat={cat!} cfg={data.config!} acepta={b.acepta} setAcepta={(v) => {
                setErrores({});
                setB({ ...b, acepta: v });
              }} error={errores.acepta} irA={mover} />}
          {paso === 4 && conPago && (
            <PasoPago
              metodos={cfg.metodosPago}
              precio={cfg.precioDupla}
              metodoId={b.metodoId}
              setMetodo={(id) => setB({ ...b, metodoId: id })}
              referencia={b.referencia}
              setReferencia={(r) => setB({ ...b, referencia: r })}
              comprobante={comprobante}
              setComprobante={setComprobante}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Campo trampa para robots: invisible para las personas. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={web} onChange={(e) => setWeb(e.target.value)} name="web" />

      {errorServidor && (
        <div className="mt-5 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-coral">
            <CircleAlert className="size-4" /> No se pudo inscribir
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-white/80">
            {errorServidor.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 flex gap-3">
        {paso > 0 && (
          <button type="button" className="btn-ghost !rounded-2xl !px-4" onClick={() => mover(paso - 1)} aria-label="Atrás">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <button type="button" className="btn-neon flex-1 !rounded-2xl !py-4 text-base" onClick={siguiente} disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Enviando…
            </>
          ) : paso === pasos.length - 1 ? (
            <>
              <BadgeCheck className="size-5" /> Inscribir dupla
            </>
          ) : (
            <>
              Continuar <ArrowRight className="size-5" />
            </>
          )}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-white/40">Tus datos se guardan en este teléfono mientras llenas el formulario.</p>
    </div>
  );
}

/* ---------- paso 1: categoría ---------- */

function PasoCategoria({ categorias, valor, onChange, error }: { categorias: CupoCategoria[]; valor: string; onChange: (id: string) => void; error?: string }) {
  const grupos = useMemo(() => {
    const m = new Map<string, CupoCategoria[]>();
    for (const c of categorias) m.set(c.grupo, [...(m.get(c.grupo) ?? []), c]);
    return [...m.entries()];
  }, [categorias]);
  return (
    <div>
      <h3 className="font-display text-2xl font-bold">¿En qué categoría juegan?</h3>
      <p className="mt-1 text-sm text-white/55">La categoría de la dupla. Si alguno está en el ranking FVP, no puede jugar por debajo de su categoría.</p>
      {error && <p className="mt-3 text-sm font-medium text-coral">{error}</p>}
      <div className="mt-5 space-y-5">
        {grupos.map(([g, cs]) => (
          <div key={g}>
            <p className="label">{g}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cs.map((c) => {
                const quedan = libres(c);
                const llena = quedan === 0;
                const activo = c.id === valor;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={llena}
                    onClick={() => {
                      vibrar(6);
                      onChange(c.id);
                    }}
                    className={clsx(
                      "relative overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.98] disabled:opacity-40",
                      activo ? "seleccion" : "border-white/10 bg-white/[0.04] hover:border-white/25",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-display text-lg font-bold leading-tight">{c.nombre.replace(/ (Masculino|Femenino|Mixto)$/, "")}</span>
                      {activo && <BadgeCheck className="size-5 shrink-0 text-lima" />}
                    </span>
                    <span className={clsx("mt-2 block text-xs font-semibold", llena ? "text-coral" : quedan != null && quedan <= 3 ? "text-amber-200" : "text-white/50")}>
                      {llena ? "Cupos agotados" : quedan == null ? `${c.ocupados} dupla${c.ocupados === 1 ? "" : "s"} inscrita${c.ocupados === 1 ? "" : "s"}` : `Quedan ${quedan} de ${c.cupo}`}
                    </span>
                    {c.cupo != null && (
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-lima" style={{ width: `${Math.min(100, (c.ocupados / c.cupo) * 100)}%` }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- pasos 2 y 3: jugadores ---------- */

type Fvp = { valida: boolean; lista?: boolean; encontrado?: boolean; nombre?: string | null; categoria?: string | null; puntos?: number | null; puede?: boolean };

function useFvp(torneoId: string, cedula: string | undefined, categoriaId: string): { cargando: boolean; r: Fvp | null } {
  const [r, setR] = useState<Fvp | null>(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    const c = (cedula ?? "").replace(/\D/g, "");
    if (c.length < 6) {
      setR(null);
      return;
    }
    setCargando(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/inscripciones/${encodeURIComponent(torneoId)}?${new URLSearchParams({ cedula: cedula!, categoriaId })}`, { signal: ctl.signal })
        .then((x) => (x.ok ? x.json() : null))
        .then((d: Fvp | null) => setR(d))
        .catch(() => undefined)
        .finally(() => setCargando(false));
    }, 450);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [torneoId, cedula, categoriaId]);
  return { cargando, r };
}

function FvpBadge({ cargando, r, categoria }: { cargando: boolean; r: Fvp | null; categoria: string }) {
  if (cargando)
    return (
      <span className="flex items-center gap-1.5 text-white/50">
        <Search className="size-3.5" /> Buscando en el ranking FVP…
      </span>
    );
  if (!r?.valida || r.lista === false) return <span>Con la cédula verificamos tu categoría en el ranking FVP.</span>;
  if (!r.encontrado)
    return (
      <span className="flex items-start gap-1.5 text-white/60">
        <CircleAlert className="mt-px size-3.5 shrink-0 text-amber-200" />
        No apareces en la lista FVP. Igual puedes inscribirte: el staff revisa tu nivel.
      </span>
    );
  return r.puede ? (
    <span className="flex items-start gap-1.5 text-neon">
      <BadgeCheck className="mt-px size-3.5 shrink-0" />
      {r.nombre ? `${r.nombre[0]}${r.nombre.slice(1).toLowerCase()}, ` : ""}estás en el ranking FVP: {r.categoria}
      {r.puntos ? ` · ${r.puntos} pts` : ""}
    </span>
  ) : (
    <span className="flex items-start gap-1.5 font-semibold text-coral">
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      Eres {r.categoria} en el ranking FVP: no puedes jugar {categoria}. Vuelve al paso 1 y elige {r.categoria} o una más alta.
    </span>
  );
}

function PasoJugador({
  n,
  torneoId,
  cat,
  j,
  set,
  errores,
  pideTalla,
  generoFijo,
  onFvp,
}: {
  n: 1 | 2;
  torneoId: string;
  cat: CupoCategoria;
  j: Partial<JugadorInscripcion>;
  set: (c: Partial<JugadorInscripcion>) => void;
  errores: Record<string, string>;
  pideTalla: boolean;
  generoFijo: "M" | "F" | null;
  onFvp: (bloquea: string | null) => void;
}) {
  const fvp = useFvp(torneoId, j.cedula, cat.id);
  const bloquea = fvp.r?.valida && fvp.r.encontrado && fvp.r.puede === false ? `Eres ${fvp.r.categoria} en el ranking FVP: no puedes jugar ${cat.nombre}.` : null;
  useEffect(() => onFvp(bloquea), [bloquea, onFvp]);
  const t = (k: keyof JugadorInscripcion) => ({
    value: (j[k] as string | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [k]: e.target.value }),
  });
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-lima font-display text-xl font-bold text-marino-2">{n}</span>
        <div>
          <h3 className="font-display text-2xl font-bold leading-tight">{n === 1 ? "Tus datos" : "Tu compañero/a"}</h3>
          <p className="text-sm text-white/55">Jugador {n} · {cat.nombre}</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" error={errores.nombre}>
            {(id) => <Entrada id={id} icono={User} placeholder="Carlos" autoComplete={n === 1 ? "given-name" : "off"} invalido={!!errores.nombre} {...t("nombre")} />}
          </Campo>
          <Campo etiqueta="Apellido" error={errores.apellido}>
            {(id) => <Entrada id={id} placeholder="Mendoza" autoComplete={n === 1 ? "family-name" : "off"} invalido={!!errores.apellido} {...t("apellido")} />}
          </Campo>
        </div>
        <Campo etiqueta="Cédula de identidad" error={errores.cedula} ayuda={<FvpBadge {...fvp} categoria={cat.nombre} />}>
          {(id) => <Entrada id={id} icono={IdCard} placeholder="V-18.456.789" inputMode="text" autoCapitalize="characters" invalido={!!errores.cedula || !!errores.fvp} {...t("cedula")} />}
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Correo" error={errores.correo}>
            {(id) => <Entrada id={id} icono={Mail} type="email" inputMode="email" placeholder="ejemplo@correo.com" autoComplete={n === 1 ? "email" : "off"} invalido={!!errores.correo} {...t("correo")} />}
          </Campo>
          <Campo etiqueta="Teléfono / WhatsApp" error={errores.telefono}>
            {(id) => <Entrada id={id} icono={Phone} type="tel" inputMode="tel" placeholder="0414 123 4567" autoComplete={n === 1 ? "tel" : "off"} invalido={!!errores.telefono} {...t("telefono")} />}
          </Campo>
        </div>
        {!generoFijo && (
          <Campo etiqueta="Juega en rama" error={errores.genero}>
            {() => <Opciones opciones={[{ id: "M", label: "Masculina" }, { id: "F", label: "Femenina" }]} valor={j.genero} onChange={(v) => set({ genero: v })} invalido={!!errores.genero} />}
          </Campo>
        )}
        {cat.pideEdad && (
          <Campo etiqueta="Fecha de nacimiento" error={errores.fechaNacimiento} ayuda="La categoría es por edad: se cuenta la que cumples este año.">
            {(id) => <Entrada id={id} type="date" invalido={!!errores.fechaNacimiento} {...t("fechaNacimiento")} />}
          </Campo>
        )}
        <Campo etiqueta="Lado de juego" error={errores.lado}>
          {() => <Opciones opciones={LADOS} valor={j.lado} onChange={(v) => set({ lado: v })} invalido={!!errores.lado} />}
        </Campo>
        {pideTalla && (
          <Campo etiqueta="Talla de franela" error={errores.talla}>
            {() => <Opciones opciones={TALLAS.map((x) => ({ id: x, label: x }))} valor={j.talla} onChange={(v) => set({ talla: v })} invalido={!!errores.talla} />}
          </Campo>
        )}
        <Campo etiqueta="¿Alguna alergia o restricción alimenticia?" error={errores.alergias}>
          {(id) => <Entrada id={id} icono={HeartPulse} placeholder="Ninguna / Alérgico al maní…" invalido={!!errores.alergias} {...t("alergias")} />}
        </Campo>

        <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 open:pb-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Medal className="size-4 text-lima" /> Tu nivel y torneos
            </span>
            <span className="text-xs font-medium text-white/45 group-open:hidden">Opcional · ayuda a sembrar el cuadro</span>
          </summary>
          <div className="mt-4 space-y-4">
            <Campo etiqueta="Categoría en la que juegas habitualmente" opcional>
              {(id) => <Entrada id={id} placeholder="4ta / 5ta FVP" {...t("categoriaHabitual")} />}
            </Campo>
            <Campo etiqueta="Liga o torneo donde participas" opcional>
              {(id) => <Entrada id={id} placeholder="Liga Máster / Superliga de Clubes" {...t("liga")} />}
            </Campo>
            <Campo etiqueta="Últimos torneos y resultados" opcional>
              {(id) => <textarea id={id} rows={3} placeholder="Copa Aniversario 2026 · semifinal" className="input !rounded-2xl text-[15px]" {...t("historial")} />}
            </Campo>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ---------- paso 4: revisión y reglamento ---------- */

function PasoReglamento({
  b,
  cat,
  cfg,
  acepta,
  setAcepta,
  error,
  irA,
}: {
  b: Borrador;
  cat: CupoCategoria;
  cfg: NonNullable<ApiInscripcionPublica["config"]>;
  acepta: boolean;
  setAcepta: (v: boolean) => void;
  error?: string;
  irA: (paso: number) => void;
}) {
  const lineas = (cfg.reglamento ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  return (
    <div>
      <h3 className="font-display text-2xl font-bold">Revisen y confirmen</h3>
      <p className="mt-1 text-sm text-white/55">Toca un bloque para corregirlo.</p>

      <button type="button" onClick={() => irA(0)} className="glass mt-5 flex w-full items-center gap-3 rounded-2xl p-4 text-left">
        <Trophy className="size-5 text-lima" />
        <span className="flex-1">
          <span className="block text-xs text-white/50">Categoría</span>
          <span className="font-semibold">{cat.nombre}</span>
        </span>
      </button>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {b.jugadores.map((j, i) => (
          <button key={i} type="button" onClick={() => irA(i + 1)} className="glass flex items-center gap-3 rounded-2xl p-4 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display font-bold">{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{nombrePropio(nombreInscrito({ nombre: j.nombre ?? "", apellido: j.apellido ?? "" }))}</span>
              <span className="block truncate text-xs text-white/50">
                {[j.cedula, LADOS.find((l) => l.id === j.lado)?.label, j.talla && `Talla ${j.talla}`].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-lima">
          <ShieldCheck className="size-4" /> Reglamento del torneo
        </p>
        {lineas.length > 0 ? (
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 text-sm text-white/75">
            {lineas.map((l, k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lima" />
                {l}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/60">Se juega con el reglamento FIP y las normas de La Marina Sport Club.</p>
        )}
        {cfg.reglamentoUrl && (
          <a href={cfg.reglamentoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-lima underline-offset-4 hover:underline">
            <FileText className="size-4" /> Ver reglamento completo
          </a>
        )}
        <button
          type="button"
          role="checkbox"
          aria-checked={acepta}
          onClick={() => {
            vibrar(8);
            setAcepta(!acepta);
          }}
          className={clsx("mt-5 flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition", acepta ? "border-lima/60 bg-lima/10" : error ? "border-coral/60" : "border-white/15")}
        >
          <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition", acepta ? "border-lima bg-lima text-marino-2" : "border-white/30")}>
            {acepta && <BadgeCheck className="size-4" />}
          </span>
          <span className="text-sm font-semibold">
            <Users className="mr-1.5 inline size-4 text-white/50" />
            Los dos leímos y aceptamos el reglamento
          </span>
        </button>
        {error && <p className="mt-2 text-xs font-medium text-coral">{error}</p>}
      </div>
    </div>
  );
}

/* ---------- paso 5: pago ---------- */

function PasoPago({
  metodos,
  precio,
  metodoId,
  setMetodo,
  referencia,
  setReferencia,
  comprobante,
  setComprobante,
}: {
  metodos: MetodoPago[];
  precio: number;
  metodoId: string;
  setMetodo: (id: string) => void;
  referencia: string;
  setReferencia: (r: string) => void;
  comprobante: string | null;
  setComprobante: (c: string | null) => void;
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const m = metodos.find((x) => x.id === metodoId);
  const tipo = TIPOS_PAGO.find((x) => x.id === m?.tipo);
  return (
    <div>
      <h3 className="font-display text-2xl font-bold">Pago de la inscripción</h3>
      <div className="mt-4 flex items-end justify-between rounded-3xl bg-gradient-to-br from-marca-2/40 to-marino-2 p-5 ring-1 ring-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Total por dupla</p>
          <p className="font-display text-4xl font-bold tabular">${precio}</p>
        </div>
        <p className="text-right text-sm text-white/60">${precio / 2} por jugador</p>
      </div>

      <p className="label mt-6">¿Cómo van a pagar?</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metodos.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              vibrar(6);
              setMetodo(x.id);
            }}
            className={clsx("flex items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.98]", x.id === metodoId ? "seleccion" : "border-white/10 bg-white/[0.04] hover:border-white/25")}
          >
            <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-xl", x.id === metodoId ? "bg-lima text-marino-2" : "bg-white/10")}>
              <Banknote className="size-5" />
            </span>
            <span className="font-semibold">{x.titulo}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {m && (
          <motion.div key={m.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 space-y-2">
              {m.datos.map((d) => (
                <DatoCopiable key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
              ))}
              {m.nota && <p className="px-1 pt-1 text-sm text-white/60">{m.nota}</p>}
            </div>
            {(tipo?.pideReferencia ?? m.pideReferencia) && (
              <div className="mt-5 space-y-4">
                <Campo etiqueta="Número de referencia" opcional ayuda="Si ya pagaste, escríbelo para que el staff lo verifique más rápido.">
                  {(id) => <Entrada id={id} placeholder="Ej. 004512" inputMode="numeric" value={referencia} onChange={(e) => setReferencia(e.target.value)} />}
                </Campo>
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-white/80">Foto del comprobante <span className="text-[11px] font-medium text-white/40">· Opcional</span></p>
                  {comprobante ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-lima/40 bg-lima/10 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={comprobante} alt="Comprobante" className="size-16 rounded-xl object-cover" />
                      <span className="flex-1 text-sm font-semibold">Comprobante listo</span>
                      <button type="button" className="btn-ghost !p-2.5" onClick={() => setComprobante(null)} aria-label="Quitar comprobante">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => archivo.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 p-5 text-sm font-semibold text-white/70 transition hover:border-lima/50 hover:text-white">
                      {subiendo ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                      Subir captura del pago
                    </button>
                  )}
                  <input
                    ref={archivo}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setSubiendo(true);
                      try {
                        setComprobante(await comprimirFoto(f, 1200));
                      } finally {
                        setSubiendo(false);
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-5 text-xs text-white/45">¿Pagas después? Puedes inscribirte igual: el cupo queda reservado y el staff lo confirma cuando reciba el pago.</p>
    </div>
  );
}
