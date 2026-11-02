"use client";

import clsx from "clsx";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, CloudRain, Maximize, Megaphone, Minimize, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ANCHO_ESTRECHO, Escenario, Reloj, useCursorOculto, useFullscreenYWakeLock, useLienzo, useVertical } from "@/components/Pantalla";
import { QR } from "@/components/QR";
import { TorneoShellMinimo } from "@/components/torneo/minimo";
import { FranjaPatrocinadores } from "@/components/torneo/Patrocinadores";
import { lineasOrigen } from "@/components/torneo/piezas";
import { MarcadorMini, useMarcadoresEnVivo } from "@/components/torneo/vivo";
import { nombreCorto } from "@/lib/torneo/categorias";
import { estadoPistas, partidosListos } from "@/lib/torneo/programacion";
import { textoSets } from "@/lib/torneo/tabla";
import { nombrePista } from "@/lib/torneo/imprevistos";
import { categoria } from "@/lib/torneo/torneo";
import type { PartidoTorneo, Torneo } from "@/types/torneo";

/** Modo TV del torneo (terraza / bar): todas las pistas en vivo, lo que viene y los últimos resultados. */
export default function TorneoTVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TorneoShellMinimo id={id}>{(t) => <TV torneo={t} />}</TorneoShellMinimo>;
}

function TV({ torneo }: { torneo: Torneo }) {
  useMarcadoresEnVivo(torneo.id, 2000);
  const { full, alternar, puede } = useFullscreenYWakeLock();
  const oculto = useCursorOculto();
  const vertical = useVertical();
  const lienzo = useLienzo(vertical);
  const estrecho = lienzo.ancho < ANCHO_ESTRECHO;
  const pistas = estadoPistas(torneo);
  const proximos = partidosListos(torneo).filter((p) => !pistas.some((c) => c.llamado?.id === p.id)).slice(0, pistas.length > 6 ? 4 : 6);
  const recientes = torneo.categorias
    .flatMap((c) => c.cuadro?.partidos ?? [])
    .filter((p) => p.estado === "FINALIZADO" && !p.bye && p.finEn)
    .sort((a, b) => (b.finEn ?? "").localeCompare(a.finEn ?? ""))
    .slice(0, 5);
  const url = typeof window !== "undefined" ? `${location.origin}/torneos/${torneo.id}` : "";
  const cat = (id: string) => nombreCorto(categoria(torneo, id)!.categoria);
  // Torneos con varias sedes (10+ pistas): tarjetas compactas en 2-3 columnas para que todas quepan sin encimarse.
  const muchas = pistas.length > 6;

  return (
    <Escenario oculto={oculto} lienzo={lienzo}>
      <header className="flex items-center gap-6">
        <Logo className="!h-14" />
        <div className="h-12 w-px bg-white/10" />
        <h1 className={clsx("min-w-0 flex-1 font-display font-bold", estrecho ? "text-3xl leading-tight" : "truncate text-4xl")}>{torneo.nombre}</h1>
        <Reloj />
        <div className={clsx("flex gap-2 transition-opacity", oculto && "opacity-0")}>
          <Link href={`/torneos/${torneo.id}`} className="btn-ghost !p-3" aria-label="Salir">
            <ArrowLeft className="size-5" />
          </Link>
          {puede && (
            <button className="btn-ghost !p-3" onClick={alternar} aria-label="Pantalla completa">
              {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          )}
        </div>
      </header>
      <div className={clsx("grid min-h-0 flex-1 gap-6", vertical || estrecho ? "grid-cols-1" : "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
        <div className={clsx("grid min-h-0", muchas ? clsx("gap-3", estrecho ? "grid-cols-2" : "grid-cols-3") : estrecho ? "grid-cols-1 gap-5" : "grid-cols-2 gap-5", !lienzo.desplaza && "auto-rows-fr")}>
          {pistas.map((c) => (
            <div key={c.numero} className={clsx("glass flex min-h-0 flex-col overflow-hidden", muchas ? "rounded-3xl p-4" : "rounded-[2rem] p-6", c.enJuego && "!border-neon/40")}>
              <div className={clsx("flex items-center", muchas ? "gap-2" : "gap-3")}>
                <span className={clsx("flex shrink-0 items-center justify-center rounded-full font-display font-bold", muchas ? "size-9 text-lg" : "size-12 text-2xl", c.enJuego ? "bg-lima text-marino-2" : "bg-pista text-blanco")}>{c.numero}</span>
                <p className={clsx("min-w-0 flex-1 truncate font-display font-bold", muchas ? "text-lg" : "text-2xl")}>
                  {c.nombre}
                  {c.sede && <span className="font-normal text-cielo"> · {c.sede}</span>}
                </p>
                {c.enJuego ? (
                  <span className={clsx("flex shrink-0 items-center gap-2 font-semibold text-neon", muchas ? "text-base" : "text-lg")}>
                    <Radio className="size-5" /> {cat(c.enJuego.categoriaId)}
                  </span>
                ) : c.llamado ? (
                  <span className="flex items-center gap-2 text-lg font-semibold text-lima">
                    <Megaphone className="size-5" /> Llamado
                  </span>
                ) : c.suspendida ? (
                  <span className="flex items-center gap-2 text-lg font-semibold text-amber-200">
                    <CloudRain className="size-5" /> {c.suspendida}
                  </span>
                ) : (
                  <span className="text-lg text-white/40">Libre</span>
                )}
              </div>
              <div className={clsx("mt-auto", muchas ? "pt-2" : "pt-4")}>
                {c.enJuego ? (
                  <MarcadorMini torneo={torneo} p={c.enJuego} grande={!muchas} completo={!muchas} />
                ) : c.llamado ? (
                  <Cruce torneo={torneo} p={c.llamado} className={muchas ? "text-base font-semibold" : "text-xl font-semibold"} />
                ) : (
                  c.siguiente ? (
                    <div className="text-white/45">
                      <p className="text-sm font-semibold uppercase tracking-wider">Siguiente</p>
                      <Cruce torneo={torneo} p={c.siguiente} className={clsx("mt-1", muchas ? "text-sm" : "text-lg")} />
                    </div>
                  ) : (
                    <p className="text-xl text-white/40">—</p>
                  )
                )}
              </div>
            </div>
          ))}
          <div className={clsx("glass flex min-h-0 items-center", muchas ? "gap-4 rounded-3xl p-4" : "gap-6 rounded-[2rem] p-6")}>
            <div className={clsx("shrink-0 bg-blanco", muchas ? "rounded-xl p-2" : "rounded-2xl p-3")}>
              <QR texto={url} size={muchas ? 96 : 150} />
            </div>
            <div className="min-w-0">
              <p className={clsx("font-display font-bold", muchas ? "text-xl" : "text-2xl")}>Sigue el torneo</p>
              <p className={clsx("mt-1 text-white/55", muchas ? "text-base" : "text-lg")}>Cuadros, horarios y tus estadísticas</p>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-5">
          <div className="glass min-h-0 flex-1 overflow-hidden rounded-[2rem] p-6">
            <p className="font-display text-2xl font-bold">Próximos partidos</p>
            <ul className="mt-4 space-y-3 [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
              {proximos.map((p) => (
                <li key={p.id} className="flex items-center gap-4 rounded-2xl bg-white/[0.04] px-4 py-3">
                  <span className="w-16 font-display text-xl font-bold text-lima">{p.programacion?.hora ?? "--"}</span>
                  <div className="min-w-0 flex-1">
                    <Cruce torneo={torneo} p={p} className="text-lg font-semibold" />
                    <p className="mt-1 text-sm text-white/45">
                      {cat(p.categoriaId)} · {p.etiqueta} · {nombrePista(torneo, p.programacion?.pista)}
                    </p>
                  </div>
                </li>
              ))}
              {!proximos.length && <li className="text-lg text-white/40">No hay más partidos listos.</li>}
            </ul>
          </div>
          <div className="glass rounded-[2rem] p-6">
            <p className="font-display text-2xl font-bold">Últimos resultados</p>
            <ul className="mt-4 space-y-2.5">
              {recientes.map((p) => {
                const ganaA = p.resultado?.ganador === "A";
                return (
                  <li key={p.id} className="flex items-center gap-3 text-lg">
                    <span className="w-20 shrink-0 text-sm text-white/45">{cat(p.categoriaId)}</span>
                    <span className="min-w-0 flex-1 break-words leading-tight">
                      <b>{lineasOrigen(torneo, p, ganaA ? "A" : "B").join(" / ")}</b> <span className="text-white/40">a</span> {lineasOrigen(torneo, p, ganaA ? "B" : "A").join(" / ")}
                    </span>
                    <span className="font-display font-bold text-lima">{textoSets(p.resultado!.sets, !ganaA)}</span>
                  </li>
                );
              })}
              {!recientes.length && <li className="text-lg text-white/40">Todavía no hay resultados.</li>}
            </ul>
          </div>
          {!!torneo.patrocinadores?.length && (
            <div className="glass rounded-[2rem] p-6">
              <FranjaPatrocinadores torneo={torneo} grande />
            </div>
          )}
        </div>
      </div>
    </Escenario>
  );
}

/** Las dos duplas con nombre y apellido de cada jugador, una línea por jugador: nada se corta en la TV. */
function Cruce({ torneo, p, className }: { torneo: Torneo; p: PartidoTorneo; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 leading-tight", className)}>
      <div className="min-w-0 break-words">
        {lineasOrigen(torneo, p, "A").map((n, i) => <p key={i}>{n}</p>)}
      </div>
      <span className="text-white/35">vs</span>
      <div className="min-w-0 break-words">
        {lineasOrigen(torneo, p, "B").map((n, i) => <p key={i}>{n}</p>)}
      </div>
    </div>
  );
}
