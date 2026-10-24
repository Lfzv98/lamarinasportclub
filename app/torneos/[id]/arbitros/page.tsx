"use client";

import clsx from "clsx";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Flag, MessageCircle, Pause, Play, Share2, Shuffle, Trash2, UserCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StaffGate } from "@/components/StaffGate";
import { TorneoShell } from "@/components/torneo/TorneoShell";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { pinAleatorio, venceAlTerminar } from "@/lib/torneo/acceso";
import { franjasDia, partidosDeTurno, repartirTurnos } from "@/lib/torneo/arbitros";
import { nombrePista } from "@/lib/torneo/imprevistos";
import { useTorneos } from "@/lib/torneosStore";
import type { ArbitroRegistrado, Torneo, TurnoArbitro } from "@/types/torneo";

const pl = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

type ArbitroStaff = ArbitroRegistrado & { partidos: number; puntos: number };

/** Árbitros del torneo (solo staff): quiénes se registraron, qué anotó cada uno y sus turnos. */
export default function ArbitrosTorneoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <StaffGate>
      <TorneoShell id={id} ancho="max-w-4xl">
        {(t) => <Arbitros torneo={t} />}
      </TorneoShell>
    </StaffGate>
  );
}

function Arbitros({ torneo }: { torneo: Torneo }) {
  const actualizar = useTorneos((s) => s.actualizar);
  const [lista, setLista] = useState<ArbitroStaff[] | null>(null);
  const [verPin, setVerPin] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/arbitros?torneoId=${encodeURIComponent(torneo.id)}`, { cache: "no-store" });
      if (r.ok) setLista(((await r.json()) as { arbitros: ArbitroStaff[] }).arbitros);
    } catch {
      setLista((l) => l ?? []);
    }
  }, [torneo.id]);
  useEffect(() => {
    cargar();
    const i = setInterval(cargar, 15_000);
    return () => clearInterval(i);
  }, [cargar]);

  const arb = torneo.arbitros?.pin ? torneo.arbitros : null;
  const turnos = arb?.turnos ?? [];
  const activos = (lista ?? []).filter((a) => a.activo);
  const nombre = (id: string) => {
    const a = lista?.find((x) => x.id === id);
    return a ? `${a.nombre} ${a.apellido}` : "Árbitro";
  };
  const guardarTurnos = (ts: TurnoArbitro[], msg?: string) => {
    actualizar(torneo.id, (t) => ({ ...t, arbitros: { ...t.arbitros!, turnos: ts } }));
    vibrar(10);
    if (msg) toast(msg);
  };

  async function cambiarActivo(a: ArbitroStaff) {
    const r = await fetch("/api/arbitros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ torneoId: torneo.id, id: a.id, activo: !a.activo }) });
    if (!r.ok) return toast("No se pudo cambiar. Revisa la conexión.", "error");
    toast(a.activo ? `${a.nombre} queda en pausa: no puede anotar` : `${a.nombre} puede anotar otra vez`);
    cargar();
  }
  async function borrar(a: ArbitroStaff) {
    if (!confirm(`¿Borrar a ${a.nombre} ${a.apellido}? Sus partidos anotados conservan su nombre y se quitan sus turnos.`)) return;
    const r = await fetch(`/api/arbitros?${new URLSearchParams({ torneoId: torneo.id, id: a.id })}`, { method: "DELETE" });
    if (!r.ok) return toast("No se pudo borrar.", "error");
    guardarTurnos(turnos.filter((x) => x.arbitroId !== a.id));
    cargar();
  }

  if (!arb)
    return (
      <div className="glass mt-4 rounded-[2rem] p-8 text-center">
        <Flag className="mx-auto size-10 text-lima" />
        <h2 className="mt-3 font-display text-2xl font-bold">Activa a los árbitros</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-white/55">Se crea un PIN para este torneo. Cada árbitro se registra una vez con ese PIN y luego entra con su nombre y su código personal.</p>
        <button
          className="btn-neon mt-5"
          onClick={() => {
            actualizar(torneo.id, (t) => ({ ...t, arbitros: { pin: pinAleatorio(), vence: venceAlTerminar(t.dias), turnos: [] } }));
            setVerPin(true);
            toast("PIN de árbitros creado");
          }}
        >
          <Flag className="size-4" /> Crear PIN de árbitros
        </button>
      </div>
    );

  const compartir = async () => {
    const texto = `Árbitros de ${torneo.nombre}\n1. Entra en ${location.origin}/arbitro\n2. Toca "Soy nuevo" y regístrate con el PIN ${arb.pin}\n3. Crea tu código de 4 números: con él entras siempre.`;
    try {
      if (navigator.share) await navigator.share({ title: `Árbitros · ${torneo.nombre}`, text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast("Instrucciones copiadas", "info");
      }
    } catch {
      /* canceló */
    }
  };

  return (
    <div className="space-y-8 pt-2">
      <section className="glass flex flex-wrap items-center gap-3 rounded-[2rem] p-5">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-lima text-marino-2">
          <Flag className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">Árbitros</p>
          <p className="text-sm text-white/55">Se registran en Inicio → Árbitros con este PIN. Después entran con su nombre y su código.</p>
        </div>
        <button className="rounded-xl bg-white/5 px-4 py-2 font-display text-2xl font-bold tracking-[0.3em]" onClick={() => setVerPin((v) => !v)} title={verPin ? "Ocultar" : "Ver"}>
          {verPin ? arb.pin : "•".repeat(arb.pin.length)}
        </button>
        <button className="btn-ghost !p-2.5" onClick={() => setVerPin((v) => !v)} aria-label={verPin ? "Ocultar PIN" : "Ver PIN"}>
          {verPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button className="btn-neon !py-2.5" onClick={compartir}>
          <Share2 className="size-4" /> Enviar a los árbitros
        </button>
      </section>

      <section>
        <h2 className="label">Registrados {lista ? `· ${lista.length}` : ""}</h2>
        {lista === null ? (
          <div className="flex justify-center py-8">
            <div className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
          </div>
        ) : !lista.length ? (
          <p className="glass rounded-2xl p-5 text-sm text-white/55">Nadie se registró todavía. Envíales el PIN con el botón de arriba.</p>
        ) : (
          <ul className="space-y-2">
            {lista.map((a) => {
              const suyos = turnos.filter((x) => x.arbitroId === a.id);
              const tel = (a.telefono ?? "").replace(/\D/g, "");
              return (
                <li key={a.id} className={clsx("glass flex flex-wrap items-center gap-3 rounded-2xl p-4", !a.activo && "opacity-60")}>
                  <Avatar nombre={`${a.nombre} ${a.apellido}`} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {a.nombre} {a.apellido} {!a.activo && <span className="chip ml-1 !text-amber-200">En pausa</span>}
                    </p>
                    <p className="text-xs text-white/50">
                      {pl(suyos.length, "turno")} · {pl(a.partidos, "partido")} {a.partidos === 1 ? "anotado" : "anotados"} · {pl(a.puntos, "punto")} · {a.telefono}
                    </p>
                  </div>
                  {tel && (
                    <a className="btn-ghost !p-2.5" href={`https://wa.me/${tel.length === 11 && tel.startsWith("0") ? `58${tel.slice(1)}` : tel}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                  <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => cambiarActivo(a)}>
                    {a.activo ? (
                      <>
                        <Pause className="size-3.5" /> Pausar
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" /> Reactivar
                      </>
                    )}
                  </button>
                  <button className="btn-ghost !p-2.5 hover:!text-coral" onClick={() => borrar(a)} aria-label="Borrar árbitro">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Turnos torneo={torneo} turnos={turnos} activos={activos} nombre={nombre} guardar={guardarTurnos} />
    </div>
  );
}

function Turnos({
  torneo,
  turnos,
  activos,
  nombre,
  guardar,
}: {
  torneo: Torneo;
  turnos: TurnoArbitro[];
  activos: ArbitroStaff[];
  nombre: (id: string) => string;
  guardar: (ts: TurnoArbitro[], msg?: string) => void;
}) {
  const pistas = torneo.canchas.filter((c) => c.activa).map((c) => c.numero);
  const resumen = useMemo(() => {
    const m = new Map<string, { turnos: number; partidos: number }>();
    for (const x of turnos) {
      const r = m.get(x.arbitroId) ?? { turnos: 0, partidos: 0 };
      r.turnos++;
      r.partidos += partidosDeTurno(torneo, x).length;
      m.set(x.arbitroId, r);
    }
    return m;
  }, [torneo, turnos]);

  const poner = (fecha: string, f: { desde: string; hasta: string }, pista: number, arbitroId: string) => {
    const id = `tu-${fecha}-${f.desde.replace(":", "")}-p${pista}`;
    const sin = turnos.filter((x) => x.id !== id);
    // Un árbitro no puede estar en dos pistas a la vez.
    const choca = arbitroId && sin.find((x) => x.arbitroId === arbitroId && x.fecha === fecha && x.desde === f.desde);
    if (choca && !confirm(`${nombre(arbitroId)} ya está en ${nombrePista(torneo, choca.pista)} en esa franja. ¿Lo cambias a esta pista?`)) return;
    const final = sin.filter((x) => !(choca && x.id === choca.id));
    guardar(arbitroId ? [...final, { id, arbitroId, fecha, pista, desde: f.desde, hasta: f.hasta }] : final);
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="label !mb-0">Turnos</h2>
          <p className="text-sm text-white/55">Cada árbitro ve en su tablet la pista y los partidos que le tocan.</p>
        </div>
        <button
          className="btn-neon"
          disabled={!activos.length}
          onClick={() => {
            if (turnos.length && !confirm("¿Repartir de nuevo? Se reemplazan los turnos actuales.")) return;
            guardar(
              repartirTurnos(
                torneo,
                activos.map((a) => a.id),
                Date.now() % 7,
              ),
              "Turnos repartidos de forma pareja",
            );
          }}
        >
          <Shuffle className="size-4" /> Repartir automáticamente
        </button>
      </div>

      {activos.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activos.map((a) => {
            const r = resumen.get(a.id);
            return (
              <span key={a.id} className="chip">
                <UserCheck className="size-3.5 text-lima" /> {a.nombre} · {pl(r?.turnos ?? 0, "turno")} · {pl(r?.partidos ?? 0, "partido")}
              </span>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {torneo.dias.map((d) => (
          <div key={d.fecha} className="glass overflow-x-auto rounded-[1.5rem] p-4">
            <p className="mb-3 font-display text-lg font-bold capitalize">{new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</p>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-white/45">
                  <th className="pb-2 text-left font-semibold">Franja</th>
                  {pistas.map((n) => (
                    <th key={n} className="pb-2 pl-2 text-left font-semibold">
                      {nombrePista(torneo, n)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {franjasDia(d).map((f) => (
                  <tr key={f.desde} className="align-top">
                    <td className="py-1.5 pr-2 font-display font-bold tabular text-white/70">
                      {f.desde}–{f.hasta}
                    </td>
                    {pistas.map((n) => {
                      const x = turnos.find((t) => t.fecha === d.fecha && t.desde === f.desde && t.pista === n);
                      const cuantos = partidosDeTurno(torneo, { fecha: d.fecha, pista: n, ...f }).length;
                      return (
                        <td key={n} className="py-1.5 pl-2">
                          <select
                            className={clsx("input !py-2 !pl-3 text-sm", x ? "!border-lima/40 text-white" : "text-white/40")}
                            value={x?.arbitroId ?? ""}
                            onChange={(e) => poner(d.fecha, f, n, e.target.value)}
                          >
                            <option value="">Sin árbitro</option>
                            {activos.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre} {a.apellido}
                              </option>
                            ))}
                            {x && !activos.some((a) => a.id === x.arbitroId) && <option value={x.arbitroId}>{nombre(x.arbitroId)}</option>}
                          </select>
                          <p className="mt-1 text-[11px] text-white/40">{pl(cuantos, "partido")}</p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
