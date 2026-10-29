"use client";

import clsx from "clsx";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { History, Info, ListOrdered, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Historial } from "@/components/Historial";
import { Segmented } from "@/components/ui/Segmented";
import { AvatarPareja } from "@/components/Avatar";
import { EventoShell } from "@/components/EventoShell";
import { Leaderboard } from "@/components/Leaderboard";
import { CompartirButton } from "@/components/CompartirButton";
import { Confetti } from "@/components/ui/Confetti";
import { BotonImagenPodio } from "@/components/ImagenPodio";
import { BotonCaptura } from "@/components/BotonCaptura";
import { marcarSoloRanking } from "@/components/SoloRanking";
import { useEsStaff } from "@/lib/store";
import { calcularTabla, explicacionRanking, nombresDeFila } from "@/lib/scoring";
import type { EventoAmericano } from "@/types/americano";

export default function TablaPage() {
  const { id } = useParams<{ id: string }>();
  return <EventoShell id={id}>{(evento) => <Tabla evento={evento} />}</EventoShell>;
}

function Tabla({ evento }: { evento: EventoAmericano }) {
  const tabla = useMemo(() => calcularTabla(evento), [evento]);
  const [vista, setVista] = useState<"TABLA" | "HISTORIAL">("TABLA");
  const podio = tabla.filas.slice(0, 3).map((f, i) => ({ ...f, lugar: i + 1 }));
  const hayJuego = tabla.filas.some((f) => f.pj > 0);
  const terminado = evento.estado === "FINALIZADO";
  // Orden visual del podio: 2º, 1º, 3º
  const orden = [podio[1], podio[0], podio[2]].filter(Boolean);
  const desempates = tabla.desempates ?? [];
  const alturas: Record<number, string> = { 1: "h-36", 2: "h-28", 3: "h-20" };
  const esStaff = useEsStaff();
  // Quien escanea el QR sin ser staff queda solo en esta pantalla.
  useEffect(() => {
    if (esStaff === false) marcarSoloRanking(`/evento/${evento.id}/tabla`);
  }, [esStaff, evento.id]);

  return (
    <div className="mt-2">
      <Confetti activo={terminado} piezas={90} />
      <div data-sin-captura>
        <BotonImagenPodio evento={evento} tabla={tabla} />
      </div>
      {hayJuego && vista === "TABLA" && (
        <div className="mb-6 flex items-end justify-center gap-3 sm:gap-6">
          {orden.map((f) => (
            <motion.div
              key={f.entidadId}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: f.lugar === 1 ? 0.2 : 0.05 * f.lugar, type: "spring", stiffness: 200, damping: 20 }}
              className="flex w-28 flex-col items-center sm:w-40"
            >
              <AvatarPareja nombres={nombresDeFila(evento, f)} fotos={f.fotoUrls} dupla={f.fotoDupla} size={f.lugar === 1 ? 56 : 44} />
              <p className="mt-2 line-clamp-2 text-center text-xs font-semibold sm:text-sm">{f.nombre}</p>
              <p className="font-display text-lg font-bold text-neon">{f.puntos}</p>
              <div
                className={clsx(
                  "mt-1 flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-black",
                  alturas[f.lugar],
                  f.lugar === 1 ? "bg-gradient-to-b from-neon to-neon/20 text-noche" : "bg-gradient-to-b from-white/15 to-white/[0.02] text-white/80",
                )}
              >
                {f.posicion}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="w-full min-w-0 max-w-xs">
          <Segmented
            opciones={[
              { id: "TABLA", label: <span className="flex items-center justify-center gap-1.5"><ListOrdered className="size-4" /> Tabla</span> },
              { id: "HISTORIAL", label: <span className="flex items-center justify-center gap-1.5"><History className="size-4" /> Historial</span> },
            ]}
            valor={vista}
            onChange={setVista}
          />
        </div>
        <div className="flex shrink-0 gap-2" data-sin-captura>
          <BotonCaptura objetivo="captura-ranking" archivo={`ranking-${evento.nombre}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png"} />
          <CompartirButton titulo={`Ranking · ${evento.nombre}`} ruta={`/evento/${evento.id}/tabla`} />
        </div>
      </div>
      {vista === "TABLA" ? (
        <>
          <Leaderboard tabla={tabla} nombresPorFila={(f) => nombresDeFila(evento, f)} />
          {desempates.length > 0 && (
            <div className="glass mt-4 rounded-2xl p-4">
              <p className="label !mb-2 flex items-center gap-1.5">
                <Scale className="size-3.5" /> Empates en puntos
              </p>
              <ul className="space-y-1.5 text-xs text-white/60">
                {desempates.map((d) => (
                  <li key={`${d.arriba}-${d.abajo}`}>
                    {d.empatados ? (
                      <>
                        {d.empatados.map((n, i) => (
                          <span key={n}>
                            {i > 0 && (i === d.empatados!.length - 1 ? " y " : ", ")}
                            <span className="font-semibold text-white">{n}</span>
                          </span>
                        ))}{" "}
                        ({d.puntos} pts): {d.motivo}.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-white">{d.arriba}</span> va delante de <span className="font-semibold text-white">{d.abajo}</span> ({d.puntos} pts): {d.motivo}.
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs text-white/40">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {explicacionRanking(evento.puntuacion, evento.modalidad === "DUPLA_FIJA")} PJ jugados · PG ganados · PP perdidos · PF a favor · PC en contra.
            </span>
          </p>
        </>
      ) : (
        <Historial evento={evento} />
      )}
    </div>
  );
}
