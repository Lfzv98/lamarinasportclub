"use client";

import clsx from "clsx";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { EventoShell } from "@/components/EventoShell";
import { Leaderboard } from "@/components/Leaderboard";
import { CompartirButton } from "@/components/CompartirButton";
import { Confetti } from "@/components/ui/Confetti";
import { calcularTabla, explicacionRanking, nombresDeFila } from "@/lib/scoring";
import type { EventoAmericano } from "@/types/americano";

export default function TablaPage() {
  const { id } = useParams<{ id: string }>();
  return <EventoShell id={id}>{(evento) => <Tabla evento={evento} />}</EventoShell>;
}

function Tabla({ evento }: { evento: EventoAmericano }) {
  const tabla = useMemo(() => calcularTabla(evento), [evento]);
  const podio = tabla.filas.slice(0, 3);
  const hayJuego = tabla.filas.some((f) => f.pj > 0);
  const terminado = evento.estado === "FINALIZADO";
  // Orden visual del podio: 2º, 1º, 3º
  const orden = [podio[1], podio[0], podio[2]].filter(Boolean);
  const alturas: Record<number, string> = { 1: "h-36", 2: "h-28", 3: "h-20" };

  return (
    <div className="mt-2">
      <Confetti activo={terminado} piezas={90} />
      {hayJuego && (
        <div className="mb-6 flex items-end justify-center gap-3 sm:gap-6">
          {orden.map((f) => (
            <motion.div
              key={f.entidadId}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: f.posicion === 1 ? 0.2 : 0.05 * f.posicion, type: "spring", stiffness: 200, damping: 20 }}
              className="flex w-28 flex-col items-center sm:w-40"
            >
              <AvatarPareja nombres={nombresDeFila(evento, f)} fotos={f.fotoUrls} size={f.posicion === 1 ? 56 : 44} />
              <p className="mt-2 line-clamp-2 text-center text-xs font-semibold sm:text-sm">{f.nombre}</p>
              <p className="font-display text-lg font-bold text-neon">{f.puntos}</p>
              <div
                className={clsx(
                  "mt-1 flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-black",
                  alturas[f.posicion],
                  f.posicion === 1 ? "bg-gradient-to-b from-neon to-neon/20 text-noche" : "bg-gradient-to-b from-white/15 to-white/[0.02] text-white/80",
                )}
              >
                {f.posicion}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Ranking</h2>
        <CompartirButton titulo={`Ranking · ${evento.nombre}`} ruta={`/evento/${evento.id}/tabla`} />
      </div>
      <Leaderboard tabla={tabla} nombresPorFila={(f) => nombresDeFila(evento, f)} />

      <p className="mt-4 flex items-start gap-2 text-xs text-white/40">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {explicacionRanking(evento.puntuacion)}{" "}
        PJ jugados · PG ganados · PP perdidos · PF a favor · PC en contra.
      </p>
    </div>
  );
}
