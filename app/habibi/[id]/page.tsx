"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Eye, LayoutGrid, ListOrdered, LockKeyhole, RotateCcw, Swords, Trash2, Tv, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Llave, PodioHabibi, TablaGrupo } from "@/components/habibi/piezas";
import { EstadoBadge } from "@/components/EventoCard";
import { Logo } from "@/components/Logo";
import { LogoMenu } from "@/components/LogoMenu";
import { ModoBadge } from "@/components/ModoBadge";
import { QRBoton } from "@/components/QRPopup";
import { ScoreModal } from "@/components/ScoreModal";
import { StaffChip } from "@/components/StaffGate";
import { Segmented } from "@/components/ui/Segmented";
import { Confetti } from "@/components/ui/Confetti";
import { toast } from "@/components/ui/Toaster";
import { categoriaLabel } from "@/lib/categories";
import { eliminarEvento, progresoEvento } from "@/lib/evento";
import { sonar, vibrar } from "@/lib/feedback";
import {
  armarLlave,
  bloqueoArmar,
  borrarResultadoLlave,
  cargarResultadoLlave,
  CLASIFICAN,
  configRonda,
  CORTO_FASE,
  desarmarLlave,
  infoLlave,
  NOMBRE_FASE,
  pendientesGrupos,
  podio,
  type CruceLlave,
} from "@/lib/habibi";
import { nombrePista } from "@/lib/horarios";
import { descripcionPuntuacion } from "@/lib/scoring";
import { useAmericanos, useEsStaff, useEvento } from "@/lib/store";
import type { EventoAmericano, Partido } from "@/types/americano";

export default function HabibiPage() {
  const { id } = useParams<{ id: string }>();
  const llave = useEvento(id);
  const hidratado = useAmericanos((s) => s.hidratado);
  const ultimoSync = useAmericanos((s) => s.ultimoSync);
  if (!llave || !infoLlave(llave))
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        {!hidratado || !ultimoSync ? (
          <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
        ) : (
          <>
            <p className="font-display text-2xl font-bold">Torneo no encontrado</p>
            <Link href="/habibi" className="btn-neon">
              Volver
            </Link>
          </>
        )}
      </main>
    );
  return <Torneo llave={llave} />;
}

function Torneo({ llave }: { llave: EventoAmericano }) {
  const info = infoLlave(llave)!;
  const eventos = useAmericanos((s) => s.eventos);
  const actualizar = useAmericanos((s) => s.actualizar);
  const guardar = useAmericanos((s) => s.guardar);
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const router = useRouter();
  const grupos = info.grupos.map((g) => eventos[g.eventoId]).filter((g): g is EventoAmericano => !!g && !g.eliminado);
  const armada = !!info.armadaEn;
  const [vista, setVista] = useState<"GRUPOS" | "LLAVE">(armada ? "LLAVE" : "GRUPOS");
  const [abierto, setAbierto] = useState<CruceLlave | null>(null);
  const terminado = llave.estado === "FINALIZADO";
  const campeon = podio(llave)[0];

  // Cuando se arma la llave (aquí o en otro dispositivo) se pasa a verla.
  useEffect(() => {
    if (armada) setVista("LLAVE");
  }, [armada]);

  const pendientes = pendientesGrupos(grupos);
  const bloqueo = bloqueoArmar(llave, grupos);
  const cargadosLlave = llave.rondas.flatMap((r) => r.partidos).filter((p) => p.resultado).length;
  const rondaAbierta = abierto ? llave.rondas.find((r) => r.fase === abierto.fase) : undefined;
  const partidoAbierto: Partido | null = abierto
    ? (llave.rondas.flatMap((r) => r.partidos).find((p) => p.id === abierto.id) ??
      (abierto.parejaA && abierto.parejaB
        ? { id: abierto.id, rondaNumero: rondaAbierta?.numero ?? 1, pista: llave.canchas?.[0]?.numero ?? 1, parejaA: abierto.parejaA, parejaB: abierto.parejaB, estado: "PENDIENTE", resultado: null }
        : null))
    : null;
  const faseActual = llave.rondas.find((r) => r.numero === llave.rondaActual)?.fase;

  function armar() {
    if (bloqueo) return toast(bloqueo, "error");
    if (pendientes > 0 && !confirm(`Faltan ${pendientes} partido(s) de grupos sin resultado. ¿Armar la llave con las posiciones de ahora?`)) return;
    if (cargadosLlave > 0 && prompt(`La llave ya tiene ${cargadosLlave} resultado(s) y se borrarán. Escribe REHACER para confirmar.`) !== "REHACER") return;
    actualizar(llave.id, (e) => armarLlave(e, grupos));
    sonar("ok");
    vibrar([20, 40, 60]);
    toast("¡Llave armada! Que empiecen los cruces 🔥");
    setVista("LLAVE");
  }

  function volverAGrupos() {
    if (cargadosLlave > 0 && prompt(`Se borrarán ${cargadosLlave} resultado(s) de la llave. Escribe REHACER para confirmar.`) !== "REHACER") return;
    if (!cargadosLlave && !confirm("¿Deshacer la llave y volver a la fase de grupos?")) return;
    actualizar(llave.id, desarmarLlave);
    setVista("GRUPOS");
    toast("Volviste a la fase de grupos", "info");
  }

  function eliminar() {
    if (!confirm(`¿Eliminar "${llave.nombre}" con sus grupos? Se borra en todos los dispositivos.`)) return;
    if (prompt("Escribe ELIMINAR para confirmar") !== "ELIMINAR") return;
    for (const g of grupos) guardar(eliminarEvento(g));
    guardar(eliminarEvento(llave));
    toast("Torneo eliminado", "info");
    router.push("/habibi");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <Confetti activo={terminado} piezas={90} />
      <header className="flex items-center gap-3 py-3">
        <Link href="/habibi" className="btn-ghost !p-2.5" aria-label="Americano HABIBI">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{llave.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <EstadoBadge estado={terminado ? "FINALIZADO" : armada || grupos.some((g) => g.estado !== "BORRADOR") ? "EN_CURSO" : "BORRADOR"} />
            <span className="hidden text-xs text-white/50 sm:inline">{categoriaLabel(llave.categoria)}</span>
          </div>
        </div>
        <ModoBadge />
        <StaffChip />
        <LogoMenu />
      </header>

      {/* Dónde va el torneo */}
      <div className="glass mt-2 flex flex-wrap items-center gap-3 rounded-3xl p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lima text-marino-2">
          <Swords className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{terminado ? "Torneo terminado" : armada ? "Llave eliminatoria" : "Fase de grupos"}</p>
          <p className="font-display text-xl font-bold">
            {terminado && campeon
              ? `Campeones: ${campeon.pareja.jugadorIds.map((id) => llave.jugadores.find((j) => j.id === id)?.nombre).join(" / ")}`
              : armada
                ? NOMBRE_FASE[faseActual ?? "FINAL"]
                : pendientes > 0
                  ? `Faltan ${pendientes} partido${pendientes === 1 ? "" : "s"} de grupos`
                  : "Grupos terminados: ¡a armar la llave!"}
          </p>
        </div>
        {esStaff && !armada && (
          <button className={clsx("btn-neon", pendientes === 0 && !bloqueo && "animate-pulse-neon")} onClick={armar}>
            <Swords className="size-4" /> Armar la llave
          </button>
        )}
      </div>

      <Segmented
        className="mt-4"
        opciones={[
          { id: "GRUPOS", label: "Grupos" },
          { id: "LLAVE", label: armada ? "Llave" : "Llave (vista previa)" },
        ]}
        valor={vista}
        onChange={setVista}
      />

      {vista === "GRUPOS" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {grupos.map((g) => {
            const letra = g.habibi?.rol === "GRUPO" ? g.habibi.letra : "?";
            const prog = progresoEvento(g);
            return (
              <section key={g.id} className="glass rounded-3xl p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-marca font-display text-2xl font-bold text-blanco">{letra}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold">Grupo {letra}</p>
                    <p className="text-xs text-white/50">
                      {g.modalidad === "DUPLA_FIJA" ? `${g.parejas.filter((p) => !p.retirada).length} duplas` : `${g.jugadores.filter((j) => !j.retirado).length} jugadores · individual`} · {g.estado === "FINALIZADO" ? "terminado" : `ronda ${Math.min(g.rondaActual, g.totalRondas)} de ${g.totalRondas}`} · {prog.jugados}/{prog.total} partidos
                    </p>
                  </div>
                  <EstadoBadge estado={g.estado} />
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div className="h-full rounded-full bg-neon" animate={{ width: `${prog.pct}%` }} />
                </div>
                <TablaGrupo grupo={g} inicio={info.inicio} emparejar={info.emparejar} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href={`/evento/${g.id}`} className="btn-ghost text-sm">
                    <LayoutGrid className="size-4" /> {esStaff ? "Cuadro y marcadores" : "Cuadro vivo"}
                  </Link>
                  <Link href={`/evento/${g.id}/tabla`} className="btn-ghost text-sm">
                    <ListOrdered className="size-4" /> Ranking
                  </Link>
                </div>
              </section>
            );
          })}
          <p className="text-xs text-white/45 lg:col-span-2">
            {info.emparejar
              ? `Pasan ${CLASIFICAN[info.inicio]} duplas por grupo, armadas con el ranking individual (${info.emparejar === "POR_ORDEN" ? "1º con 2º, 3º con 4º…" : "1º con el último que pasa, 2º con el penúltimo…"}${llave.categoria.rama === "MIXTO" ? ", siempre hombre + mujer" : ""}). Los que pasan van en verde.`
              : `Pasan ${CLASIFICAN[info.inicio]} duplas por grupo (en verde).`}{" "}
            Grupos: {descripcionPuntuacion(grupos[0]?.puntuacion ?? llave.puntuacion)}.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          {terminado && <PodioHabibi llave={llave} className="mb-6" />}
          {!armada && (
            <p className="mb-4 rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-white/55">
              Así se cruzan cuando terminen los grupos. Las duplas aparecen cuando el staff arma la llave.
            </p>
          )}
          <Llave
            llave={llave}
            onPartido={
              armada
                ? (c) => {
                    vibrar(10);
                    if (!esStaff) {
                      toast("Solo el staff carga marcadores", "info", { label: "Soy staff", fn: () => setPedirLogin(true) });
                      return;
                    }
                    setAbierto(c);
                  }
                : undefined
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
            {llave.rondas.map((r) => (
              <span key={r.numero}>
                {CORTO_FASE[r.fase!]}: {descripcionPuntuacion(configRonda(llave, r))}
              </span>
            ))}
          </div>
          {esStaff && armada && <p className="mt-2 text-xs text-white/45">Toca un cruce para cargar el marcador: el ganador pasa solo a la siguiente ronda.</p>}
        </div>
      )}

      {esStaff === false && (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <span className="chip">
            <Eye className="size-3" /> Modo espectador
          </span>
          <button className="btn-ghost text-xs" onClick={() => setPedirLogin(true)}>
            <LockKeyhole className="size-3.5" /> Soy staff
          </button>
        </div>
      )}

      {esStaff && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {armada && (
            <>
              <button className="btn-ghost text-xs" onClick={armar} title="Vuelve a cruzar con las posiciones actuales de los grupos">
                <RotateCcw className="size-3.5" /> Rehacer la llave
              </button>
              <button className="btn-ghost text-xs" onClick={volverAGrupos}>
                <Undo2 className="size-3.5" /> Volver a grupos
              </button>
            </>
          )}
          <button className="btn-ghost ml-auto text-xs text-coral" onClick={eliminar}>
            <Trash2 className="size-3.5" /> Eliminar torneo
          </button>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass-strong flex gap-1 rounded-2xl p-1.5 shadow-2xl">
          {grupos.map((g) => (
            <Link key={g.id} href={`/evento/${g.id}`} className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white">
              Grupo {g.habibi?.rol === "GRUPO" ? g.habibi.letra : ""} <ChevronRight className="size-3.5" />
            </Link>
          ))}
          <Link href={`/habibi/${llave.id}/tv`} className="flex items-center gap-1.5 rounded-xl bg-neon px-3 py-2.5 text-sm font-semibold text-noche">
            <Tv className="size-4" /> TV
          </Link>
          <QRBoton evento={llave} ruta={`/habibi/${llave.id}`} className="flex items-center rounded-xl px-3 py-2.5 text-white/60 transition hover:text-white" />
        </div>
      </nav>

      <ScoreModal
        partido={partidoAbierto}
        config={configRonda(llave, rondaAbierta)}
        nombrePista={partidoAbierto ? nombrePista(llave, partidoAbierto.pista) : ""}
        titulo={abierto ? (abierto.fase === "FINAL" || abierto.fase === "TERCER_PUESTO" ? NOMBRE_FASE[abierto.fase] : `${CORTO_FASE[abierto.fase]} ${abierto.indice + 1}`) : undefined}
        jugadores={llave.jugadores}
        sinEmpate
        onClose={() => setAbierto(null)}
        onGuardar={(r) => {
          if (!partidoAbierto) return;
          const p = partidoAbierto;
          const previo = p.resultado;
          actualizar(llave.id, (e) => cargarResultadoLlave(e, p.id, r));
          toast(previo ? "Marcador corregido" : "Resultado guardado: el ganador avanza", "ok", {
            label: "Deshacer",
            fn: () => actualizar(llave.id, (e) => (previo ? cargarResultadoLlave(e, p.id, previo) : borrarResultadoLlave(e, p.id))),
          });
          setAbierto(null);
        }}
        onBorrar={() => {
          if (!partidoAbierto) return;
          const p = partidoAbierto;
          if (!confirm("¿Borrar este resultado? Si el ganador ya jugó la ronda siguiente, ese partido también se borra.")) return;
          actualizar(llave.id, (e) => borrarResultadoLlave(e, p.id));
          toast("Resultado borrado", "info");
          setAbierto(null);
        }}
      />
    </div>
  );
}
