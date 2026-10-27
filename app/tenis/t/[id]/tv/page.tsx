"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Maximize, Minimize } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Reloj, useCursorOculto, useFullscreenYWakeLock } from "@/components/Pantalla";
import { QR } from "@/components/QR";
import { MarcadorTenis, textoResultado, vistaPartido } from "@/components/tenis/Marcador";
import { Cancha, FondoSuperficie, PelotaTenis } from "@/components/tenis/piezas";
import { useTenis, useTenisEnVivo, useTorneoTenis } from "@/lib/tenisStore";
import { campeon, formatoNombre, inscrito, jugable, nombreInscrito, nombreRonda, rondasDe, SUPERFICIES } from "@/lib/tenis/torneo";
import type { PartidoTenis, TorneoTenis } from "@/types/tenis";

/** Modo TV de tenis (1920×1080 escalado): las canchas en vivo con su marcador, lo que viene y los resultados. */
export default function TenisTVPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTorneoTenis(id);
  const hidratado = useTenis((s) => s.hidratado);
  useTenisEnVivo(2000);
  if (!t)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <PelotaTenis className="size-14" girando={!hidratado} />
      </main>
    );
  return <TV torneo={t} />;
}

function useEscala(ancho: number, alto: number) {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / ancho, window.innerHeight / alto));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [ancho, alto]);
  return escala;
}

function TV({ torneo: t }: { torneo: TorneoTenis }) {
  const { full, alternar, puede } = useFullscreenYWakeLock();
  const oculto = useCursorOculto();
  const escala = useEscala(1920, 1080);
  const d = SUPERFICIES[t.superficie];
  const enCancha = t.partidos.filter((p) => p.estado === "EN_JUEGO" || p.estado === "LLAMADO").sort((a, b) => (a.cancha ?? 99) - (b.cancha ?? 99));
  const proximos = t.partidos.filter((p) => jugable(p) && p.estado === "PENDIENTE").slice(0, 5);
  const resultados = t.partidos
    .filter((p) => p.resultado && p.resultado.tipo !== "BYE")
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .slice(0, 5);
  const rey = campeon(t);
  const url = typeof window !== "undefined" ? `${location.origin}/tenis/t/${t.id}` : "";
  const ronda = (p: PartidoTenis) => (t.formato === "ELIMINACION" ? nombreRonda(p.ronda, rondasDe(t)) : t.formato === "LIGA" ? `Jornada ${p.ronda}` : "");
  const uno = enCancha.length === 1;

  return (
    <main className={clsx("fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0b0f19]", oculto && "cursor-none")}>
      <FondoSuperficie superficie={t.superficie} className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex shrink-0 flex-col gap-8 p-12" style={{ width: 1920, height: 1080, transform: `scale(${escala})`, transformOrigin: "center" }}>
          <header className="flex items-center gap-6">
            <Logo className="!h-16" />
            <div className="h-14 w-px bg-white/20" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold uppercase tracking-[0.25em] text-white/60">
                Tenis · {d.nombre} · {formatoNombre(t)}
              </p>
              <h1 className="truncate font-display text-5xl font-bold">{t.nombre}</h1>
            </div>
            <Reloj />
            <div className={clsx("flex gap-2 transition-opacity", oculto && "opacity-0")}>
              <Link href={`/tenis/t/${t.id}`} className="btn-ghost !p-3" aria-label="Salir">
                <ArrowLeft className="size-5" />
              </Link>
              {puede && (
                <button className="btn-ghost !p-3" onClick={alternar} aria-label="Pantalla completa">
                  {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                </button>
              )}
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-8">
            <div className={clsx("grid min-h-0 gap-6", uno ? "grid-cols-1" : enCancha.length > 2 ? "auto-rows-fr grid-cols-2" : "auto-rows-fr grid-cols-1")}>
              <AnimatePresence>
                {enCancha.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-[2.5rem] bg-black/25 text-center">
                    {rey ? (
                      <>
                        <p className="text-9xl">🏆</p>
                        <p className="mt-6 text-3xl font-semibold uppercase tracking-[0.3em] text-white/60">{t.formato === "PARTIDO" ? "Ganó" : "Campeón"}</p>
                        <p className="mt-2 font-display text-7xl font-bold">{nombreInscrito(t, rey)}</p>
                      </>
                    ) : (
                      <>
                        <PelotaTenis className="size-28" girando />
                        <p className="mt-6 font-display text-5xl font-bold">Ahora no hay partidos en cancha</p>
                        <p className="mt-3 text-2xl text-white/60">Mira lo que viene a la derecha.</p>
                      </>
                    )}
                  </motion.div>
                )}
                {enCancha.map((p) => (
                  <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-col rounded-[2.5rem] bg-black/30 p-8 backdrop-blur">
                    <div className="flex items-center justify-between text-2xl">
                      <span className="font-display text-4xl font-bold">{p.cancha ? `Cancha ${p.cancha}` : "Cancha"}</span>
                      <span className="text-white/60">{ronda(p)}</span>
                      {p.estado === "LLAMADO" ? (
                        <span className="rounded-full bg-[#dcf03c] px-5 py-1.5 font-bold uppercase tracking-wider" style={{ color: "#0f1a2e" }}>
                          Llamado
                        </span>
                      ) : (
                        <span className="flex items-center gap-3 font-semibold uppercase tracking-widest">
                          <span className="size-4 animate-pulse rounded-full bg-[#dcf03c]" /> En vivo
                        </span>
                      )}
                    </div>
                    {uno && p.marcador && <CanchaVivo torneo={t} partido={p} />}
                    <div className="mt-auto pt-4">
                      {p.estado === "LLAMADO" && !p.marcador ? (
                        <div className="space-y-3 font-display text-5xl font-bold">
                          <p className="break-words leading-tight">{nombreInscrito(t, p.a)}</p>
                          <p className="text-3xl text-white/40">vs</p>
                          <p className="break-words leading-tight">{nombreInscrito(t, p.b)}</p>
                        </div>
                      ) : (
                        <MarcadorTenis torneo={t} partido={p} tam="tv" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <aside className="flex min-h-0 flex-col gap-6">
              {proximos.length > 0 && (
                <section className="rounded-[2rem] bg-black/25 p-7">
                  <h2 className="text-xl font-semibold uppercase tracking-[0.25em] text-white/60">Próximos</h2>
                  <ul className="mt-4 space-y-4">
                    {proximos.map((p) => (
                      <li key={p.id} className="text-2xl">
                        <p className="break-words font-semibold leading-tight">
                          {nombreInscrito(t, p.a)} <span className="text-white/40">vs</span> {nombreInscrito(t, p.b)}
                        </p>
                        <p className="text-lg text-white/50">{ronda(p)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {resultados.length > 0 && (
                <section className="min-h-0 flex-1 overflow-hidden rounded-[2rem] bg-black/25 p-7">
                  <h2 className="text-xl font-semibold uppercase tracking-[0.25em] text-white/60">Resultados</h2>
                  <ul className="mt-4 space-y-4">
                    {resultados.map((p) => (
                      <li key={p.id} className="text-2xl">
                        <p className="break-words font-semibold leading-tight">
                          {nombreInscrito(t, p.resultado!.ganador === 0 ? p.a : p.b)} <span className="text-white/45">a</span> {nombreInscrito(t, p.resultado!.ganador === 0 ? p.b : p.a)}
                        </p>
                        <p className="font-display text-xl tabular" style={{ color: d.claro }}>
                          {textoResultado(t, p)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="mt-auto flex items-center gap-6 rounded-[2rem] bg-black/25 p-6">
                {url && <QR texto={url} size={140} className="shrink-0 rounded-2xl bg-blanco p-2" />}
                <p className="text-2xl leading-snug text-white/80">
                  Escanea y sigue el cuadro y las <b>estadísticas</b> en tu celular.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </FondoSuperficie>
    </main>
  );
}

/** Con un solo partido en cancha, la TV dibuja la cancha con quién saca y hacia dónde. */
function CanchaVivo({ torneo: t, partido: p }: { torneo: TorneoTenis; partido: PartidoTenis }) {
  const v = vistaPartido(t, p);
  const e = v.e;
  if (!e || !p.marcador || p.resultado) return null;
  const izq = e.ladoA === "IZQ";
  const ins = [inscrito(t, p.a), inscrito(t, p.b)];
  const lado = (l: 0 | 1) => ins[l]?.jugadores.map((j) => ({ nombre: j.nombre, equipo: l })) ?? [];
  const sacadorId = p.marcador.ordenSaque[e.turnoSaque];
  return (
    <div className="mx-auto mt-6 w-full max-w-4xl [perspective:1400px]">
      <div className="[transform:rotateX(30deg)]">
        <Cancha
          superficie={t.superficie}
          izquierda={lado(izq ? 0 : 1)}
          derecha={lado(izq ? 1 : 0)}
          saque={{ lado: (e.equipoSaca === 0) === izq ? "IZQ" : "DER", desde: e.ladoSaque, jugador: Math.max(0, ins[e.equipoSaca]?.jugadores.findIndex((j) => j.id === sacadorId) ?? 0) }}
          className="drop-shadow-[0_40px_40px_rgba(0,0,0,0.5)]"
        />
      </div>
    </div>
  );
}
