"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CloudRain, Flag, LogOut, Megaphone, Play, Tv, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { StaffChip } from "@/components/StaffGate";
import { ArbitroLogin, useTorneosConArbitros } from "@/components/torneo/Arbitraje";
import { MarcadorMini, useAhora, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { toast } from "@/components/ui/Toaster";
import { useArbitro, useArbitroStore } from "@/lib/arbitro";
import { vibrar } from "@/lib/feedback";
import { nombreCorto } from "@/lib/torneo/categorias";
import { nombrePista } from "@/lib/torneo/imprevistos";
import { estadoPistas, limiteWO, type EstadoPista } from "@/lib/torneo/programacion";
import { categoria, dupla, nombreDupla } from "@/lib/torneo/torneo";
import { useEsStaff } from "@/lib/store";
import { useListaTorneos, useTorneo, useTorneos } from "@/lib/torneosStore";
import type { PartidoTorneo, Torneo } from "@/types/torneo";

const PISTA_GUARDADA = "lamarina-arbitro-pista";

/**
 * Panel del árbitro: lo que se ve en la tablet de la esquina de cada pista.
 * Solo su pista: el partido en juego, el que está llamado y el siguiente. Sin cuadros,
 * horarios ni ajustes: eso es del staff.
 */
export default function ArbitroPage() {
  const arbitro = useArbitro();
  const esStaff = useEsStaff();
  const hidratado = useTorneos((s) => s.hidratado);
  const lista = useListaTorneos();
  const conPin = useTorneosConArbitros();
  const [torneoStaff, setTorneoStaff] = useState<string | null>(null);

  if (arbitro === undefined || esStaff === undefined || !hidratado)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );

  if (arbitro) return <Panel torneoId={arbitro.torneoId} nombre={arbitro.nombre} />;

  // El staff también puede usar el panel: elige el torneo.
  const enCurso = lista.filter((t) => t.estado !== "FINALIZADO");
  if (esStaff && (torneoStaff || enCurso.length === 1)) return <Panel torneoId={torneoStaff ?? enCurso[0].id} nombre="Staff" alCambiar={enCurso.length > 1 ? () => setTorneoStaff(null) : undefined} />;

  return (
    <main className="min-h-dvh pb-16">
      <div className="sobre-marca relative overflow-hidden bg-marca pb-14 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-marca-2/50 blur-3xl" />
        <header className="relative mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <Link href="/" className="btn-ghost !p-2.5" aria-label="Inicio">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex-1" />
          <StaffChip />
        </header>
        <div className="relative mx-auto max-w-xl px-6 pt-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-lima text-marino-2">
            <Flag className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Árbitros</h1>
          <p className="mt-2 text-white/65">La tablet de la pista. Un toque por punto: el marcador de la pista, los televisores y las estadísticas de los atletas se actualizan al instante.</p>
        </div>
      </div>
      <div className="relative -mt-6 rounded-t-[2rem] bg-fondo px-4 pt-8">
        <div className="mx-auto flex max-w-xl flex-col items-center">
          {esStaff ? (
            <div className="w-full space-y-2">
              <p className="label">¿Qué torneo vas a anotar?</p>
              {enCurso.map((t) => (
                <button key={t.id} className="glass w-full rounded-2xl px-4 py-3 text-left hover:border-neon/40" onClick={() => setTorneoStaff(t.id)}>
                  <span className="block font-semibold">{t.nombre}</span>
                  <span className="block text-xs text-white/50">{t.arbitros ? "Con PIN de árbitros" : "Sin PIN de árbitros: créalo en Ajustes del club → Claves de torneos"}</span>
                </button>
              ))}
              {!enCurso.length && <p className="text-center text-white/55">No hay torneos en curso.</p>}
            </div>
          ) : (
            <>
              <ArbitroLogin />
              {conPin.length > 0 && <p className="mt-6 max-w-sm text-center text-xs text-white/45">El PIN te lo da el staff. Vale solo para anotar y vence cuando termina el torneo.</p>}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Panel({ torneoId, nombre, alCambiar }: { torneoId: string; nombre: string; alCambiar?: () => void }) {
  const torneo = useTorneo(torneoId);
  const salir = useArbitroStore((s) => s.salir);
  const ahora = useAhora(1000);
  useMarcadoresEnVivo(torneoId, 4000);
  const [pista, setPista] = useState<number | null>(null);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(`${PISTA_GUARDADA}:${torneoId}`));
      if (v) setPista(v);
    } catch {
      /* sin almacenamiento */
    }
  }, [torneoId]);
  const elegir = (n: number) => {
    vibrar(8);
    setPista(n);
    try {
      localStorage.setItem(`${PISTA_GUARDADA}:${torneoId}`, String(n));
    } catch {
      /* nada */
    }
  };

  const pistas = useMemo(() => (torneo && !torneo.bloqueado ? estadoPistas(torneo, ahora) : []), [torneo, ahora]);
  if (!torneo || torneo.bloqueado)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
        <p className="text-sm text-white/50">Cargando el torneo…</p>
      </main>
    );
  const actual = pistas.find((e) => e.numero === pista) ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 py-2">
        <Logo compacto className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight">{torneo.nombre}</p>
          <p className="flex items-center gap-1.5 text-xs text-white/55">
            <Flag className="size-3 text-lima" /> Árbitro · {nombre}
          </p>
        </div>
        <Link href={`/torneos/${torneo.id}/tv`} className="btn-ghost !p-2.5" title="Modo TV" aria-label="Modo TV">
          <Tv className="size-4" />
        </Link>
        {alCambiar ? (
          <button className="btn-ghost !px-3 !py-2 text-xs" onClick={alCambiar}>
            Cambiar torneo
          </button>
        ) : nombre !== "Staff" ? (
          <button
            className="btn-ghost !p-2.5"
            aria-label="Salir"
            title="Salir"
            onClick={() => confirm("¿Cerrar la sesión de árbitro en esta tablet?") && salir()}
          >
            <LogOut className="size-4" />
          </button>
        ) : null}
      </header>

      <p className="label mt-4">Tu pista</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {pistas.map((e) => (
          <button
            key={e.numero}
            onClick={() => elegir(e.numero)}
            className={clsx("relative shrink-0 rounded-2xl border px-4 py-2.5 text-left transition", e.numero === pista ? "seleccion sobre-marca" : "border-white/10 hover:border-neon/40")}
          >
            <span className={clsx("block font-display text-lg font-bold", e.numero === pista && "text-lima")}>{nombrePista(torneo, e.numero)}</span>
            <span className="block text-[11px] text-white/50">{e.suspendida ? "Suspendida" : e.enJuego ? "En juego" : e.llamado ? "Llamado" : e.siguiente ? `Sigue ${e.siguiente.programacion?.hora ?? ""}` : "Libre"}</span>
            {e.enJuego && <span className="absolute right-2 top-2 size-2 animate-pulse rounded-full bg-neon" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!actual ? (
          <motion.div key="elige" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass mt-6 flex flex-1 flex-col items-center justify-center rounded-[2rem] p-10 text-center">
            <Flag className="size-10 text-lima" />
            <p className="mt-4 font-display text-2xl font-bold">Elige tu pista</p>
            <p className="mt-1 max-w-xs text-sm text-white/55">Queda guardada en esta tablet. Verás solo los partidos de esa pista.</p>
          </motion.div>
        ) : (
          <motion.div key={actual.numero} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex flex-1 flex-col gap-4">
            <PistaArbitro torneo={torneo} e={actual} ahora={ahora} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Duplas({ torneo, p }: { torneo: Torneo; p: PartidoTorneo }) {
  return (
    <div className="space-y-2">
      {[p.duplaA, p.duplaB].map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={clsx("h-8 w-1.5 rounded-full", i === 0 ? "bg-lima" : "bg-cielo")} />
          <span className="font-display text-2xl font-bold">{nombreDupla(torneo, dupla(torneo, d))}</span>
        </div>
      ))}
    </div>
  );
}

function Encabezado({ torneo, p, rotulo, vivo = false }: { torneo: Torneo; p: PartidoTorneo; rotulo: string; vivo?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
      {vivo && <span className="size-2 animate-pulse rounded-full bg-neon" />}
      <span className={vivo ? "text-neon" : "text-lima"}>{rotulo}</span>
      <span>·</span>
      <span className="truncate">
        {nombreCorto(categoria(torneo, p.categoriaId)!.categoria)} · {p.etiqueta}
      </span>
    </div>
  );
}

/** Lo que viene en esta pista según la programación, para que el árbitro sepa a quién esperar. */
function DespuesEnPista({ torneo, pista, excluir }: { torneo: Torneo; pista: number; excluir: string }) {
  const proximos = torneo.categorias
    .flatMap((c) => c.cuadro?.partidos ?? [])
    .filter((p) => p.id !== excluir && p.estado === "PENDIENTE" && p.programacion?.pista === pista)
    .sort((a, b) => `${a.programacion!.fecha} ${a.programacion!.hora}`.localeCompare(`${b.programacion!.fecha} ${b.programacion!.hora}`))
    .slice(0, 2);
  if (!proximos.length) return <div className="flex-1" />;
  return (
    <div className="mt-auto pt-6">
      <p className="label">Después en esta pista</p>
      <ul className="space-y-2">
        {proximos.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
            <span className="font-display text-lg font-bold tabular-nums text-lima">{p.programacion!.hora}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.duplaA && p.duplaB ? `${nombreDupla(torneo, dupla(torneo, p.duplaA))} vs ${nombreDupla(torneo, dupla(torneo, p.duplaB))}` : "Por definir"}
            </span>
            <span className="shrink-0 text-xs text-white/45">
              {nombreCorto(categoria(torneo, p.categoriaId)!.categoria)} · {p.etiqueta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PistaArbitro({ torneo, e, ahora }: { torneo: Torneo; e: EstadoPista; ahora: number }) {
  const accionPartido = useTorneos((s) => s.accionPartido);
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const hacer = async (pid: string, a: Parameters<typeof accionPartido>[2], ok: string) => {
    setOcupado(true);
    vibrar(15);
    const err = await accionPartido(torneo.id, pid, a);
    setOcupado(false);
    toast(err ?? ok, err ? "error" : undefined);
  };
  const anotar = (p: PartidoTorneo) => `/torneos/${torneo.id}/anotar/${encodeURIComponent(p.id)}`;

  if (e.enJuego)
    return (
      <div className="seleccion sobre-marca flex flex-1 flex-col rounded-[2rem] border p-6">
        <Encabezado torneo={torneo} p={e.enJuego} rotulo="En juego" vivo />
        <MarcadorMini torneo={torneo} p={e.enJuego} grande />
        <DespuesEnPista torneo={torneo} pista={e.numero} excluir={e.enJuego.id} />
        <Link href={anotar(e.enJuego)} className="btn-neon mt-6 w-full !py-5 text-lg">
          <Play className="size-6" /> Seguir anotando
        </Link>
      </div>
    );

  if (e.llamado) {
    const p = e.llamado;
    const limite = limiteWO(torneo, p);
    const quedan = limite === null ? null : Math.ceil((limite - ahora) / 1000);
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    return (
      <div className="glass flex flex-1 flex-col rounded-[2rem] p-6">
        <Encabezado torneo={torneo} p={p} rotulo="Llamado a pista" />
        <Duplas torneo={torneo} p={p} />
        {quedan !== null && (
          <p className={clsx("mt-5 rounded-2xl px-4 py-3 text-center text-sm font-semibold", quedan > 0 ? "bg-white/5 text-white/70" : "bg-coral/15 text-coral")}>
            {quedan > 0 ? `Tolerancia FIP: W.O. posible en ${mmss(quedan)}` : "Pasó la tolerancia: si una dupla no está, se puede dar W.O."}
          </p>
        )}
        <DespuesEnPista torneo={torneo} pista={e.numero} excluir={p.id} />
        <Link href={anotar(p)} className="btn-neon mt-6 w-full !py-5 text-lg">
          <Play className="size-6" /> Empezar partido
        </Link>
        {quedan !== null && quedan <= 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((l) => {
              const ausente = nombreDupla(torneo, dupla(torneo, l === "A" ? p.duplaA : p.duplaB));
              return (
                <button
                  key={l}
                  disabled={ocupado}
                  className="btn-ghost !py-3 text-sm !text-coral"
                  onClick={() => confirm(`¿No se presentó ${ausente}? Pierde por W.O.`) && hacer(p.id, { accion: "wo", ganador: l === "A" ? "B" : "A" }, `W.O. registrado: no vino ${ausente}.`)}
                >
                  <UserX className="size-4" /> No vino {ausente}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (e.suspendida)
    return (
      <div className="glass flex flex-1 flex-col items-center justify-center rounded-[2rem] p-10 text-center">
        <CloudRain className="size-12 text-amber-200" />
        <p className="mt-4 font-display text-2xl font-bold">Pista suspendida</p>
        <p className="mt-1 text-sm text-white/55">{e.suspendida}. El staff avisa cuando se reanuda.</p>
      </div>
    );

  if (e.siguiente) {
    const p = e.siguiente;
    return (
      <div className="glass flex flex-1 flex-col rounded-[2rem] p-6">
        <Encabezado torneo={torneo} p={p} rotulo={p.programacion ? `Siguiente · ${p.programacion.hora}` : "Siguiente"} />
        <Duplas torneo={torneo} p={p} />
        <p className="mt-4 text-sm text-white/50">Cuando estén las duplas, llama a pista: empieza a correr la tolerancia y la pantalla de la pista los anuncia.</p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
          <button disabled={ocupado} className="btn-ghost !py-4" onClick={() => hacer(p.id, { accion: "llamar", pista: e.numero }, "Llamado a pista.")}>
            <Megaphone className="size-5" /> Llamar a pista
          </button>
          <button
            disabled={ocupado}
            className="btn-neon !py-4"
            onClick={async () => {
              // Queda en esta pista (aunque estuviera programado en otra) y se abre el anotador.
              setOcupado(true);
              const err = await accionPartido(torneo.id, p.id, { accion: "llamar", pista: e.numero });
              setOcupado(false);
              if (err) toast(err, "error");
              else router.push(anotar(p));
            }}
          >
            <Play className="size-5" /> Empezar ya
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass flex flex-1 flex-col items-center justify-center rounded-[2rem] p-10 text-center">
      <Flag className="size-10 text-white/30" />
      <p className="mt-4 font-display text-2xl font-bold">Sin partidos por ahora</p>
      <p className="mt-1 text-sm text-white/55">Cuando haya uno listo para esta pista aparece aquí solo.</p>
    </div>
  );
}
