"use client";

import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Clock3,
  Download,
  ExternalLink,
  HeartPulse,
  Image as ImageIcon,
  Inbox,
  Mail,

  Search,
  Settings2,
  Shirt,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { IconoWhatsapp } from "@/components/inscripcion/piezas";
import { QR } from "@/components/QR";
import { StaffGate } from "@/components/StaffGate";
import { TorneoShell } from "@/components/torneo/TorneoShell";
import { CompartirButton } from "@/components/CompartirButton";
import { Hoja } from "@/components/ui/Hoja";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { aperturaInscripcion, csvInscripciones, enlaceWhatsapp, ESTADOS_INSCRIPCION, LADOS, nombreInscrito, resumenInscripciones } from "@/lib/inscripcion";
import { etiquetaNivel } from "@/lib/ranking/fvp";
import { nombreCategoria, nombreCorto } from "@/lib/torneo/categorias";
import { useTorneos } from "@/lib/torneosStore";
import type { ApiInscripcionPublica, EstadoInscripcion, Inscripcion } from "@/types/inscripcion";
import type { Torneo } from "@/types/torneo";

/** Inscripciones online (staff): verificar pagos, pasar duplas al torneo, tallas y alergias. */
export default function InscripcionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <StaffGate>
      <TorneoShell id={id} ancho="max-w-4xl">
        {(t) => <Panel torneo={t} />}
      </TorneoShell>
    </StaffGate>
  );
}

const COLOR: Record<EstadoInscripcion, string> = {
  PENDIENTE_PAGO: "border-white/15 text-white/70",
  PAGO_REPORTADO: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  CONFIRMADA: "border-neon/40 bg-neon/10 text-neon",
  RECHAZADA: "border-coral/40 bg-coral/10 text-coral",
};

const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
};

type Filtro = "TODAS" | EstadoInscripcion;

function Panel({ torneo }: { torneo: Torneo }) {
  const [lista, setLista] = useState<Inscripcion[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<Inscripcion | null>(null);
  const [verQr, setVerQr] = useState(false);
  const [verResumen, setVerResumen] = useState(false);
  const ap = aperturaInscripcion(torneo);
  const ruta = `/inscripcion/${torneo.id}`;
  const [url, setUrl] = useState(ruta);
  useEffect(() => setUrl(`${location.origin}${ruta}`), [ruta]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/inscripciones/${encodeURIComponent(torneo.id)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as ApiInscripcionPublica;
      setLista(d.inscripciones ?? []);
    } catch {
      /* sin red: se reintenta */
    }
  }, [torneo.id]);
  useEffect(() => {
    cargar();
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 15_000);
    return () => clearInterval(t);
  }, [cargar]);

  const nombreCat = (cid: string) => {
    const c = torneo.categorias.find((x) => x.categoria.id === cid)?.categoria;
    return c ? nombreCategoria(c) : cid;
  };
  const resumen = useMemo(() => resumenInscripciones(lista ?? [], torneo.inscripcion), [lista, torneo.inscripcion]);
  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (lista ?? []).filter(
      (i) =>
        (filtro === "TODAS" ? i.estado !== "RECHAZADA" : i.estado === filtro) &&
        (!s || i.codigo.toLowerCase().includes(s) || i.jugadores.some((j) => `${j.nombre} ${j.apellido} ${j.cedula}`.toLowerCase().includes(s))),
    );
  }, [lista, filtro, q]);

  const accion = async (i: Inscripcion, accion: string, nota?: string) => {
    const r = await fetch(`/api/inscripciones/${encodeURIComponent(torneo.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: i.id, accion, nota }),
    });
    const d = (await r.json().catch(() => ({}))) as { inscripcion?: Inscripcion; error?: string };
    if (!r.ok || !d.inscripcion) {
      toast(d.error ?? "No se pudo guardar", "error");
      return false;
    }
    setLista((l) => (l ?? []).map((x) => (x.id === i.id ? d.inscripcion! : x)));
    setAbierta(null);
    vibrar(20);
    if (accion === "confirmar") {
      toast(`${i.jugadores.map((j) => j.apellido).join(" / ")} ya está en ${nombreCorto(torneo.categorias.find((c) => c.categoria.id === i.categoriaId)!.categoria)}`);
      useTorneos.getState().sincronizar();
    } else toast(`Inscripción ${ESTADOS_INSCRIPCION[d.inscripcion.estado].label.toLowerCase()}`, "info");
    return true;
  };

  const descargar = () => {
    const blob = new Blob([csvInscripciones(torneo, lista ?? [])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inscripciones-${torneo.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filtros: { id: Filtro; label: string; n: number }[] = [
    { id: "TODAS", label: "Activas", n: resumen.total },
    { id: "PAGO_REPORTADO", label: "Por verificar", n: resumen.porVerificar },
    { id: "PENDIENTE_PAGO", label: "Sin pago", n: resumen.pendientes },
    { id: "CONFIRMADA", label: "Confirmadas", n: resumen.confirmadas },
    { id: "RECHAZADA", label: "Rechazadas", n: resumen.rechazadas },
  ];

  return (
    <div className="pb-10">
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Inscripciones online</h2>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <span className={clsx("size-2 rounded-full", ap.abierta ? "bg-neon" : "bg-white/30")} />
            <span className="text-white/60">{ap.abierta ? `Abiertas${torneo.inscripcion?.cierre ? ` hasta el ${new Date(`${torneo.inscripcion.cierre}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" })}` : ""}` : ap.motivo}</span>
          </p>
        </div>
        <Link href={`/torneos/${torneo.id}/ajustes#inscripcion`} className="btn-ghost !px-3 !py-2 text-xs">
          <Settings2 className="size-3.5" /> Configurar
        </Link>
      </div>

      {/* Enlace para compartir */}
      <div className="seleccion mt-4 rounded-3xl border p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setVerQr(true)} className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blanco p-1.5" aria-label="Ver QR">
            <QR texto={url} size="100%" logo={false} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lima">Enlace de inscripción</p>
            <p className="truncate text-sm text-white/80">{url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={ruta} target="_blank" rel="noreferrer" className="btn-ghost !py-2 text-xs">
            <ExternalLink className="size-3.5" /> Abrir página
          </a>
          <CompartirButton titulo={`Inscripciones · ${torneo.nombre}`} ruta={ruta} className="btn-ghost !py-2 text-xs" />
        </div>
      </div>

      {/* Números */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero titulo="Por verificar" valor={resumen.porVerificar} icono={Clock3} tono="text-amber-200" onClick={() => setFiltro("PAGO_REPORTADO")} />
        <Numero titulo="Sin pago" valor={resumen.pendientes} icono={Wallet} onClick={() => setFiltro("PENDIENTE_PAGO")} />
        <Numero titulo="Confirmadas" valor={resumen.confirmadas} icono={BadgeCheck} tono="text-neon" onClick={() => setFiltro("CONFIRMADA")} />
        <Numero titulo="Cobrado" valor={`$${resumen.cobrado}`} sub={resumen.porCobrar ? `$${resumen.porCobrar} por cobrar` : undefined} icono={Wallet} tono="text-lima" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setVerResumen(true)}>
          <Shirt className="size-3.5" /> Tallas y alergias
        </button>
        <button className="btn-ghost !px-3 !py-2 text-xs" onClick={descargar} disabled={!lista?.length}>
          <Download className="size-3.5" /> Excel (CSV)
        </button>
      </div>

      {/* Filtros */}
      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={clsx("chip shrink-0 !py-1.5 text-sm", filtro === f.id && "!border-neon/50 !bg-neon/15 !text-neon")}
          >
            {f.label} <span className="font-display font-bold">{f.n}</span>
          </button>
        ))}
      </div>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
        <input className="input !pl-11" placeholder="Buscar por nombre, cédula o código" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {lista === null ? (
          [0, 1, 2].map((k) => <div key={k} className="glass h-24 animate-pulse rounded-3xl" />)
        ) : visibles.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl p-10 text-center text-white/55">
            <Inbox className="size-8 text-white/30" />
            {lista.length ? "Nada con ese filtro." : "Todavía no llegan inscripciones. Comparte el enlace por WhatsApp e Instagram."}
          </div>
        ) : (
          visibles.map((i, k) => (
            <motion.button
              key={i.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(k, 8) * 0.03 }}
              onClick={() => setAbierta(i)}
              className="glass block w-full rounded-3xl p-4 text-left transition hover:border-neon/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[17px] font-bold">{i.jugadores.map(nombreInscrito).join(" / ")}</p>
                  <p className="mt-0.5 text-sm text-white/55">
                    {nombreCat(i.categoriaId)} · <span className="font-mono text-xs">{i.codigo}</span>
                  </p>
                </div>
                <span className={clsx("chip shrink-0", COLOR[i.estado])}>{ESTADOS_INSCRIPCION[i.estado].corto}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
                <span>{hace(i.creadaEn)}</span>
                {i.pago && (
                  <span className="flex items-center gap-1">
                    <Wallet className="size-3.5" />
                    {torneo.inscripcion?.metodosPago.find((m) => m.id === i.pago!.metodoId)?.titulo ?? "Pago"}
                    {i.pago.referencia && ` · Ref. ${i.pago.referencia}`}
                  </span>
                )}
                {i.pago?.comprobante && (
                  <span className="flex items-center gap-1 text-lima">
                    <ImageIcon className="size-3.5" /> Comprobante
                  </span>
                )}
                <FvpChips i={i} />
              </div>
            </motion.button>
          ))
        )}
      </div>

      <Detalle i={abierta} torneo={torneo} nombreCat={nombreCat} onClose={() => setAbierta(null)} accion={accion} />

      <Hoja abierta={verQr} onClose={() => setVerQr(false)} titulo="QR de inscripción" sub="Imprímelo en la recepción o compártelo en historias.">
        <div className="mx-auto w-64 rounded-3xl bg-blanco p-4">
          <QR texto={url} size="100%" />
        </div>
        <p className="mt-3 text-center text-sm text-white/60">{torneo.nombre}</p>
      </Hoja>

      <Hoja abierta={verResumen} onClose={() => setVerResumen(false)} titulo="Tallas y alergias" sub="De todas las inscripciones activas (sin las rechazadas).">
        <p className="label">Franelas</p>
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(resumen.tallas).map(([t, n]) => (
            <div key={t} className="glass rounded-2xl py-3 text-center">
              <p className="text-xs text-white/50">{t}</p>
              <p className="font-display text-xl font-bold">{n}</p>
            </div>
          ))}
        </div>
        <p className="label mt-6">Alergias y restricciones ({resumen.alergias.length})</p>
        {resumen.alergias.length ? (
          <ul className="space-y-2">
            {resumen.alergias.map((a, k) => (
              <li key={k} className="flex items-start gap-2 text-sm">
                <HeartPulse className="mt-0.5 size-4 shrink-0 text-coral" />
                <span>
                  <b>{a.nombre}</b>: {a.alergias}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/55">Nadie reportó alergias.</p>
        )}
      </Hoja>
    </div>
  );
}

function Numero({ titulo, valor, sub, icono: I, tono, onClick }: { titulo: string; valor: number | string; sub?: string; icono: React.ComponentType<{ className?: string }>; tono?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="glass rounded-3xl p-4 text-left transition enabled:hover:border-neon/30 disabled:cursor-default">
      <I className={clsx("size-5", tono ?? "text-white/50")} />
      <p className="mt-2 font-display text-3xl font-bold tabular">{valor}</p>
      <p className="text-xs text-white/55">{titulo}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>}
    </button>
  );
}

function FvpChips({ i }: { i: Inscripcion }) {
  const c = i.fvp?.categorias;
  // Sin lista FVP cargada al inscribirse no hay nada que mostrar.
  if (!c || !i.fvp?.lista) return null;
  const fuera = c.filter((x) => !x).length;
  return (
    <span className={clsx("flex items-center gap-1", fuera ? "text-amber-200" : "text-neon")}>
      FVP: {c.map((x) => (x ? etiquetaNivel(x) : "—")).join(" / ")}
      {fuera > 0 && ` · ${fuera === 2 ? "ninguno aparece" : "uno no aparece"}`}
    </span>
  );
}

function Detalle({
  i,
  torneo,
  nombreCat,
  onClose,
  accion,
}: {
  i: Inscripcion | null;
  torneo: Torneo;
  nombreCat: (id: string) => string;
  onClose: () => void;
  accion: (i: Inscripcion, a: string, nota?: string) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    setMotivo("");
    setRechazando(false);
  }, [i?.id]);
  if (!i) return <Hoja abierta={false} onClose={onClose} titulo="">{null}</Hoja>;
  const metodo = torneo.inscripcion?.metodosPago.find((m) => m.id === i.pago?.metodoId);
  const ct = torneo.categorias.find((c) => c.categoria.id === i.categoriaId);
  const sorteada = !!ct?.cuadro;
  const hacer = async (a: string, nota?: string) => {
    setOcupado(true);
    await accion(i, a, nota);
    setOcupado(false);
  };
  const precio = torneo.inscripcion?.precioDupla ?? 0;
  return (
    <Hoja
      abierta
      onClose={onClose}
      ancho="max-w-xl"
      titulo={i.jugadores.map((j) => j.apellido).join(" / ")}
      sub={
        <span className="flex flex-wrap items-center gap-2">
          {nombreCat(i.categoriaId)} · <span className="font-mono">{i.codigo}</span>
          <span className={clsx("chip", COLOR[i.estado])}>{ESTADOS_INSCRIPCION[i.estado].label}</span>
        </span>
      }
      pie={
        i.estado === "CONFIRMADA" || i.estado === "RECHAZADA" ? (
          i.estado === "RECHAZADA" ? (
            <button className="btn-ghost w-full" disabled={ocupado} onClick={() => hacer("verificar")}>
              <Undo2 className="size-4" /> Reabrir inscripción
            </button>
          ) : null
        ) : rechazando ? (
          <div className="space-y-2">
            <input className="input" autoFocus placeholder="Motivo (la dupla lo verá): pago no recibido, categoría…" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setRechazando(false)}>
                Cancelar
              </button>
              <button className="btn flex-1 bg-coral text-blanco" disabled={!motivo.trim() || ocupado} onClick={() => hacer("rechazar", motivo)}>
                Rechazar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-ghost !px-4" onClick={() => setRechazando(true)} aria-label="Rechazar">
              <XCircle className="size-4" />
            </button>
            {i.estado === "PAGO_REPORTADO" && (
              <button className="btn-ghost !px-4 text-xs" disabled={ocupado} onClick={() => hacer("pendiente")} title="El pago no llegó">
                Sin pago
              </button>
            )}
            <button className="btn-neon flex-1" disabled={ocupado} onClick={() => hacer("confirmar")}>
              <BadgeCheck className="size-4" /> {precio ? "Confirmar e inscribir" : "Inscribir en el torneo"}
            </button>
          </div>
        )
      }
    >
      {i.estado === "CONFIRMADA" && <p className="mb-4 rounded-2xl bg-neon/10 p-3 text-sm text-neon">Ya está en Inscritos{i.revisadaPor ? ` · confirmó ${i.revisadaPor}` : ""}.</p>}
      {i.estado === "RECHAZADA" && i.nota && <p className="mb-4 rounded-2xl bg-coral/10 p-3 text-sm text-coral">Rechazada: {i.nota}</p>}
      {sorteada && i.estado !== "CONFIRMADA" && i.estado !== "RECHAZADA" && (
        <p className="mb-4 rounded-2xl bg-amber-300/10 p-3 text-sm text-amber-200">Esta categoría ya se sorteó: si la confirmas, tendrás que volver a sortear para que entre al cuadro.</p>
      )}

      {precio > 0 && (
        <div className="glass mb-4 rounded-2xl p-4">
          <p className="label !mb-1">Pago · ${precio}</p>
          {i.pago ? (
            <>
              <p className="font-semibold">{metodo?.titulo ?? "Método borrado"}</p>
              {i.pago.referencia && <p className="text-sm text-white/70">Referencia: <span className="font-mono font-semibold">{i.pago.referencia}</span></p>}
              {i.pago.comprobante && (
                <a href={`/api/inscripciones/${torneo.id}/comprobante?i=${i.id}`} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/inscripciones/${torneo.id}/comprobante?i=${i.id}`} alt="Comprobante de pago" className="max-h-72 w-full bg-black/20 object-contain" />
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-white/60">No reportaron el pago todavía.</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {i.jugadores.map((j, k) => (
          <div key={k} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{nombreInscrito(j)}</p>
                <p className="text-sm text-white/55">
                  {j.cedula} · {j.genero === "F" ? "Femenino" : "Masculino"}
                  {j.fechaNacimiento ? ` · ${j.fechaNacimiento}` : ""}
                </p>
              </div>
              {i.fvp?.lista && (
                <span className={clsx("chip shrink-0", i.fvp.categorias[k] ? "text-neon" : "text-amber-200")}>{i.fvp.categorias[k] ? `FVP ${etiquetaNivel(i.fvp.categorias[k]!)}` : "No está en FVP"}</span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Fila t="Lado" v={LADOS.find((l) => l.id === j.lado)?.label} />
              <Fila t="Talla" v={j.talla} />
              <Fila t="Juega en" v={j.categoriaHabitual} />
              <Fila t="Liga" v={j.liga} />
              <Fila t="Alergias" v={j.alergias} ancho alerta={!/^(ninguna?|no|nada)\.?$/i.test(j.alergias)} />
              <Fila t="Últimos torneos" v={j.historial} ancho />
            </dl>
            <div className="mt-3 flex gap-2">
              <a href={enlaceWhatsapp(j.telefono, `Hola ${j.nombre}, te escribimos de La Marina por tu inscripción ${i.codigo} en ${torneo.nombre}.`)} target="_blank" rel="noreferrer" className="btn-ghost flex-1 !py-2 text-xs">
                <IconoWhatsapp className="size-4 text-[#25D366]" /> {j.telefono}
              </a>
              <a href={`mailto:${j.correo}`} className="btn-ghost !px-3 !py-2 text-xs" aria-label={`Correo a ${j.nombre}`}>
                <Mail className="size-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-white/40">
        Inscrita el {new Date(i.creadaEn).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · Aceptaron el reglamento
      </p>
    </Hoja>
  );
}

function Fila({ t, v, ancho, alerta }: { t: string; v?: string | null; ancho?: boolean; alerta?: boolean }) {
  if (!v) return null;
  return (
    <div className={ancho ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{t}</dt>
      <dd className={clsx("whitespace-pre-line", alerta && "font-semibold text-coral")}>{v}</dd>
    </div>
  );
}

