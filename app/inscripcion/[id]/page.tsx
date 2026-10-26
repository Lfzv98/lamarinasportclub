"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Droplets,
  Gift,
  Loader2,
  MapPin,
  Search,
  Shirt,
  Sparkles,
  Trophy,
  Wallet,
  XCircle,
} from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import { Formulario, type Resultado } from "@/components/inscripcion/Formulario";
import { IconoInstagram, IconoWhatsapp } from "@/components/inscripcion/piezas";
import { Logo } from "@/components/Logo";
import { Confetti } from "@/components/ui/Confetti";
import { Hoja } from "@/components/ui/Hoja";
import { vibrar } from "@/lib/feedback";
import { enlaceWhatsapp, ESTADOS_INSCRIPCION, libres } from "@/lib/inscripcion";
import type { ApiInscripcionPublica, EstadoInscripcion } from "@/types/inscripcion";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" });

function rango(dias: { fecha: string }[]) {
  if (!dias.length) return "Por anunciar";
  const a = dias[0].fecha;
  const b = dias[dias.length - 1].fecha;
  if (a === b) return fechaLarga(a);
  const [da, db] = [new Date(`${a}T12:00:00`), new Date(`${b}T12:00:00`)];
  return da.getMonth() === db.getMonth() ? `Del ${da.getDate()} al ${db.getDate()} de ${da.toLocaleDateString("es", { month: "long" })}` : `${fechaLarga(a)} – ${fechaLarga(b)}`;
}

/** Ícono para cada cosa que incluye la inscripción, según las palabras. */
function iconoIncluye(texto: string) {
  const t = texto.toLowerCase();
  if (/franela|camis|remera/.test(t)) return Shirt;
  if (/hidrat|agua|bebida/.test(t)) return Droplets;
  if (/premio|trofeo|metálico/.test(t)) return Trophy;
  if (/árbit|arbit|fvp|ranking|punto/.test(t)) return Award;
  if (/pelota/.test(t)) return Sparkles;
  if (/regalo|kit|bolsa/.test(t)) return Gift;
  return CheckCircle2;
}

type Mia = Resultado & { en: string };

export default function InscripcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ApiInscripcionPublica | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<Resultado | null>(null);
  const [consultar, setConsultar] = useState(false);
  const [mias, setMias] = useState<Mia[]>([]);
  const claveMias = `lm-insc-mias:${id}`;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/inscripciones/${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo cargar el torneo.");
      setData(d);
    } catch (e) {
      setError((e as Error).message === "Failed to fetch" ? "Sin conexión. Revisa tu internet." : (e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
    try {
      setMias(JSON.parse(localStorage.getItem(claveMias) ?? "[]"));
    } catch {
      /* nada */
    }
  }, [cargar, claveMias]);

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo compacto className="size-14" />
        <p className="font-display text-2xl font-bold">{error}</p>
        <button className="btn-neon" onClick={() => location.reload()}>
          Reintentar
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );

  const cfg = data.config;
  const t = data.torneo;
  const totalCupos = data.categorias.reduce((s, c) => s + (c.cupo ?? 0), 0);
  const totalLibres = data.categorias.reduce((s, c) => s + (libres(c) ?? 0), 0);
  const conCupo = data.categorias.every((c) => c.cupo != null) && totalCupos > 0;
  const wa = cfg?.whatsapp?.replace(/\D/g, "") ? cfg.whatsapp : null;
  const textoAyuda = `Hola, tengo una pregunta sobre la inscripción de ${t.nombre}.`;

  const alInscribir = (r: Resultado) => {
    const nueva = [{ ...r, en: new Date().toISOString() }, ...mias].slice(0, 10);
    setMias(nueva);
    try {
      localStorage.setItem(claveMias, JSON.stringify(nueva));
    } catch {
      /* nada */
    }
    setListo(r);
    cargar();
    requestAnimationFrame(() => document.getElementById("inscribirme")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <main className="pb-28">
      {/* Portada */}
      <section className="sobre-marca relative overflow-hidden bg-marca pb-24 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-28 -top-32 size-96 rounded-full bg-marca-2/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-1/2 size-72 rounded-full bg-lima/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
        <header className="relative mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/torneos" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60 hover:text-white">
            PadelReserve
          </Link>
          {mias.length > 0 || data.abierta ? (
            <button className="btn-ghost !rounded-full !px-4 !py-2 text-xs" onClick={() => setConsultar(true)}>
              <Search className="size-3.5" /> Mi inscripción
            </button>
          ) : null}
        </header>
        <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 180, damping: 20 }}>
            <Logo className="mx-auto !h-auto w-full max-w-[17rem] sm:max-w-sm" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-6 max-w-3xl font-display text-[2.6rem] font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl"
          >
            {t.nombre.replace(/(\d{4})$/, "")}
            {/\d{4}$/.test(t.nombre) && <span className="text-lima">{t.nombre.match(/\d{4}$/)![0]}</span>}
          </motion.h1>
          {cfg?.destacado && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-lima/40 bg-marino-2/50 px-4 py-2 text-sm font-semibold backdrop-blur">
              <Award className="size-4 text-lima" /> {cfg.destacado}
            </motion.p>
          )}
          {data.abierta && (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lima">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-lima opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-lima" />
              </span>
              {conCupo ? `Quedan ${totalLibres} cupos` : "Inscripciones abiertas"}
            </p>
          )}
        </div>
      </section>

      {/* Datos clave */}
      <div className="relative mx-auto -mt-16 max-w-5xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass grid grid-cols-3 divide-x divide-white/10 rounded-[1.75rem] py-5">
          <Dato icono={CalendarDays} titulo="Fecha" valor={rango(t.dias)} sub={t.dias[0] ? (t.dias.length > 1 ? `${t.dias.length} días · ${t.dias[0].fecha.slice(0, 4)}` : t.dias[0].fecha.slice(0, 4)) : undefined} />
          <Dato icono={MapPin} titulo="Sede" valor={t.sede} />
          <Dato icono={Wallet} titulo="Inversión" valor={cfg?.precioDupla ? `$${cfg.precioDupla}` : "Gratis"} sub={cfg?.precioDupla ? `por dupla · $${cfg.precioDupla / 2} c/u` : undefined} />
        </motion.div>

        {data.abierta ? (
          <a
            href="#inscribirme"
            onClick={() => vibrar(8)}
            className="btn-neon mt-5 flex w-full !rounded-[1.4rem] !py-5 text-lg uppercase tracking-wide shadow-[0_20px_50px_-15px_rgba(166,232,74,0.7)]"
          >
            Inscribir mi dupla <ArrowDown className="size-5" />
          </a>
        ) : (
          <div className="glass mt-5 rounded-[1.4rem] p-5 text-center">
            <p className="font-display text-lg font-bold">Inscripciones cerradas</p>
            <p className="mt-1 text-sm text-white/60">{data.motivoCerrada}</p>
          </div>
        )}
        {cfg?.reglamentoUrl && (
          <a href={cfg.reglamentoUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-3 flex w-full !rounded-[1.4rem]">
            Ver reglamento oficial
          </a>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {cfg?.descripcion && <p className="mx-auto mt-10 max-w-2xl text-center text-[17px] leading-relaxed text-white/70">{cfg.descripcion}</p>}

        {/* Qué incluye */}
        {cfg && (cfg.incluye.length > 0 || cfg.premios) && (
          <section className="mt-12">
            <p className="label text-center !text-lima">Tu inscripción incluye</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cfg.premios && (
                <div className="seleccion col-span-2 flex items-center gap-4 rounded-3xl border p-5 sm:col-span-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lima text-marino-2">
                    <Trophy className="size-6" />
                  </span>
                  <p className="font-display text-lg font-bold leading-tight">{cfg.premios}</p>
                </div>
              )}
              {cfg.incluye.map((x, i) => {
                const I = iconoIncluye(x);
                return (
                  <motion.div key={x} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="glass rounded-3xl p-4">
                    <I className="size-6 text-lima" />
                    <p className="mt-3 text-sm font-semibold leading-snug">{x}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Formulario */}
        <section id="inscribirme" className="mt-14 scroll-mt-4">
          <div className="text-center">
            <p className="label !text-lima">Formulario oficial</p>
            <h2 className="font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
              Inscríbete <span className="text-lima">aquí</span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/55">En 3 minutos. Los datos de los dos jugadores, el reglamento y el pago.</p>
          </div>
          <div className="glass mx-auto mt-6 max-w-2xl rounded-[2rem] p-5 sm:p-8">
            <AnimatePresence mode="wait">
              {listo ? (
                <Exito key="ok" r={listo} torneo={t.nombre} whatsapp={wa} conPago={!!cfg?.precioDupla} onOtra={() => setListo(null)} />
              ) : data.abierta && cfg ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Formulario data={data} onListo={alInscribir} />
                </motion.div>
              ) : (
                <div className="py-8 text-center">
                  <Clock3 className="mx-auto size-10 text-white/40" />
                  <p className="mt-3 font-display text-xl font-bold">Inscripciones cerradas</p>
                  <p className="mt-1 text-sm text-white/55">{data.motivoCerrada}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Patrocinadores */}
        {t.patrocinadores.length > 0 && (
          <section className="mt-16 text-center">
            <p className="label !text-lima">Alianzas oficiales</p>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
              Patrocinadores <span className="text-lima">&</span> aliados
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...t.patrocinadores]
                .sort((a, b) => Number(!!b.principal) - Number(!!a.principal))
                .map((p) => (
                  <div key={p.id} className={clsx("glass flex h-24 items-center justify-center rounded-3xl p-4", p.principal && "col-span-2 h-28")}>
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo} alt={p.nombre} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="font-display text-lg font-bold">{p.nombre}</span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        <footer className="mt-16 flex flex-col items-center gap-4 text-center">
          <Logo compacto className="size-12" />
          {cfg?.instagram && (
            <a href={`https://instagram.com/${cfg.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="btn-ghost !rounded-full">
              <IconoInstagram className="size-4" /> @{cfg.instagram.replace(/^@/, "")}
            </a>
          )}
          <p className="text-xs text-white/40">
            {t.nombre} · La Marina Sport Club
            <br />
            Inscripciones con PadelReserve
          </p>
        </footer>
      </div>

      {/* Ayuda por WhatsApp */}
      {wa && (
        <a
          href={enlaceWhatsapp(wa, textoAyuda)}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] py-2.5 pl-3 pr-4 text-sm font-bold text-[#073b1c] shadow-[0_12px_30px_-8px_rgba(37,211,102,0.7)] transition active:scale-95"
          aria-label="Ayuda por WhatsApp"
        >
          <IconoWhatsapp className="size-6" />
          <span className="hidden min-[380px]:inline">¿Dudas?</span>
        </a>
      )}

      <Consultar abierta={consultar} onClose={() => setConsultar(false)} torneoId={id} mias={mias} />
    </main>
  );
}

function Dato({ icono: I, titulo, valor, sub }: { icono: React.ComponentType<{ className?: string }>; titulo: string; valor: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-2 text-center">
      <I className="size-5 text-lima" />
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{titulo}</p>
      <p className="mt-1 font-display text-[15px] font-bold leading-tight sm:text-lg">{valor}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/50 sm:text-xs">{sub}</p>}
    </div>
  );
}

function Exito({ r, torneo, whatsapp, conPago, onOtra }: { r: Resultado; torneo: string; whatsapp: string | null; conPago: boolean; onOtra: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const porVerificar = r.estado === "PAGO_REPORTADO";
  const mensaje = `Hola, inscribí mi dupla en ${torneo}.\nCódigo: ${r.codigo}\nCategoría: ${r.categoria}\nDupla: ${r.dupla}${conPago ? `\nPago: ${r.metodo ?? "por definir"}` : ""}`;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
      <Confetti activo />
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }} className="mx-auto flex size-20 items-center justify-center rounded-full bg-lima text-marino-2 shadow-[0_0_0_10px_rgba(207,243,91,0.15)]">
        <BadgeCheck className="size-11" />
      </motion.span>
      <h3 className="mt-5 font-display text-3xl font-bold">¡Dupla inscrita!</h3>
      <p className="mt-1 text-white/60">
        {r.dupla} · {r.categoria}
      </p>

      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(r.codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1600);
          } catch {
            /* nada */
          }
        }}
        className="mx-auto mt-6 block rounded-3xl border border-dashed border-lima/50 bg-lima/5 px-8 py-4"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Tu código</span>
        <span className="mt-1 block font-display text-4xl font-bold tracking-[0.12em] text-lima">{r.codigo}</span>
        <span className="mt-1 flex items-center justify-center gap-1 text-xs text-white/50">
          <Copy className="size-3" /> {copiado ? "Copiado" : "Toca para copiar · guárdalo"}
        </span>
      </button>

      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        <Paso hecho texto="Datos de la dupla recibidos" />
        {conPago && <Paso hecho={porVerificar} texto={porVerificar ? "Pago reportado: el staff lo está verificando" : "Falta el pago: envía el comprobante para reservar tu cupo"} />}
        <Paso texto="El staff confirma y tu dupla aparece en el cuadro" />
      </div>

      {whatsapp && (
        <a href={enlaceWhatsapp(whatsapp, mensaje)} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 font-bold text-[#073b1c] transition active:scale-[0.98]">
          <IconoWhatsapp className="size-5" /> {conPago && !porVerificar ? "Enviar comprobante por WhatsApp" : "Avisar por WhatsApp"}
        </a>
      )}
      <button className="btn-ghost mt-3 w-full !rounded-2xl" onClick={onOtra}>
        Inscribir otra dupla
      </button>
    </motion.div>
  );
}

function Paso({ hecho, texto }: { hecho?: boolean; texto: string }) {
  return (
    <p className="flex items-start gap-2.5">
      {hecho ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neon" /> : <Clock3 className="mt-0.5 size-4 shrink-0 text-white/40" />}
      <span className={hecho ? "text-white/85" : "text-white/55"}>{texto}</span>
    </p>
  );
}

const ICONO_ESTADO: Record<EstadoInscripcion, React.ComponentType<{ className?: string }>> = {
  PENDIENTE_PAGO: Wallet,
  PAGO_REPORTADO: Clock3,
  CONFIRMADA: BadgeCheck,
  RECHAZADA: XCircle,
};

function Consultar({ abierta, onClose, torneoId, mias }: { abierta: boolean; onClose: () => void; torneoId: string; mias: Mia[] }) {
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [r, setR] = useState<{ codigo: string; estado: EstadoInscripcion; categoria: string; dupla: string; nota?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buscar = async (c: string) => {
    setCargando(true);
    setError(null);
    setR(null);
    try {
      const x = await fetch(`/api/inscripciones/${encodeURIComponent(torneoId)}?codigo=${encodeURIComponent(c.trim())}`, { cache: "no-store" });
      const d = await x.json();
      if (!x.ok) setError(d.error ?? "No encontrado.");
      else setR(d);
    } catch {
      setError("Sin conexión.");
    } finally {
      setCargando(false);
    }
  };
  const I = r ? ICONO_ESTADO[r.estado] : null;
  return (
    <Hoja abierta={abierta} onClose={onClose} titulo="Mi inscripción" sub="Consulta cómo va con el código que recibiste.">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.trim()) buscar(codigo);
        }}
      >
        <input className="input text-center font-display text-lg font-bold uppercase tracking-[0.15em]" placeholder="LM-XXXX" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={10} />
        <button className="btn-neon !px-4" disabled={!codigo.trim() || cargando} aria-label="Buscar">
          {cargando ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
        </button>
      </form>
      {mias.length > 0 && !r && (
        <div className="mt-4">
          <p className="label">Inscritas desde este teléfono</p>
          <div className="space-y-2">
            {mias.map((m) => (
              <button
                key={m.codigo}
                className="glass flex w-full items-center justify-between rounded-2xl p-3 text-left"
                onClick={() => {
                  setCodigo(m.codigo);
                  buscar(m.codigo);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.dupla}</span>
                  <span className="block text-xs text-white/50">{m.categoria}</span>
                </span>
                <span className="font-display font-bold text-lima">{m.codigo}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-coral">{error}</p>}
      {r && I && (
        <div className="mt-4 rounded-2xl border border-white/10 p-4">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <I className={clsx("size-5", r.estado === "CONFIRMADA" ? "text-neon" : r.estado === "RECHAZADA" ? "text-coral" : "text-amber-200")} />
            {ESTADOS_INSCRIPCION[r.estado].label}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {r.dupla} · {r.categoria}
          </p>
          {r.nota && <p className="mt-2 text-sm text-coral">Motivo: {r.nota}</p>}
          {r.estado === "CONFIRMADA" && <p className="mt-2 text-sm text-white/60">¡Listo! Ya están en el torneo. El cuadro y los horarios salen en la app cuando el staff haga el sorteo.</p>}
        </div>
      )}
    </Hoja>
  );
}
