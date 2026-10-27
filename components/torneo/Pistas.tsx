"use client";

import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { CloudRain, Flag, Megaphone, MonitorPlay, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { listarArbitros, type ArbitroLista } from "@/lib/arbitro";
import { MatchCard } from "@/components/torneo/piezas";
import { MarcadorMini } from "@/components/torneo/vivo";
import { sonar, vibrar } from "@/lib/feedback";
import { nombreCorto } from "@/lib/torneo/categorias";
import { turnoEnPista } from "@/lib/torneo/arbitros";
import { nombrePista, pistaCorta } from "@/lib/torneo/imprevistos";
import { limiteWO, type EstadoPista } from "@/lib/torneo/programacion";
import { categoria, dupla, nombreDupla } from "@/lib/torneo/torneo";
import { useMarcador, useTorneos } from "@/lib/torneosStore";
import type { PartidoTorneo, Torneo } from "@/types/torneo";

/**
 * Tarjeta de una pista en vivo. Todos ven qué se juega; la mesa técnica (árbitro principal o
 * staff) además llama partidos, ve el árbitro de turno y da W.O. cuando vence la tolerancia.
 * El marcador lo lleva siempre el árbitro de la pista.
 */
export function TarjetaPista({
  torneo,
  c,
  ahora,
  i = 0,
  mesa,
  vencido,
  onAbrir,
}: {
  torneo: Torneo;
  c: EstadoPista;
  ahora: number;
  i?: number;
  mesa: boolean;
  vencido: boolean;
  onAbrir: (partidoId: string) => void;
}) {
  const accionPartido = useTorneos((s) => s.accionPartido);
  const nombreArbitro = useNombresArbitros(mesa);
  const actual = c.enJuego ?? c.llamado;
  const cat = actual ? categoria(torneo, actual.categoriaId) : null;
  const m = useMarcador(c.enJuego?.id);
  const anota = m?.anotadores?.at(-1)?.nombre ?? m?.anotador;
  const { turno, hayTurnos } = turnoEnPista(torneo, c.numero, ahora);
  const deTurno = turno ? (nombreArbitro?.(turno.arbitroId) ?? "Árbitro de turno") : null;
  const sinArbitro = mesa && hayTurnos && !turno && !!(c.enJuego || c.llamado || c.siguiente) && !c.suspendida;

  const llamar = async (p: PartidoTorneo) => {
    vibrar([10, 30, 10]);
    sonar("ok");
    const err = await accionPartido(torneo.id, p.id, { accion: "llamar", pista: c.numero });
    if (err) return toast(err, "error");
    toast(`A ${nombrePista(torneo, c.numero)}: ${nombreDupla(torneo, dupla(torneo, p.duplaA))} vs ${nombreDupla(torneo, dupla(torneo, p.duplaB))}`);
  };
  const wo = async (p: PartidoTorneo, noVino: "A" | "B") => {
    const nombre = nombreDupla(torneo, dupla(torneo, noVino === "A" ? p.duplaA : p.duplaB));
    if (!confirm(`¿W.O.? No se presentó ${nombre}.`)) return;
    const err = await accionPartido(torneo.id, p.id, { accion: "wo", ganador: noVino === "A" ? "B" : "A" });
    if (err) return toast(err, "error");
    toast(`W.O.: gana ${nombreDupla(torneo, dupla(torneo, noVino === "A" ? p.duplaB : p.duplaA))}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className={clsx("glass relative overflow-hidden rounded-3xl p-4", c.enJuego && "!border-neon/40", sinArbitro && "!border-amber-300/40")}
      data-pista={c.numero}
    >
      <div className="flex items-center gap-2">
        <span className={clsx("flex size-9 items-center justify-center rounded-full font-display font-bold", c.enJuego ? "bg-lima text-marino-2" : c.sede ? "bg-cielo/25 text-cielo" : "bg-pista text-blanco")}>
          {c.sede ? c.numero % 100 : c.numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {c.nombre}
            {c.sede && <span className="font-normal text-cielo"> · {c.sede}</span>}
          </p>
          <p className="text-xs text-white/45">
            {c.enJuego ? `En juego · ${nombreCorto(cat!.categoria)} · ${c.enJuego.etiqueta}` : c.llamado ? `Llamado · ${nombreCorto(cat!.categoria)}` : c.suspendida ? `Suspendida · ${c.suspendida}` : "Libre"}
          </p>
        </div>
        <Link href={`/torneos/${torneo.id}/pista/${c.numero}`} className="btn-ghost !p-2" title="Pantalla de esta pista" aria-label={`Pantalla de ${c.nombre}`}>
          <MonitorPlay className="size-4" />
        </Link>
      </div>
      {mesa && (deTurno || sinArbitro || (c.enJuego && anota)) && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-xs font-semibold", sinArbitro ? "text-amber-200" : "text-white/55")}>
          {sinArbitro ? (
            <>
              <UserRoundX className="size-3.5" /> Sin árbitro de turno: asígnalo en Árbitros o anota en su lugar
            </>
          ) : (
            <>
              <Flag className="size-3.5 text-lima" /> {c.enJuego && anota ? `Anota ${anota}` : `Árbitro: ${deTurno}`}
            </>
          )}
        </p>
      )}
      <div className="mt-3">
        {c.enJuego ? (
          <button className="block w-full text-left" onClick={() => onAbrir(c.enJuego!.id)}>
            <MarcadorMini torneo={torneo} p={c.enJuego} />
          </button>
        ) : c.llamado ? (
          <div>
            <MatchCard torneo={torneo} p={c.llamado} compacto onClick={() => onAbrir(c.llamado!.id)} />
            <Llamado torneo={torneo} p={c.llamado} ahora={ahora} />
            {mesa && !vencido && <p className="mt-1 text-[11px] text-white/40">El árbitro de la pista lo empieza desde su tablet.</p>}
            {mesa && vencido && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map((l) => (
                  <button key={l} className="btn-ghost !py-1.5 text-xs !text-coral" onClick={() => wo(c.llamado!, l)}>
                    <Flag className="size-3.5" /> No vino {nombreDupla(torneo, dupla(torneo, l === "A" ? c.llamado!.duplaA : c.llamado!.duplaB))}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : c.siguiente ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Siguiente</p>
            <MatchCard torneo={torneo} p={c.siguiente} compacto onClick={() => onAbrir(c.siguiente!.id)} />
            {mesa && (
              <button className="btn-neon mt-2 w-full !py-2" onClick={() => llamar(c.siguiente!)}>
                <Megaphone className="size-4" /> Llamar a {c.sede ? pistaCorta(torneo, c.numero) : c.nombre.toLowerCase()}
              </button>
            )}
          </div>
        ) : c.suspendida ? (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-amber-200">
            <CloudRain className="size-4" /> {c.suspendida}: sin juego por ahora
          </p>
        ) : (
          <p className="py-4 text-center text-sm text-white/40">Sin partidos listos</p>
        )}
      </div>
    </motion.div>
  );
}

let plantel: Promise<ArbitroLista[]> | null = null;

/** Nombres del plantel de árbitros (una consulta por carga de la app), para decir quién está de turno. */
export function useNombresArbitros(activo = true): (id: string) => string | null {
  const [lista, setLista] = useState<ArbitroLista[]>([]);
  useEffect(() => {
    if (!activo) return;
    plantel ??= listarArbitros().then((l) => l?.arbitros ?? []);
    plantel.then(setLista);
  }, [activo]);
  return (id) => {
    const a = lista.find((x) => x.id === id);
    return a ? `${a.nombre} ${a.apellido}`.trim() : null;
  };
}

export function Llamado({ torneo, p, ahora }: { torneo: Torneo; p: PartidoTorneo; ahora: number }) {
  const limite = limiteWO(torneo, p);
  if (!p.llamadoEn || limite === null) return null;
  const pasados = Math.floor((ahora - new Date(p.llamadoEn).getTime()) / 60_000);
  const quedan = Math.ceil((limite - ahora) / 60_000);
  return (
    <p className={clsx("mt-2 text-xs font-semibold", quedan <= 0 ? "text-coral" : quedan <= 5 ? "text-amber-200" : "text-white/50")}>
      {quedan > 0
        ? quedan > torneo.toleranciaWO
          ? `Llamado hace ${pasados} min · hora prevista ${new Date(limite - torneo.toleranciaWO * 60_000).toTimeString().slice(0, 5)}`
          : `Llamado hace ${pasados} min · W.O. en ${quedan} min`
        : `Pasó la tolerancia de ${torneo.toleranciaWO} min: se puede dar W.O.`}
    </p>
  );
}
