"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Plus, Swords, Trophy, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StaffChip } from "@/components/StaffGate";
import { Cancha, FondoSuperficie, superficieDe, temaSuperficie } from "@/components/tenis/piezas";
import { PartidoVivoCard, partidosVivos, TorneoTenisCard } from "@/components/tenis/Tarjetas";
import { useAmericanos, useEsStaff } from "@/lib/store";
import { useListaTenis, useTenis } from "@/lib/tenisStore";
import { SUPERFICIES } from "@/lib/tenis/torneo";

const CONSEJOS = {
  DURA: [
    { t: "Formato sugerido", d: "Clásico o súper tie-break: los puntos son cortos y los partidos rinden." },
    { t: "Reloj de saque", d: "25 segundos entre puntos: el anotador lo marca solo." },
    { t: "Pelotas", d: "Las de tipo 2 (velocidad media) son las de uso general en cancha dura." },
  ],
  ARCILLA: [
    { t: "Revisar la marca", d: "Solo en arcilla: el árbitro puede bajar a ver la marca de la pelota. El anotador lo registra." },
    { t: "Rastra al terminar", d: "Al cerrar cada partido el anotador avisa pasar la rastra y regar las líneas." },
    { t: "Formato sugerido", d: "Los puntos son largos: en días de muchos partidos, súper tie-break o sets cortos." },
  ],
} as const;

export default function SuperficiePage() {
  const { superficie: slug } = useParams<{ superficie: string }>();
  const superficie = superficieDe(slug);
  const todos = useListaTenis();
  const hidratado = useTenis((s) => s.hidratado);
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  if (!superficie) notFound();
  const d = SUPERFICIES[superficie];
  const torneos = todos.filter((t) => t.superficie === superficie);
  const activos = torneos.filter((t) => t.estado !== "FINALIZADO");
  const pasados = torneos.filter((t) => t.estado === "FINALIZADO");
  const vivos = partidosVivos(torneos);
  const soloStaff = (e: React.MouseEvent) => {
    if (esStaff) return;
    e.preventDefault();
    setPedirLogin(true);
  };

  return (
    <main className="pb-24" style={temaSuperficie(superficie)}>
      <FondoSuperficie superficie={superficie} className="pb-14 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="relative mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link href="/tenis" className="btn-ghost !p-2.5" aria-label="Tenis">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex-1" />
          <StaffChip />
          <Logo compacto />
        </header>
        <div className="relative mx-auto grid max-w-5xl items-center gap-6 px-4 pt-4 sm:px-6 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Tenis · {d.ingles}</p>
            <h1 className="mt-1 font-display text-5xl font-bold tracking-tight sm:text-6xl">{d.nombre}</h1>
            <p className="mt-2 text-lg font-semibold text-white/85">
              {d.lema}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/tenis/nuevo?superficie=${slug}`} onClick={soloStaff} className="btn bg-blanco text-base font-bold shadow-xl" style={{ color: d.oscuro }}>
                <Plus className="size-5" /> Nuevo torneo
              </Link>
              <Link href={`/tenis/nuevo?superficie=${slug}&rapido=1`} onClick={soloStaff} className="btn-ghost text-base">
                <Swords className="size-5" /> Partido rápido
              </Link>
              <Link href="/tenis/jugadores" className="btn-ghost text-base">
                <Trophy className="size-5" /> Jugadores
              </Link>
            </div>
          </div>
          <div className="px-4 [perspective:1000px] sm:px-0">
            <div className="[transform:rotateX(34deg)_rotateZ(-4deg)]">
              <Cancha
                superficie={superficie}
                izquierda={[{ nombre: "A", equipo: 0 }]}
                derecha={[{ nombre: "B", equipo: 1 }]}
                saque={{ lado: "IZQ", desde: "DERECHA" }}
                className="drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
        </div>
      </FondoSuperficie>

      <div className="relative -mt-8 rounded-t-[2rem] bg-fondo">
        <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
          {vivos.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
                <Zap className="size-5" style={{ color: d.claro }} /> En cancha ahora
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {vivos.map(({ t, p }) => (
                  <PartidoVivoCard key={p.id} torneo={t} partido={p} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-xl font-semibold">Torneos y partidos</h2>
              <span className="text-xs text-white/40">{activos.length} activo(s)</span>
            </div>
            {!hidratado ? (
              <div className="glass h-40 animate-pulse rounded-3xl" />
            ) : activos.length === 0 ? (
              <Link href={`/tenis/nuevo?superficie=${slug}`} onClick={soloStaff} className="glass flex flex-col items-center gap-2 rounded-3xl border-dashed p-10 text-center text-white/60 hover:text-white">
                <Plus className="size-8" style={{ color: d.claro }} />
                Aún no hay torneos en {d.nombre.toLowerCase()}. ¡Crea el primero!
              </Link>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activos.map((t, i) => (
                  <TorneoTenisCard key={t.id} torneo={t} index={i} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CONSEJOS[superficie].map((c) => (
              <div key={c.t} className="glass rounded-3xl p-5">
                <p className="text-sm font-semibold" style={{ color: d.claro }}>
                  {c.t}
                </p>
                <p className="mt-1 text-sm text-white/60">{c.d}</p>
              </div>
            ))}
          </section>

          {pasados.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-display text-xl font-semibold">Historial</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pasados.map((t, i) => (
                  <TorneoTenisCard key={t.id} torneo={t} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
