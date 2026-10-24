"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowLeft, Flag, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { rangoFechas } from "@/components/torneo/TorneoShell";
import { esArbitroDe, useArbitro, useArbitroStore } from "@/lib/arbitro";
import { useAmericanos, useEsStaff } from "@/lib/store";
import { useListaTorneos, useTorneos } from "@/lib/torneosStore";

const NOMBRE_GUARDADO = "lamarina-arbitro-nombre";

function leerNombre(): string {
  try {
    return localStorage.getItem(NOMBRE_GUARDADO) ?? "";
  } catch {
    return "";
  }
}

/** Torneos con PIN de árbitros vigente. */
export function useTorneosConArbitros() {
  const lista = useListaTorneos();
  return lista.filter((t) => t.arbitros && new Date(t.arbitros.vence).getTime() > Date.now());
}

/** Formulario de entrada del árbitro: torneo, nombre y PIN. */
export function ArbitroLogin({ torneoFijo, onListo }: { torneoFijo?: string; onListo?: () => void }) {
  const entrar = useArbitroStore((s) => s.entrar);
  const torneos = useTorneosConArbitros();
  const [torneoId, setTorneoId] = useState(torneoFijo ?? "");
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setNombre((n) => n || leerNombre()), []);
  useEffect(() => {
    if (!torneoId && torneos.length === 1) setTorneoId(torneos[0].id);
  }, [torneoId, torneos]);

  const fijo = torneos.find((t) => t.id === torneoId);
  return (
    <form
      className="w-full max-w-sm space-y-4 text-left"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!torneoId || !pin || nombre.trim().length < 2) return;
        setEnviando(true);
        const err = await entrar(torneoId, pin, nombre);
        setEnviando(false);
        setError(err);
        if (err) return;
        try {
          localStorage.setItem(NOMBRE_GUARDADO, nombre.trim());
        } catch {
          /* sin almacenamiento */
        }
        await useTorneos.getState().sincronizar();
        onListo?.();
      }}
    >
      {!torneoFijo && (
        <div>
          <p className="label">Torneo</p>
          {torneos.length === 0 ? (
            <p className="glass rounded-2xl p-3 text-sm text-white/60">No hay torneos con PIN de árbitros vigente. El staff lo crea en Ajustes del club → Claves de torneos.</p>
          ) : (
            <div className="space-y-2">
              {torneos.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTorneoId(t.id)}
                  className={clsx("w-full rounded-2xl border px-4 py-3 text-left transition", t.id === torneoId ? "seleccion sobre-marca" : "border-white/10 hover:border-neon/40")}
                >
                  <span className={clsx("block font-semibold", t.id === torneoId && "text-lima")}>{t.nombre}</span>
                  <span className="block text-xs text-white/50">{rangoFechas(t)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {torneoFijo && fijo && <p className="text-center text-sm text-white/55">{fijo.nombre}</p>}
      <div>
        <label className="label" htmlFor="arb-nombre">Tu nombre</label>
        <input id="arb-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Carlos" maxLength={40} autoComplete="given-name" />
        <p className="mt-1 text-xs text-white/45">Queda en cada partido que anotes.</p>
      </div>
      <div>
        <label className="label" htmlFor="arb-pin">PIN de árbitros</label>
        <input
          id="arb-pin"
          className="input text-center font-display text-2xl font-bold tracking-[0.4em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••"
        />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button className="btn-neon w-full text-base" disabled={enviando || !torneoId || pin.length < 4 || nombre.trim().length < 2}>
        <Flag className="size-5" /> Entrar a anotar
      </button>
    </form>
  );
}

/** El anotador lo usan el staff y los árbitros de ese torneo; al resto le pide el PIN. */
export function AnotadorGate({ torneoId, children }: { torneoId: string; children: React.ReactNode }) {
  const esStaff = useEsStaff();
  const arbitro = useArbitro();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  if (esStaff === undefined || (arbitro === undefined && !esStaff))
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );
  if (esStaff || esArbitroDe(arbitro, torneoId)) return <>{children}</>;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo compacto className="size-14" />
      <span className="flex size-16 items-center justify-center rounded-2xl bg-lima text-marino-2">
        <LockKeyhole className="size-8" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold">Anotador oficial</h1>
        <p className="mt-1 max-w-sm text-sm text-white/55">Solo el árbitro del partido o el staff. Entra con el PIN de árbitros del torneo.</p>
      </div>
      <ArbitroLogin torneoFijo={torneoId} />
      <div className="flex gap-3">
        <Link href={`/torneos/${torneoId}`} className="btn-ghost">
          <ArrowLeft className="size-4" /> Torneo
        </Link>
        <button className="btn-ghost" onClick={() => setPedirLogin(true)}>
          Soy staff
        </button>
      </div>
    </main>
  );
}

/** A dónde vuelve el anotador: el árbitro a su panel, el staff al torneo. */
export function useVolverAnotador(torneoId: string): string {
  const arbitro = useArbitro();
  const esStaff = useEsStaff();
  return !esStaff && esArbitroDe(arbitro, torneoId) ? "/arbitro" : `/torneos/${torneoId}`;
}
