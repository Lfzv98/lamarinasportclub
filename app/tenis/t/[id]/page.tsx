"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Flag, Megaphone, MonitorPlay, Pencil, RotateCcw, Shuffle, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { StaffChip } from "@/components/StaffGate";
import { toast } from "@/components/ui/Toaster";
import { MarcadorTenis, nombreCompacto, textoResultado } from "@/components/tenis/Marcador";
import { ChipSuperficie, EstadoTenisBadge, FondoSuperficie, PelotaTenis, fechaTenis, slugDe, temaSuperficie } from "@/components/tenis/piezas";
import { esArbitroDe, useArbitro } from "@/lib/arbitro";
import { useEsStaff } from "@/lib/store";
import { useTenis, useTorneoTenis } from "@/lib/tenisStore";
import { campeon, cerrarPartido, formatoNombre, jugable, nombreInscrito, nombreRonda, progreso, RAMAS, reabrirPartido, rondasDe, sortear, SUPERFICIES, tablaLiga } from "@/lib/tenis/torneo";
import type { PartidoTenis, TorneoTenis } from "@/types/tenis";

export default function TorneoTenisPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTorneoTenis(id);
  const hidratado = useTenis((s) => s.hidratado);
  const esStaff = useEsStaff();
  const arbitro = useArbitro();
  const puedeAnotar = !!esStaff || esArbitroDe(arbitro);
  const [vista, setVista] = useState<"cuadro" | "partidos" | "inscritos">("cuadro");
  const [abierto, setAbierto] = useState<PartidoTenis | null>(null);
  const router = useRouter();
  const guardar = useTenis((s) => s.guardar);

  if (!t)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        {hidratado ? (
          <>
            <PelotaTenis className="size-12" />
            <p className="text-white/60">No encontramos este torneo de tenis.</p>
            <Link href="/tenis" className="btn-ghost">
              Volver a Tenis
            </Link>
          </>
        ) : (
          <PelotaTenis className="size-12" girando />
        )}
      </main>
    );

  const d = SUPERFICIES[t.superficie];
  const prog = progreso(t);
  const rey = campeon(t);
  const nadieJugo = !t.partidos.some((p) => p.marcador || (p.resultado && p.resultado.tipo !== "BYE"));
  const pestanas = [
    { id: "cuadro" as const, label: t.formato === "LIGA" ? "Tabla" : t.formato === "PARTIDO" ? "Partido" : "Cuadro" },
    { id: "partidos" as const, label: "Partidos" },
    { id: "inscritos" as const, label: t.modalidad === "SINGLES" ? "Jugadores" : "Parejas" },
  ];

  return (
    <main className="pb-24" style={temaSuperficie(t.superficie)}>
      <FondoSuperficie superficie={t.superficie} className="pb-12 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="relative mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link href={`/tenis/${slugDe(t.superficie)}`} className="btn-ghost !p-2.5" aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex-1" />
          <Link href={`/tenis/t/${t.id}/tv`} className="btn-ghost !px-3 !py-2.5" title="Modo TV">
            <MonitorPlay className="size-4" /> <span className="hidden sm:inline">Modo TV</span>
          </Link>
          <StaffChip />
          <Logo compacto />
        </header>
        <div className="relative mx-auto max-w-6xl px-4 pt-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoTenisBadge estado={t.estado} />
            <ChipSuperficie superficie={t.superficie} className="!bg-white/15 !bg-none" />
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">{t.nombre}</h1>
          <p className="mt-2 text-white/70">
            {t.modalidad === "SINGLES" ? "Singles" : "Dobles"} {RAMAS[t.rama].toLowerCase()} · {t.categoria} · {formatoNombre(t)}
            {!t.reglas.ventaja && " sin ventaja"} · {fechaTenis(t.fecha)}
          </p>
          {rey && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3">
              <span className="text-3xl">🏆</span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-white/60">{t.formato === "PARTIDO" ? "Ganó" : "Campeón"}</span>
                <span className="font-display text-xl font-bold">{nombreInscrito(t, rey)}</span>
              </span>
            </motion.div>
          )}
          {prog.total > 1 && !rey && (
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-xs text-white/70">
                <span>{prog.jugados} de {prog.total} partidos</span>
                {prog.enJuego > 0 && <span>{prog.enJuego} en cancha</span>}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25">
                <motion.div className="h-full rounded-full bg-blanco" initial={{ width: 0 }} animate={{ width: `${prog.total ? (prog.jugados / prog.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </FondoSuperficie>

      <div className="relative -mt-6 rounded-t-[2rem] bg-fondo">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <div className="glass flex rounded-2xl p-1">
            {pestanas.map((p) => (
              <button
                key={p.id}
                onClick={() => setVista(p.id)}
                className={clsx("relative flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition", vista === p.id ? "text-blanco" : "text-white/60")}
              >
                {vista === p.id && <motion.span layoutId="pestana-tenis" className="absolute inset-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${d.color}, ${d.oscuro})` }} />}
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            {vista === "cuadro" &&
              (t.formato === "LIGA" ? (
                <TablaLiga torneo={t} />
              ) : t.formato === "PARTIDO" ? (
                <div className="mx-auto max-w-xl">
                  <TarjetaPartido torneo={t} partido={t.partidos[0]} onAbrir={setAbierto} grande />
                </div>
              ) : (
                <Cuadro torneo={t} onAbrir={setAbierto} />
              ))}
            {vista === "partidos" && <ListaPartidos torneo={t} onAbrir={setAbierto} />}
            {vista === "inscritos" && <Inscritos torneo={t} />}
          </div>

          {esStaff && (
            <section className="mt-12 flex flex-wrap gap-2 border-t border-white/10 pt-6">
              {nadieJugo && t.formato !== "PARTIDO" && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    guardar(sortear(t, Date.now()));
                    toast("Nuevo sorteo hecho");
                  }}
                >
                  <Shuffle className="size-4" /> Volver a sortear
                </button>
              )}
              <button
                className="btn-ghost text-coral"
                onClick={() => {
                  if (!confirm(`¿Borrar "${t.nombre}"? Se borra en todos los dispositivos.`)) return;
                  if (prog.jugados > 0 && !confirm("Ya hay partidos jugados. ¿Seguro?")) return;
                  guardar({ ...t, eliminado: true, actualizadoEn: new Date().toISOString() });
                  router.push(`/tenis/${slugDe(t.superficie)}`);
                }}
              >
                <Trash2 className="size-4" /> Borrar
              </button>
            </section>
          )}
        </div>
      </div>

      <AnimatePresence>{abierto && <HojaPartido torneo={t} partidoId={abierto.id} puedeAnotar={puedeAnotar} esStaff={!!esStaff} onCerrar={() => setAbierto(null)} />}</AnimatePresence>
    </main>
  );
}

/* ---------- Cuadro de eliminación ---------- */

function Cuadro({ torneo: t, onAbrir }: { torneo: TorneoTenis; onAbrir: (p: PartidoTenis) => void }) {
  const rondas = rondasDe(t);
  const primera = t.partidos.filter((p) => p.ronda === 1).length;
  const alto = Math.max(primera, 1) * 132;
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-4">
      <div className="flex gap-4" style={{ minHeight: alto }}>
        {Array.from({ length: rondas }, (_, i) => i + 1).map((r) => (
          <div key={r} className="flex w-60 shrink-0 flex-col">
            <p className="label text-center">{nombreRonda(r, rondas)}</p>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {t.partidos
                .filter((p) => p.ronda === r)
                .sort((a, b) => a.orden - b.orden)
                .map((p) => (
                  <TarjetaPartido key={p.id} torneo={t} partido={p} onAbrir={onAbrir} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TarjetaPartido({ torneo: t, partido: p, onAbrir, grande = false }: { torneo: TorneoTenis; partido: PartidoTenis; onAbrir: (p: PartidoTenis) => void; grande?: boolean }) {
  const bye = p.resultado?.tipo === "BYE";
  const vivo = p.estado === "EN_JUEGO";
  if (bye)
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-white/40">
        <span className="font-semibold text-white/70">{nombreInscrito(t, p.a ?? p.b, t.modalidad === "DOBLES")}</span> pasa directo
      </div>
    );
  return (
    <button
      onClick={() => onAbrir(p)}
      className={clsx("glass w-full rounded-2xl px-3 py-2 text-left transition hover:border-[var(--sup-claro)] active:scale-[0.99]", vivo && "!border-[var(--sup-claro)] ring-1 ring-[var(--sup)]", grande && "!p-5")}
    >
      <div className="flex items-center justify-between text-[11px] text-white/45">
        <span>{p.cancha ? `Cancha ${p.cancha}` : t.formato === "LIGA" ? `Jornada ${p.ronda}` : ""}</span>
        {vivo ? (
          <span className="flex items-center gap-1 font-semibold text-neon">
            <span className="size-1.5 animate-pulse rounded-full bg-neon" /> En vivo
          </span>
        ) : p.estado === "LLAMADO" ? (
          <span className="font-semibold text-amber-200">Llamado</span>
        ) : p.resultado ? (
          <span>{p.resultado.tipo === "WO" ? "W.O." : p.resultado.tipo === "RETIRO" ? "Retiro" : "Final"}</span>
        ) : null}
      </div>
      {p.marcador || p.resultado ? (
        <MarcadorTenis torneo={t} partido={p} compacto={!grande} className={grande ? "" : "[&_.font-display]:!text-sm"} />
      ) : (
        <div className="py-1">
          <p className={clsx("truncate py-1 text-sm font-semibold", !p.a && "text-white/35")}>{grande ? nombreInscrito(t, p.a) : nombreCompacto(t, p.a)}</p>
          <div className="h-px bg-white/10" />
          <p className={clsx("truncate py-1 text-sm font-semibold", !p.b && "text-white/35")}>{grande ? nombreInscrito(t, p.b) : nombreCompacto(t, p.b)}</p>
        </div>
      )}
    </button>
  );
}

/* ---------- Liga ---------- */

function TablaLiga({ torneo: t }: { torneo: TorneoTenis }) {
  const filas = tablaLiga(t);
  return (
    <div className="glass overflow-hidden rounded-3xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-white/45">
            <th className="px-3 py-3 text-left">#</th>
            <th className="py-3 text-left">{t.modalidad === "SINGLES" ? "Jugador" : "Pareja"}</th>
            <th className="px-2 py-3">PJ</th>
            <th className="px-2 py-3">PG</th>
            <th className="hidden px-2 py-3 sm:table-cell">Sets</th>
            <th className="px-2 py-3">+/− juegos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <motion.tr layout key={f.id} className="border-t border-white/5">
              <td className="px-3 py-3 font-display font-bold" style={i === 0 && f.pj ? { color: "var(--sup-claro)" } : undefined}>
                {i + 1}
              </td>
              <td className="py-3 font-semibold">
                <span className="flex items-center gap-2">
                  <Avatar nombre={nombreInscrito(t, f.id)} size={28} />
                  <span className="truncate">{nombreInscrito(t, f.id, t.modalidad === "DOBLES")}</span>
                </span>
              </td>
              <td className="px-2 py-3 text-center tabular">{f.pj}</td>
              <td className="px-2 py-3 text-center font-bold tabular">{f.pg}</td>
              <td className="hidden px-2 py-3 text-center tabular sm:table-cell">
                {f.setsF}-{f.setsC}
              </td>
              <td className="px-2 py-3 text-center tabular">{f.juegosF - f.juegosC > 0 ? `+${f.juegosF - f.juegosC}` : f.juegosF - f.juegosC}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/5 px-4 py-3 text-xs text-white/45">Orden: partidos ganados; si empatan dos, el partido entre ellos; luego diferencia de sets y de juegos.</p>
    </div>
  );
}

function ListaPartidos({ torneo: t, onAbrir }: { torneo: TorneoTenis; onAbrir: (p: PartidoTenis) => void }) {
  const grupos = [
    { t: "En cancha", ps: t.partidos.filter((p) => p.estado === "EN_JUEGO" || p.estado === "LLAMADO") },
    { t: "Por jugar", ps: t.partidos.filter((p) => jugable(p) && p.estado === "PENDIENTE") },
    { t: "Terminados", ps: t.partidos.filter((p) => p.resultado && p.resultado.tipo !== "BYE").reverse() },
  ];
  return (
    <div className="space-y-8">
      {grupos.map(
        (g) =>
          g.ps.length > 0 && (
            <section key={g.t}>
              <h2 className="mb-3 font-display text-lg font-semibold">{g.t}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.ps.map((p) => (
                  <TarjetaPartido key={p.id} torneo={t} partido={p} onAbrir={onAbrir} />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}

function Inscritos({ torneo: t }: { torneo: TorneoTenis }) {
  const orden = [...t.inscritos].sort((a, b) => (a.siembra ?? 99) - (b.siembra ?? 99));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {orden.map((i) => (
        <div key={i.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <span className="flex -space-x-2">
            {i.jugadores.map((j) => (
              <Avatar key={j.id} nombre={j.nombre} fotoUrl={j.fotoUrl} size={36} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{i.jugadores.map((j) => j.nombre).join(" / ")}</span>
          {i.siembra ? (
            <span className="chip !border-transparent font-bold !text-blanco" style={{ background: "var(--sup)" }}>
              [{i.siembra}]
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- Hoja de un partido (acciones) ---------- */

function HojaPartido({ torneo: t, partidoId, puedeAnotar, esStaff, onCerrar }: { torneo: TorneoTenis; partidoId: string; puedeAnotar: boolean; esStaff: boolean; onCerrar: () => void }) {
  const guardar = useTenis((s) => s.guardar);
  const p = t.partidos.find((x) => x.id === partidoId);
  const [cancha, setCancha] = useState<number | null>(p?.cancha ?? null);
  if (!p) return null;
  const listo = jugable(p);
  const ocupadas = new Set(t.partidos.filter((x) => x.id !== p.id && x.cancha && (x.estado === "EN_JUEGO" || x.estado === "LLAMADO")).map((x) => x.cancha));
  const nombre = (iid: string | null) => nombreInscrito(t, iid);
  const llamar = () => {
    guardar({ ...t, partidos: t.partidos.map((x) => (x.id === p.id ? { ...x, cancha, estado: x.estado === "PENDIENTE" ? "LLAMADO" : x.estado, actualizadoEn: new Date().toISOString() } : x)), actualizadoEn: new Date().toISOString() });
    toast(cancha ? `Llamado a la cancha ${cancha}` : "Partido llamado");
  };
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar}>
      <motion.div
        className="glass-strong max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[2rem]"
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        onClick={(e) => e.stopPropagation()}
        style={temaSuperficie(t.superficie)}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label">{t.formato === "ELIMINACION" ? nombreRonda(p.ronda, rondasDe(t)) : t.formato === "LIGA" ? `Jornada ${p.ronda}` : "Partido"}</p>
          <button className="btn-ghost !p-2" onClick={onCerrar} aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        {p.marcador || p.resultado ? (
          <MarcadorTenis torneo={t} partido={p} />
        ) : (
          <p className="font-display text-xl font-bold">
            {nombre(p.a)} <span className="text-white/40">vs</span> {nombre(p.b)}
          </p>
        )}
        {p.resultado && p.resultado.tipo !== "NORMAL" && <p className="mt-2 text-sm text-white/60">{textoResultado(t, p)}</p>}

        <div className="mt-5 grid gap-2">
          <Link href={`/tenis/t/${t.id}/p/${p.id}`} className="btn-ghost">
            Ver partido y estadísticas
          </Link>
          {puedeAnotar && listo && (
            <>
              {p.estado !== "EN_JUEGO" && (
                <div className="glass rounded-2xl p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Cancha</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: t.canchas }, (_, i) => i + 1).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCancha(c)}
                        disabled={ocupadas.has(c)}
                        className={clsx("size-11 rounded-xl border font-display font-bold transition disabled:opacity-25", cancha === c ? "border-transparent text-blanco" : "border-white/15")}
                        style={cancha === c ? { background: "var(--sup)" } : undefined}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <button className="btn-ghost mt-3 w-full" onClick={llamar}>
                    <Megaphone className="size-4" /> {p.estado === "LLAMADO" ? "Cambiar cancha" : "Llamar a la cancha"}
                  </button>
                </div>
              )}
              <Link
                href={`/tenis/t/${t.id}/p/${p.id}/anotar`}
                className="btn text-base font-bold text-blanco"
                style={{ background: "linear-gradient(135deg, var(--sup), var(--sup-oscuro))" }}
                onClick={() => {
                  if (cancha && cancha !== p.cancha) guardar({ ...t, partidos: t.partidos.map((x) => (x.id === p.id ? { ...x, cancha, actualizadoEn: new Date().toISOString() } : x)) });
                }}
              >
                <Pencil className="size-4" /> {p.marcador ? "Seguir anotando" : "Anotar el partido"}
              </Link>
            </>
          )}
          {esStaff && listo && (
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((g) => (
                <button
                  key={g}
                  className="btn-ghost !px-3 text-xs"
                  onClick={() => {
                    const tipo = p.marcador ? "RETIRO" : "WO";
                    if (!confirm(`¿${tipo === "WO" ? "W.O." : "Retiro"}: gana ${nombre(g === 0 ? p.a : p.b)}?`)) return;
                    guardar(cerrarPartido(t, p.id, g, tipo));
                    onCerrar();
                  }}
                >
                  <Flag className="size-3.5" /> {p.marcador ? "Retiro" : "W.O."}: gana {nombreInscrito(t, g === 0 ? p.a : p.b, true)}
                </button>
              ))}
            </div>
          )}
          {esStaff && p.resultado && (p.resultado.tipo === "WO" || p.resultado.tipo === "RETIRO") && (
            <button
              className="btn-ghost"
              onClick={() => {
                guardar(reabrirPartido(t, p.id));
                onCerrar();
              }}
            >
              <RotateCcw className="size-4" /> Deshacer {p.resultado.tipo === "WO" ? "W.O." : "retiro"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
