"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Eye, Pencil } from "lucide-react";
import { Logo } from "@/components/Logo";
import { MarcadorTenis, textoResultado, useVistaPartido } from "@/components/tenis/Marcador";
import { Cancha, ChipSuperficie, FondoSuperficie, PelotaTenis, temaSuperficie } from "@/components/tenis/piezas";
import { esArbitroDe, useArbitro } from "@/lib/arbitro";
import { useEsStaff } from "@/lib/store";
import { usePartidoTenis, useTenis, useTenisEnVivo } from "@/lib/tenisStore";
import { analizar, type Analisis } from "@/lib/tenis/marcador";
import { idsDe, inscrito, nombreInscrito, nombreRonda, rondasDe, SUPERFICIES } from "@/lib/tenis/torneo";
import type { PartidoTenis, TorneoTenis } from "@/types/tenis";

/** El partido para el público: marcador vivo, la cancha, estadísticas y gráfico de impulso. */
export default function PartidoTenisPage() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const { torneo: t, partido: p } = usePartidoTenis(id, pid);
  const hidratado = useTenis((s) => s.hidratado);
  const esStaff = useEsStaff();
  const arbitro = useArbitro();
  useTenisEnVivo(p?.estado === "EN_JUEGO" ? 2500 : 8000);
  const v = useVistaPartido(t, p);
  const analisis = useMemo(() => (t && p?.marcador ? analizar(p.marcador, t.reglas, idsDe(t, p.a)) : null), [t, p]);

  if (!t || !p || !v)
    return <main className="flex min-h-dvh items-center justify-center">{hidratado ? <p className="text-white/60">Partido no encontrado.</p> : <PelotaTenis className="size-12" girando />}</main>;

  const d = SUPERFICIES[t.superficie];
  const e = v.e;
  const ins = [inscrito(t, p.a), inscrito(t, p.b)];
  const terminado = !!p.resultado;
  const duracion = p.marcador ? Math.round(((p.marcador.fin ? new Date(p.marcador.fin).getTime() : Date.now()) - new Date(p.marcador.inicio).getTime()) / 60000) : 0;
  const izquierdaEsA = e ? e.ladoA === "IZQ" : true;
  const lado = (l: 0 | 1) => ins[l]?.jugadores.map((j) => ({ nombre: j.nombre, equipo: l })) ?? [];
  const sacadorId = e && p.marcador ? p.marcador.ordenSaque[e.turnoSaque] : null;

  return (
    <main className="pb-20" style={temaSuperficie(t.superficie)}>
      <FondoSuperficie superficie={t.superficie} className="pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="relative mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link href={`/tenis/t/${t.id}`} className="btn-ghost !p-2.5" aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm text-white/70">
            {t.nombre} · {t.formato === "ELIMINACION" ? nombreRonda(p.ronda, rondasDe(t)) : t.formato === "LIGA" ? `Jornada ${p.ronda}` : "Partido"}
          </p>
          {(esStaff || esArbitroDe(arbitro)) && p.a && p.b && !terminado && (
            <Link href={`/tenis/t/${t.id}/p/${p.id}/anotar`} className="btn-ghost !px-3 !py-2.5">
              <Pencil className="size-4" /> Anotar
            </Link>
          )}
          <Logo compacto />
        </header>
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {p.estado === "EN_JUEGO" ? (
              <span className="chip border-white/30 bg-white/15 font-semibold text-white">
                <span className="size-2 animate-pulse rounded-full bg-[#dcf03c]" /> En vivo
              </span>
            ) : terminado ? (
              <span className="chip border-white/20 text-white/80">Final · {textoResultado(t, p)}</span>
            ) : (
              <span className="chip border-white/20 text-white/80">{p.estado === "LLAMADO" ? "Llamado a la cancha" : "Por jugar"}</span>
            )}
            {p.cancha && <span className="chip border-white/20 text-white/80">Cancha {p.cancha}</span>}
            {duracion > 0 && (
              <span className="chip border-white/20 text-white/80">
                <Clock className="size-3" /> {Math.floor(duracion / 60) ? `${Math.floor(duracion / 60)} h ` : ""}
                {duracion % 60} min
              </span>
            )}
          </div>
          <div className="rounded-3xl bg-black/30 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
            {p.a && p.b ? <MarcadorTenis torneo={t} partido={p} /> : <p className="py-4 text-center text-white/70">Esperando a los rivales de la ronda anterior.</p>}
          </div>
        </div>
      </FondoSuperficie>

      <div className="relative -mt-4 rounded-t-[2rem] bg-fondo">
        <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 sm:px-6">
          {e && !terminado && (
            <div className="overflow-hidden rounded-3xl ring-1 ring-white/10">
              <Cancha
                superficie={t.superficie}
                izquierda={lado(izquierdaEsA ? 0 : 1)}
                derecha={lado(izquierdaEsA ? 1 : 0)}
                saque={{ lado: (e.equipoSaca === 0) === izquierdaEsA ? "IZQ" : "DER", desde: e.ladoSaque, jugador: Math.max(0, ins[e.equipoSaca]?.jugadores.findIndex((j) => j.id === sacadorId) ?? 0) }}
              />
            </div>
          )}

          {analisis && analisis.impulso.length > 0 && (
            <>
              <Impulso t={t} p={p} a={analisis} />
              <Estadisticas t={t} p={p} a={analisis} />
            </>
          )}

          {t.superficie === "ARCILLA" && p.marcador && p.marcador.marcas.length > 0 && (
            <section className="glass rounded-3xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Eye className="size-5" style={{ color: d.claro }} /> Marcas revisadas en la arcilla
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {p.marcador.marcas.length} revisión{p.marcador.marcas.length === 1 ? "" : "es"}: {p.marcador.marcas.filter((x) => x.resultado === "BUENA").length} buena(s), {p.marcador.marcas.filter((x) => x.resultado === "MALA").length} mala(s).
              </p>
            </section>
          )}

          {!p.marcador && !terminado && (
            <div className="glass rounded-3xl p-8 text-center text-white/60">
              <PelotaTenis className="mx-auto mb-3 size-10" />
              El marcador punto a punto aparece aquí cuando el árbitro empiece el partido.
            </div>
          )}
          <div className="flex justify-center">
            <ChipSuperficie superficie={t.superficie} />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Gráfico de impulso: diferencia acumulada de puntos. Arriba manda A, abajo B. */
function Impulso({ t, p, a }: { t: TorneoTenis; p: PartidoTenis; a: Analisis }) {
  const n = a.impulso.length;
  const max = Math.max(4, ...a.impulso.map(Math.abs));
  const W = 600;
  const H = 160;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 8);
  const linea = a.impulso.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(n - 1)} ${H / 2} L0 ${H / 2} Z`;
  const d = SUPERFICIES[t.superficie];
  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Impulso del partido</h2>
        <span className="text-xs text-white/45">{n} puntos</span>
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold">
        <span>▲ {nombreInscrito(t, p.a, true)}</span>
        <span className="text-white/50">▼ {nombreInscrito(t, p.b, true)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" preserveAspectRatio="none" role="img" aria-label="Gráfico de impulso">
        <defs>
          <linearGradient id="impulso" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={d.claro} stopOpacity="0.55" />
            <stop offset="0.5" stopColor={d.claro} stopOpacity="0.05" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
        {a.cortesSet.map((i) => (
          <line key={i} x1={x(i)} x2={x(i)} y1="0" y2={H} stroke="currentColor" strokeOpacity="0.25" />
        ))}
        <motion.path d={area} fill="url(#impulso)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        <motion.path d={linea} fill="none" stroke={d.claro} strokeWidth="2.5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
        {a.quiebres.map((q) => (
          <circle key={q.i} cx={x(q.i)} cy={y(a.impulso[q.i])} r="5" fill="#dcf03c" stroke="#0f1a2e" strokeWidth="1.5" />
        ))}
      </svg>
      <p className="mt-2 text-xs text-white/45">Las líneas verticales cierran cada set; los puntos amarillos son quiebres de saque.</p>
    </section>
  );
}

function Estadisticas({ t, p, a }: { t: TorneoTenis; p: PartidoTenis; a: Analisis }) {
  const [sa, sb] = a.stats;
  const pct = (x: number, y: number) => (y ? Math.round((x / y) * 100) : 0);
  const filas: { t: string; a: number; b: number; texto?: [string, string]; menosEsMejor?: boolean }[] = [
    { t: "Aces", a: sa.aces, b: sb.aces },
    { t: "Dobles faltas", a: sa.doblesFaltas, b: sb.doblesFaltas, menosEsMejor: true },
    { t: "1er saque adentro", a: pct(sa.primerosAdentro, sa.puntosSaque), b: pct(sb.primerosAdentro, sb.puntosSaque), texto: [`${pct(sa.primerosAdentro, sa.puntosSaque)}%`, `${pct(sb.primerosAdentro, sb.puntosSaque)}%`] },
    { t: "Puntos ganados con el 1er saque", a: pct(sa.ganadosPrimero, sa.primerosAdentro), b: pct(sb.ganadosPrimero, sb.primerosAdentro), texto: [`${pct(sa.ganadosPrimero, sa.primerosAdentro)}%`, `${pct(sb.ganadosPrimero, sb.primerosAdentro)}%`] },
    { t: "Puntos ganados con el 2do saque", a: pct(sa.ganadosSegundo, sa.segundos), b: pct(sb.ganadosSegundo, sb.segundos), texto: [`${pct(sa.ganadosSegundo, sa.segundos)}%`, `${pct(sb.ganadosSegundo, sb.segundos)}%`] },
    { t: "Quiebres", a: sa.quiebresGanados, b: sb.quiebresGanados, texto: [`${sa.quiebresGanados}/${sa.quiebresOportunidad}`, `${sb.quiebresGanados}/${sb.quiebresOportunidad}`] },
    { t: "Juegos de saque ganados", a: sa.juegosSaqueGanados, b: sb.juegosSaqueGanados, texto: [`${sa.juegosSaqueGanados}/${sa.juegosSaque}`, `${sb.juegosSaqueGanados}/${sb.juegosSaque}`] },
    { t: "Winners", a: sa.winners, b: sb.winners },
    { t: "Errores no forzados", a: sa.erroresNoForzados, b: sb.erroresNoForzados, menosEsMejor: true },
    { t: "Racha más larga", a: sa.rachaMax, b: sb.rachaMax, texto: [`${sa.rachaMax} pts`, `${sb.rachaMax} pts`] },
    { t: "Puntos ganados", a: sa.puntos, b: sb.puntos },
  ];
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="font-display text-lg font-semibold">Estadísticas</h2>
      <div className="mt-1 flex justify-between text-xs font-semibold text-white/60">
        <span className="truncate">{nombreInscrito(t, p.a, true)}</span>
        <span className="truncate">{nombreInscrito(t, p.b, true)}</span>
      </div>
      <div className="mt-3 space-y-4">
        {filas.map((f) => {
          const total = f.a + f.b || 1;
          const ganaA = f.menosEsMejor ? f.a < f.b : f.a > f.b;
          const ganaB = f.menosEsMejor ? f.b < f.a : f.b > f.a;
          return (
            <div key={f.t}>
              <div className="flex items-center justify-between text-sm">
                <span className={clsx("w-16 font-display font-bold tabular", !ganaA && "text-white/50")}>{f.texto?.[0] ?? f.a}</span>
                <span className="flex-1 text-center text-xs text-white/55">{f.t}</span>
                <span className={clsx("w-16 text-right font-display font-bold tabular", !ganaB && "text-white/50")}>{f.texto?.[1] ?? f.b}</span>
              </div>
              <div className="mt-1.5 flex h-1.5 gap-1">
                <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-white/5">
                  <motion.div className="h-full rounded-full" style={{ background: ganaA ? "var(--sup-claro)" : "rgb(255 255 255 / 0.25)" }} initial={{ width: 0 }} animate={{ width: `${(f.a / total) * 100}%` }} />
                </div>
                <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div className="h-full rounded-full" style={{ background: ganaB ? "var(--sup-claro)" : "rgb(255 255 255 / 0.25)" }} initial={{ width: 0 }} animate={{ width: `${(f.b / total) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-white/40">Winners y errores cuentan solo cuando el árbitro marca cómo terminó el punto.</p>
    </section>
  );
}
