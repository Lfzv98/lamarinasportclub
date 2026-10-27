"use client";

import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Inbox, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { configInscripcionBase, TIPOS_PAGO } from "@/lib/inscripcion";
import { nombreCorto } from "@/lib/torneo/categorias";
import { nuevoId } from "@/lib/torneo/torneo";
import { vibrar } from "@/lib/feedback";
import type { ConfigInscripcion, MetodoPago, TipoMetodoPago } from "@/types/inscripcion";
import type { Torneo } from "@/types/torneo";

function Switch({ valor, onChange, etiqueta }: { valor: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={etiqueta}
      onClick={() => {
        vibrar(8);
        onChange(!valor);
      }}
      className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", valor ? "bg-neon" : "bg-white/15")}
    >
      <motion.span layout className={clsx("absolute top-1 size-5 rounded-full bg-blanco shadow", valor ? "right-1" : "left-1")} />
    </button>
  );
}

const Etiqueta = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <span className="mb-1.5 block text-sm font-semibold">
    {children}
    {sub && <span className="mt-0.5 block text-xs font-normal text-white/45">{sub}</span>}
  </span>
);

/** Ajustes → Inscripción online: abrir/cerrar, precio, qué incluye, pagos, reglamento y ayuda. */
export function AjustesInscripcion({ torneo, valor, onChange }: { torneo: Torneo; valor: ConfigInscripcion | null; onChange: (c: ConfigInscripcion) => void }) {
  const c = valor ?? configInscripcionBase();
  const set = (x: Partial<ConfigInscripcion>) => onChange({ ...c, ...x });
  const setMetodo = (id: string, x: Partial<MetodoPago>) => set({ metodosPago: c.metodosPago.map((m) => (m.id === id ? { ...m, ...x } : m)) });
  const cats = c.categorias ?? [];
  useEffect(() => {
    if (location.hash === "#inscripcion") document.getElementById("inscripcion")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div id="inscripcion" className="scroll-mt-20">
      <p className="label mt-8">Inscripción online</p>
      <div className="glass space-y-5 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Recibir inscripciones por la web</p>
            <p className="text-xs text-white/50">Las duplas se inscriben solas con un enlace; tú verificas el pago y entran a Inscritos.</p>
          </div>
          <Switch valor={c.abierta} onChange={(v) => set({ abierta: v })} etiqueta="Inscripción online abierta" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/inscripcion/${torneo.id}`} target="_blank" className="btn-ghost !px-3 !py-2 text-xs">
            <ExternalLink className="size-3.5" /> Ver página
          </Link>
          <Link href={`/torneos/${torneo.id}/inscripciones`} className="btn-ghost !px-3 !py-2 text-xs">
            <Inbox className="size-3.5" /> Ver inscripciones
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <Etiqueta>Precio por dupla (USD)</Etiqueta>
            <input className="input" type="number" min={0} step={5} inputMode="decimal" value={c.precioDupla} onChange={(e) => set({ precioDupla: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label>
            <Etiqueta>Cierre de inscripciones</Etiqueta>
            <input className="input [color-scheme:dark]" type="date" value={c.cierre ?? ""} onChange={(e) => set({ cierre: e.target.value || null })} />
          </label>
        </div>

        <label className="block">
          <Etiqueta sub="Sale destacado debajo del nombre.">Frase destacada</Etiqueta>
          <input className="input" maxLength={120} placeholder="Torneo Estadal · 500 pts para el ranking FVP" value={c.destacado ?? ""} onChange={(e) => set({ destacado: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta>Presentación</Etiqueta>
          <textarea className="input" rows={3} maxLength={800} placeholder="Cierra el año con el mejor nivel competitivo…" value={c.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta>Premios</Etiqueta>
          <input className="input" maxLength={160} placeholder="Premios en metálico y trofeos" value={c.premios ?? ""} onChange={(e) => set({ premios: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta sub="Una por línea.">Qué incluye la inscripción</Etiqueta>
          <textarea
            className="input"
            rows={5}
            value={c.incluye.join("\n")}
            onChange={(e) =>
              set({
                incluye: e.target.value
                  .split("\n")
                  .map((x) => x.slice(0, 120))
                  .slice(0, 20),
              })
            }
            onBlur={() => set({ incluye: c.incluye.map((x) => x.trim()).filter(Boolean) })}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Pedir talla de franela</p>
            <p className="text-xs text-white/50">Al final ves cuántas de cada talla hay que encargar.</p>
          </div>
          <Switch valor={c.pideTalla} onChange={(v) => set({ pideTalla: v })} etiqueta="Pedir talla" />
        </div>

        <div>
          <Etiqueta sub="Sin marcar ninguna, se abren todas. El cupo de cada una se fija en Inscritos.">Categorías abiertas</Etiqueta>
          <div className="flex flex-wrap gap-2">
            {torneo.categorias.map(({ categoria: k }) => {
              const on = !cats.length || cats.includes(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    const base = cats.length ? cats : torneo.categorias.map((x) => x.categoria.id);
                    const sig = on ? base.filter((x) => x !== k.id) : [...base, k.id];
                    set({ categorias: sig.length === torneo.categorias.length ? [] : sig });
                  }}
                  className={clsx("chip !py-1.5 text-sm", on && "!border-neon/50 !bg-neon/15 !text-neon")}
                >
                  {nombreCorto(k)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="label mt-6">Métodos de pago</p>
      <ul className="space-y-2">
        {c.metodosPago.map((m) => {
          const tipo = TIPOS_PAGO.find((x) => x.id === m.tipo)!;
          return (
            <li key={m.id} className="glass space-y-2 rounded-2xl p-3">
              <div className="flex gap-2">
                <select
                  className="input !w-auto !py-2 text-sm"
                  value={m.tipo}
                  onChange={(e) => {
                    const t = TIPOS_PAGO.find((x) => x.id === e.target.value)!;
                    setMetodo(m.id, { tipo: t.id, titulo: t.label, pideReferencia: t.pideReferencia, datos: t.datos.map((d) => ({ etiqueta: d, valor: m.datos.find((x) => x.etiqueta === d)?.valor ?? "" })) });
                  }}
                  aria-label="Tipo de pago"
                >
                  {TIPOS_PAGO.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input className="input !py-2" value={m.titulo} maxLength={80} onChange={(e) => setMetodo(m.id, { titulo: e.target.value })} aria-label="Nombre que ve el jugador" />
                <button className="rounded-lg p-2 text-white/40 hover:text-coral" onClick={() => set({ metodosPago: c.metodosPago.filter((x) => x.id !== m.id) })} aria-label="Quitar método">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {m.datos.map((d, k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-white/55">{d.etiqueta}</span>
                  <input
                    className="input !py-2 text-sm"
                    value={d.valor}
                    maxLength={120}
                    onChange={(e) => setMetodo(m.id, { datos: m.datos.map((x, j) => (j === k ? { ...x, valor: e.target.value } : x)) })}
                    aria-label={d.etiqueta}
                  />
                </div>
              ))}
              <input className="input !py-2 text-sm" placeholder={tipo.id === "EFECTIVO" ? "Ej. Paga en la recepción antes del cierre" : "Nota (ej. a tasa BCV del día)"} value={m.nota ?? ""} maxLength={200} onChange={(e) => setMetodo(m.id, { nota: e.target.value })} />
            </li>
          );
        })}
      </ul>
      {c.metodosPago.length < 10 && (
        <button
          className="btn-ghost mt-2 !py-2 text-xs"
          onClick={() => {
            const t = TIPOS_PAGO.find((x) => x.id === ("PAGO_MOVIL" as TipoMetodoPago))!;
            set({ metodosPago: [...c.metodosPago, { id: nuevoId("mp-"), tipo: t.id, titulo: t.label, pideReferencia: true, datos: t.datos.map((d) => ({ etiqueta: d, valor: "" })) }] });
          }}
        >
          <Plus className="size-3.5" /> Agregar método
        </button>
      )}

      <div className="glass mt-6 space-y-4 rounded-2xl p-4">
        <label className="block">
          <Etiqueta sub="Botón verde de ayuda y para que manden el comprobante.">WhatsApp del torneo</Etiqueta>
          <input className="input" type="tel" placeholder="0414 123 4567" value={c.whatsapp ?? ""} maxLength={25} onChange={(e) => set({ whatsapp: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta>Instagram</Etiqueta>
          <input className="input" placeholder="lamarinasportclub" value={c.instagram ?? ""} maxLength={60} onChange={(e) => set({ instagram: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta sub="Un punto por línea. Lo aceptan los dos jugadores al inscribirse.">Reglamento</Etiqueta>
          <textarea className="input" rows={6} maxLength={8000} value={c.reglamento ?? ""} onChange={(e) => set({ reglamento: e.target.value })} />
        </label>
        <label className="block">
          <Etiqueta>Enlace al reglamento completo (PDF)</Etiqueta>
          <input className="input" type="url" placeholder="https://…" value={c.reglamentoUrl ?? ""} maxLength={300} onChange={(e) => set({ reglamentoUrl: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
