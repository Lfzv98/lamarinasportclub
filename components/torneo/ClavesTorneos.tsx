"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Flag, KeyRound, Lock, LockOpen, RefreshCw, Share2 } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { claveAleatoria, claveVigente, pinAleatorio, venceAlTerminar, ZONA_CLUB } from "@/lib/torneo/acceso";
import { useListaTorneos, useTorneos } from "@/lib/torneosStore";
import type { Torneo } from "@/types/torneo";
import { rangoFechas } from "./TorneoShell";

const CLAVE_VALIDA = /^[A-Z0-9]{4,12}$/;

/** Fecha y hora locales del club (UTC-4) para un <input type="datetime-local">. */
function aLocalClub(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 4 * 3600_000);
  return d.toISOString().slice(0, 16);
}
const desdeLocalClub = (v: string) => new Date(`${v}:00${ZONA_CLUB}`).toISOString();

const textoVence = (iso: string) =>
  new Date(iso).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" });

/**
 * Ajustes → Claves de torneos (solo staff). Una clave por torneo, la misma para todos los
 * participantes; vence al terminar el último día. Cambiarla deja fuera a quien entró con la anterior.
 */
export function ClavesTorneos() {
  const torneos = useListaTorneos();
  return (
    <>
      <h2 className="label mt-10">Claves de torneos</h2>
      <p className="-mt-1 mb-3 text-sm text-white/50">
        Los participantes entran con esta clave mientras dure el torneo. Al vencer, ya no pueden ver cuadros ni horarios. Los árbitros tienen su propio PIN, que solo sirve para anotar. El staff entra siempre con su PIN.
      </p>
      {torneos.length ? (
        <ul className="space-y-2">
          {torneos.map((t) => (
            <FilaClave key={t.id} torneo={t} />
          ))}
        </ul>
      ) : (
        <div className="glass rounded-2xl p-4 text-sm text-white/50">
          Todavía no hay torneos. <Link href="/torneos/nuevo" className="font-semibold text-neon">Crear uno</Link>
        </div>
      )}
    </>
  );
}

function FilaClave({ torneo }: { torneo: Torneo }) {
  const actualizar = useTorneos((s) => s.actualizar);
  const [ver, setVer] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const acceso = torneo.acceso?.clave ? torneo.acceso : null;
  const vigente = claveVigente(acceso);

  const guardar = (a: Torneo["acceso"], msg: string) => {
    actualizar(torneo.id, (t) => ({ ...t, acceso: a }));
    vibrar(12);
    toast(msg);
  };

  const copiar = async () => {
    if (!acceso) return;
    const texto = `Clave de ${torneo.nombre}: ${acceso.clave}\n${location.origin}/torneos/${torneo.id}`;
    try {
      if (navigator.share) await navigator.share({ title: torneo.nombre, text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast("Clave copiada", "info");
      }
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <li className="glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-xl", !acceso ? "bg-white/5 text-white/40" : vigente ? "bg-neon/10 text-neon" : "bg-coral/10 text-coral")}>
          {acceso ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{torneo.nombre}</p>
          <p className="text-xs text-white/45">
            {rangoFechas(torneo)} ·{" "}
            {!acceso ? "Abierto al público, sin clave" : vigente ? `Vence ${textoVence(acceso.vence)}` : `Venció ${textoVence(acceso.vence)}`}
          </p>
        </div>
        {acceso && (
          <span className={clsx("chip shrink-0", vigente ? "!text-neon" : "!text-coral")}>{vigente ? "Vigente" : "Caducada"}</span>
        )}
      </div>

      {acceso ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editando !== null ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = editando.trim().toUpperCase();
                  if (!CLAVE_VALIDA.test(c)) return toast("Usa de 4 a 12 letras o números", "error");
                  guardar({ ...acceso, clave: c }, "Clave cambiada: quien entró con la anterior tendrá que usar la nueva");
                  setEditando(null);
                }}
              >
                <input
                  autoFocus
                  className="input !py-2 font-display text-lg font-bold uppercase tracking-[0.3em]"
                  value={editando}
                  maxLength={12}
                  onChange={(e) => setEditando(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
                  aria-label="Nueva clave"
                />
                <button className="btn-neon !px-3 !py-2" aria-label="Guardar clave">
                  <Check className="size-4" />
                </button>
              </form>
            ) : (
              <button
                className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-left font-display text-xl font-bold tracking-[0.3em]"
                onClick={() => setEditando(acceso.clave)}
                title="Toca para escribir otra clave"
              >
                {ver ? acceso.clave : "•".repeat(acceso.clave.length)}
              </button>
            )}
            <button className="btn-ghost !p-2.5" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar clave" : "Ver clave"}>
              {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button className="btn-ghost !p-2.5" onClick={copiar} aria-label="Compartir clave">
              {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="size-4" /> : <Copy className="size-4" />}
            </button>
            <button
              className="btn-ghost !p-2.5"
              onClick={() => {
                if (confirm("¿Generar una clave nueva? Quien entró con la actual tendrá que escribir la nueva.")) {
                  guardar({ ...acceso, clave: claveAleatoria() }, "Clave nueva generada");
                  setVer(true);
                }
              }}
              aria-label="Generar clave nueva"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/50">Vence</span>
            <input
              type="datetime-local"
              className="input !w-auto !px-3 !py-1.5 text-sm [color-scheme:dark]"
              value={aLocalClub(acceso.vence)}
              onChange={(e) => e.target.value && guardar({ ...acceso, vence: desdeLocalClub(e.target.value) }, "Vencimiento actualizado")}
            />
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => guardar({ ...acceso, vence: venceAlTerminar(torneo.dias) }, "Vence al terminar el torneo")}>
              Al terminar el torneo
            </button>
            <button
              className="ml-auto text-xs text-white/40 hover:text-coral"
              onClick={() => confirm("¿Quitar la clave? Cualquiera con el enlace podrá ver el torneo.") && guardar(null, "Torneo abierto al público")}
            >
              Quitar clave
            </button>
          </div>
        </>
      ) : (
        <button
          className="btn-ghost mt-3 !py-2 text-xs"
          onClick={() => {
            guardar({ clave: claveAleatoria(), vence: venceAlTerminar(torneo.dias) }, "Clave creada");
            setVer(true);
          }}
        >
          <KeyRound className="size-3.5" /> Proteger con clave
        </button>
      )}
      <PinArbitros torneo={torneo} />
    </li>
  );
}

/** PIN de árbitros: rol aparte que solo anota (Inicio → Árbitros). Vence con el torneo. */
function PinArbitros({ torneo }: { torneo: Torneo }) {
  const actualizar = useTorneos((s) => s.actualizar);
  const [ver, setVer] = useState(false);
  const arb = torneo.arbitros?.pin ? torneo.arbitros : null;
  const vigente = claveVigente(arb);
  const guardar = (a: Torneo["arbitros"], msg: string) => {
    actualizar(torneo.id, (t) => ({ ...t, arbitros: a }));
    vibrar(12);
    toast(msg);
  };
  const compartir = async () => {
    if (!arb) return;
    const texto = `Árbitros de ${torneo.nombre}\nEntra en ${location.origin}/arbitro con tu nombre y el PIN ${arb.pin}`;
    try {
      if (navigator.share) await navigator.share({ title: `Árbitros · ${torneo.nombre}`, text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast("PIN copiado", "info");
      }
    } catch {
      /* el usuario canceló */
    }
  };
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Flag className={clsx("size-4", arb && vigente ? "text-lima" : "text-white/35")} />
        <span className="text-sm font-semibold">PIN de árbitros</span>
        {arb ? (
          <>
            <button className="rounded-lg bg-white/5 px-3 py-1 font-display text-lg font-bold tracking-[0.3em]" onClick={() => setVer((v) => !v)} title={ver ? "Ocultar" : "Ver"}>
              {ver ? arb.pin : "•".repeat(arb.pin.length)}
            </button>
            {!vigente && <span className="chip !text-coral">Vencido</span>}
            <span className="flex-1" />
            <button className="btn-ghost !p-2" onClick={compartir} aria-label="Compartir PIN de árbitros">
              {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="size-4" /> : <Copy className="size-4" />}
            </button>
            <button
              className="btn-ghost !p-2"
              aria-label="PIN nuevo"
              onClick={() => {
                if (!confirm("¿PIN nuevo? Los árbitros que entraron con el actual tendrán que volver a entrar.")) return;
                guardar({ pin: pinAleatorio(), vence: venceAlTerminar(torneo.dias) }, "PIN de árbitros nuevo");
                setVer(true);
              }}
            >
              <RefreshCw className="size-4" />
            </button>
            <button className="text-xs text-white/40 hover:text-coral" onClick={() => confirm("¿Quitar el PIN? Solo el staff podrá anotar.") && guardar(null, "PIN de árbitros quitado")}>
              Quitar
            </button>
          </>
        ) : (
          <button
            className="btn-ghost !py-1.5 text-xs"
            onClick={() => {
              guardar({ pin: pinAleatorio(), vence: venceAlTerminar(torneo.dias) }, "PIN de árbitros creado");
              setVer(true);
            }}
          >
            <KeyRound className="size-3.5" /> Crear PIN de árbitros
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-white/40">Sirve solo para anotar en Inicio → Árbitros. No da acceso a cuadros, horarios ni ajustes. Vence al terminar el torneo.</p>
    </div>
  );
}
