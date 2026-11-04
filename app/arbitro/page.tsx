"use client";

import { BotonAjustes } from "@/components/BotonAjustes";
import clsx from "clsx";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ClipboardCheck, CloudRain, Flag, LogOut, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConsolaPartido, Vacio } from "@/components/arbitro/Consola";
import { EstadoConexion } from "@/components/torneo/Conexion";
import { Logo } from "@/components/Logo";
import { ByPadelReserve } from "@/components/Marcas";
import { Hoja } from "@/components/ui/Hoja";
import { StaffChip } from "@/components/StaffGate";
import { ArbitroLogin, useTorneosConArbitros } from "@/components/torneo/Arbitraje";
import { useAhora, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { useArbitro, useArbitroStore } from "@/lib/arbitro";
import { vibrar } from "@/lib/feedback";
import { useFotosTorneo } from "@/lib/fotos";
import { partidosDeTurno, relojClub, turnoActual, turnosDe } from "@/lib/torneo/arbitros";
import { nombreCorto } from "@/lib/torneo/categorias";
import { nombrePista } from "@/lib/torneo/imprevistos";
import { estadoPistas, type EstadoPista } from "@/lib/torneo/programacion";
import { categoria, dupla, nombreDupla } from "@/lib/torneo/torneo";
import { useEsStaff } from "@/lib/store";
import { useTorneos, useTorneo } from "@/lib/torneosStore";
import type { Torneo, TurnoArbitro } from "@/types/torneo";

const PISTA_GUARDADA = "lamarina-arbitro-pista";

/**
 * Panel del árbitro: lo que se ve en la tablet de la esquina de cada pista.
 * Solo su pista y su partido, en una sola pantalla. Sin cuadros, horarios ni ajustes: eso es del staff.
 */
export default function ArbitroPage() {
  const arbitro = useArbitro();
  const esStaff = useEsStaff();
  const hidratado = useTorneos((s) => s.hidratado);
  const enCurso = useTorneosConArbitros();
  const salir = useArbitroStore((s) => s.salir);
  const [elegido, setElegido] = useState<string | null>(null);

  if (arbitro === undefined || esStaff === undefined || !hidratado)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );

  // Árbitro del club o staff: si hay un solo torneo en curso (o uno donde tiene turno hoy), entra directo.
  if (arbitro || esStaff) {
    const hoy = relojClub(Date.now()).fecha;
    const conTurno = arbitro ? enCurso.filter((t) => turnosDe(t, arbitro.id).some((x) => x.fecha === hoy)) : [];
    const id = elegido ?? (conTurno.length === 1 ? conTurno[0].id : enCurso.length === 1 ? enCurso[0].id : null);
    if (id) return <Panel torneoId={id} nombre={arbitro?.nombre ?? "Staff"} arbitroId={arbitro?.id} principal={!!arbitro?.principal} alCambiar={enCurso.length > 1 ? () => setElegido(null) : undefined} />;
  }

  return (
    <main className="min-h-dvh pb-16">
      <div className="sobre-marca relative overflow-hidden bg-marca pb-14 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-marca-2/50 blur-3xl" />
        <header className="relative mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <Link href="/" className="btn-ghost !p-2.5" aria-label="Inicio">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex-1" />
          {arbitro ? (
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => salir()}>
              <LogOut className="size-3.5" /> Salir ({arbitro.nombre.split(" ")[0]})
            </button>
          ) : (
            <>
              <StaffChip />
              <BotonAjustes href="/arbitro/ajustes" titulo="Ajustes de Árbitros" />
            </>
          )}
        </header>
        <div className="relative mx-auto max-w-xl px-6 pt-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-lima text-marino-2">
            <Flag className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">{arbitro ? `Hola, ${arbitro.nombre.split(" ")[0]}` : "Árbitros"}</h1>
          <p className="mt-2 text-white/65">La tablet de la pista. Un toque por punto: el marcador de la pista, los televisores y las estadísticas de los atletas se actualizan al instante.</p>
        </div>
      </div>
      <div className="relative -mt-6 rounded-t-[2rem] bg-fondo px-4 pt-8">
        <div className="mx-auto flex max-w-xl flex-col items-center">
          {arbitro || esStaff ? (
            <div className="w-full space-y-2">
              <p className="label">¿Qué torneo vas a anotar?</p>
              {enCurso.map((t) => (
                <button key={t.id} className="glass w-full rounded-2xl px-5 py-4 text-left hover:border-neon/40" onClick={() => setElegido(t.id)}>
                  <span className="block font-display text-lg font-bold">{t.nombre}</span>
                  {arbitro && turnosDe(t, arbitro.id).length > 0 && <span className="block text-xs text-lima">Tienes {turnosDe(t, arbitro.id).length} turnos en este torneo</span>}
                </button>
              ))}
              {!enCurso.length && <p className="glass rounded-2xl p-5 text-center text-sm text-white/55">No hay torneos en curso. Cuando el staff cree uno, aparece aquí.</p>}
            </div>
          ) : (
            <>
              <ArbitroLogin />
              <p className="mt-6 max-w-sm text-center text-xs text-white/45">El PIN de árbitros te lo da el staff. Te registras una sola vez y sirve para todos los torneos del club.</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-10 flex justify-center">
        <ByPadelReserve />
      </div>
    </main>
  );
}

/**
 * La tablet de la pista: una sola pantalla. Arriba la pista (con su menú para lo que casi no se
 * usa: otra pista, turnos, mesa, TV, salir) y debajo la consola del partido que toca en esa pista,
 * de la previa al envío a mesa. Al terminar uno aparece solo el siguiente, sin navegar.
 */
function Panel({ torneoId, nombre, arbitroId, principal, alCambiar }: { torneoId: string; nombre: string; arbitroId?: string; principal?: boolean; alCambiar?: () => void }) {
  const torneo = useTorneo(torneoId);
  const salir = useArbitroStore((s) => s.salir);
  const ahora = useAhora(1000);
  useMarcadoresEnVivo(torneoId, 4000);
  useFotosTorneo(torneoId);
  const [pista, setPista] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const turno = torneo && !torneo.bloqueado && arbitroId ? turnoActual(torneo, arbitroId, ahora) : null;
  const misTurnos = torneo && !torneo.bloqueado && arbitroId ? turnosDe(torneo, arbitroId) : [];

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(`${PISTA_GUARDADA}:${torneoId}`));
      if (v) setPista(v);
    } catch {
      /* sin almacenamiento */
    }
  }, [torneoId]);
  // Con turno asignado, la tablet se pone sola en la pista que le toca.
  useEffect(() => {
    if (turno) setPista(turno.pista);
  }, [turno?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const elegir = (n: number) => {
    vibrar(8);
    setPista(n);
    setMenu(false);
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
  const p = actual ? (actual.enJuego ?? (actual.suspendida ? null : (actual.llamado ?? actual.siguiente))) : null;

  const boton = (
    <button onClick={() => (vibrar(8), setMenu(true))} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-left transition active:scale-95" aria-label="Pista y opciones">
      <Logo compacto className="size-9" />
      <span>
        <span className="block font-display text-lg font-bold leading-none text-lima">{actual ? nombrePista(torneo, actual.numero) : "Elige pista"}</span>
        <span className="block text-[11px] text-white/50">{nombre.split(" ")[0]} · cambiar</span>
      </span>
      <ChevronDown className="size-4 text-white/50" />
    </button>
  );

  return (
    <main className="mx-auto flex h-dvh max-w-[1600px] flex-col px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3">
      {!actual ? (
        <ElegirPista torneo={torneo} pistas={pistas} turno={turno} onElegir={elegir} />
      ) : p ? (
        <ConsolaPartido key={p.id} torneo={torneo} p={p} pista={actual.numero} izquierda={boton} />
      ) : (
        <div className="flex h-full flex-col gap-2">
          <header className="glass flex min-h-14 items-center gap-2 rounded-2xl px-2 py-1.5">
            {boton}
            <span className="flex-1" />
            <EstadoConexion />
          </header>
          {actual.suspendida ? (
            <Vacio titulo="Pista suspendida" texto={`${actual.suspendida}. El staff avisa cuando se reanuda: el partido vuelve aquí solo, con su marcador.`} icono={<CloudRain className="size-12 text-amber-200" />} />
          ) : (
            <Vacio titulo="Sin partidos por ahora" texto="Cuando haya uno listo para esta pista aparece aquí solo, listo para empezar.">
              <DespuesEnPista torneo={torneo} pista={actual.numero} />
            </Vacio>
          )}
        </div>
      )}

      <Hoja abierta={menu} onClose={() => setMenu(false)} titulo={torneo.nombre} sub={`Árbitro · ${nombre}`}>
        <div className="space-y-4">
          <div>
            <p className="label">Pista de esta tablet</p>
            <div className="grid grid-cols-3 gap-2">
              {pistas.map((e) => (
                <BotonPista key={e.numero} torneo={torneo} e={e} activa={e.numero === pista} mia={misTurnos.some((x) => x.pista === e.numero && x.fecha === relojClub(ahora).fecha)} onClick={() => elegir(e.numero)} />
              ))}
            </div>
          </div>
          {actual && <DespuesEnPista torneo={torneo} pista={actual.numero} excluir={p?.id} />}
          {arbitroId && (
            <div>
              <p className="label">
                {turno ? `Tu turno: ${nombrePista(torneo, turno.pista)} · ${turno.desde}–${turno.hasta}` : misTurnos.length ? "Ahora no tienes turno" : "Sin turnos asignados"}
              </p>
              <MisTurnos torneo={torneo} turnos={misTurnos} ahora={ahora} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {principal && (
              <Link href={`/torneos/${torneo.id}/mesa`} className="btn-neon col-span-2">
                <ClipboardCheck className="size-4" /> Abrir mesa técnica
              </Link>
            )}
            {actual && (
              <Link href={`/torneos/${torneo.id}/pista/${actual.numero}`} className="btn-ghost">
                <Tv className="size-4" /> TV de esta pista
              </Link>
            )}
            <Link href={`/torneos/${torneo.id}/tv`} className="btn-ghost">
              <Tv className="size-4" /> Modo TV
            </Link>
            {alCambiar && (
              <button className="btn-ghost" onClick={alCambiar}>
                Cambiar torneo
              </button>
            )}
            {nombre !== "Staff" && (
              <button className="btn-ghost !text-coral" onClick={() => salir()}>
                <LogOut className="size-4" /> Salir de esta tablet
              </button>
            )}
          </div>
        </div>
      </Hoja>
    </main>
  );
}

function BotonPista({ torneo, e, activa, mia, onClick }: { torneo: Torneo; e: EstadoPista; activa: boolean; mia: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx("relative rounded-2xl border px-4 py-3 text-left transition active:scale-95", activa ? "seleccion sobre-marca" : "border-white/10 hover:border-neon/40")}>
      <span className={clsx("block font-display text-xl font-bold", activa && "text-lima")}>{nombrePista(torneo, e.numero)}</span>
      <span className="block text-xs text-white/50">
        {e.suspendida ? "Suspendida" : e.enJuego ? "En juego" : e.llamado ? "Llamado" : e.siguiente ? `Sigue ${e.siguiente.programacion?.hora ?? ""}` : "Libre"}
        {mia ? " · tu turno" : ""}
      </span>
      {e.enJuego && <span className="absolute right-2 top-2 size-2 animate-pulse rounded-full bg-neon" />}
    </button>
  );
}

/** Primera vez en esta tablet: botones grandes para elegir la pista. Queda guardada. */
function ElegirPista({ torneo, pistas, turno, onElegir }: { torneo: Torneo; pistas: EstadoPista[]; turno: TurnoArbitro | null; onElegir: (n: number) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-4 text-center">
      <Logo compacto className="size-14" />
      <div>
        <h1 className="font-display text-3xl font-bold">¿En qué pista está esta tablet?</h1>
        <p className="mt-1 text-white/55">{torneo.nombre} · queda guardada y se cambia desde el botón de la pista.</p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {pistas.map((e) => (
          <BotonPista key={e.numero} torneo={torneo} e={e} activa={turno?.pista === e.numero} mia={turno?.pista === e.numero} onClick={() => onElegir(e.numero)} />
        ))}
      </div>
    </div>
  );
}

function MisTurnos({ torneo, turnos, ahora }: { torneo: Torneo; turnos: TurnoArbitro[]; ahora: number }) {
  if (!turnos.length) return <p className="py-6 text-center text-sm text-white/55">Todavía no tienes turnos. El staff los asigna en el torneo → Árbitros.</p>;
  const total = turnos.reduce((s, x) => s + partidosDeTurno(torneo, x).length, 0);
  const { fecha, hora } = relojClub(ahora);
  return (
    <div className="space-y-2">
      <p className="text-sm text-white/60">
        Te tocan <b className="text-white">{turnos.length} turnos</b> con <b className="text-white">{total} partidos</b> programados.
      </p>
      {turnos.map((x) => {
        const ps = partidosDeTurno(torneo, x);
        const paso = x.fecha < fecha || (x.fecha === fecha && x.hasta <= hora);
        const ahoraSi = x.fecha === fecha && x.desde <= hora && hora < x.hasta;
        return (
          <div key={x.id} className={clsx("flex items-center gap-3 rounded-2xl border px-4 py-3", ahoraSi ? "seleccion sobre-marca" : "border-white/10", paso && "opacity-50")}>
            <div className="w-24 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{new Date(`${x.fecha}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}</p>
              <p className="font-display font-bold tabular">
                {x.desde}–{x.hasta}
              </p>
            </div>
            <p className="min-w-0 flex-1 font-semibold">{nombrePista(torneo, x.pista)}</p>
            <span className="chip shrink-0">{ps.length} partidos</span>
          </div>
        );
      })}
    </div>
  );
}

/** Lo que viene en esta pista según la programación, para que el árbitro sepa a quién esperar. */
function DespuesEnPista({ torneo, pista, excluir }: { torneo: Torneo; pista: number; excluir?: string }) {
  const proximos = torneo.categorias
    .flatMap((c) => c.cuadro?.partidos ?? [])
    .filter((p) => p.id !== excluir && p.estado === "PENDIENTE" && p.programacion?.pista === pista)
    .sort((a, b) => `${a.programacion!.fecha} ${a.programacion!.hora}`.localeCompare(`${b.programacion!.fecha} ${b.programacion!.hora}`))
    .slice(0, 3);
  if (!proximos.length) return null;
  return (
    <div className="mt-4 w-full max-w-xl text-left">
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
