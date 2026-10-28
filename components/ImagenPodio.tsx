"use client";

import clsx from "clsx";
import { AtSign, Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { Posicion } from "@/components/Leaderboard";
import { Hoja } from "@/components/ui/Hoja";
import { toast } from "@/components/ui/Toaster";
import { generarImagenPodio, tituloPuesto } from "@/lib/imagenPodio";
import { nombresCompletosDeFila, nombresDeFila } from "@/lib/scoring";
import { useAmericanos } from "@/lib/store";
import type { EventoAmericano, FilaPosicion, TablaPosiciones } from "@/types/americano";

const INSTAGRAM_POR_DEFECTO = "lamarinasportclub";

/**
 * Solo cuando el americano terminó: cada jugador (o dupla) elige su nombre y baja la imagen
 * de su resultado para publicarla en redes etiquetando a La Marina.
 */
export function BotonImagenPodio({ evento, tabla }: { evento: EventoAmericano; tabla: TablaPosiciones }) {
  const [abierta, setAbierta] = useState(false);
  const instagram = useAmericanos((s) => s.club.contacto.instagram) || INSTAGRAM_POR_DEFECTO;
  if (evento.estado !== "FINALIZADO" || !tabla.filas.some((f) => f.pj > 0)) return null;
  const dupla = evento.modalidad === "DUPLA_FIJA";
  return (
    <>
      <button
        className="mb-6 flex w-full items-center gap-4 rounded-3xl border border-neon/30 bg-gradient-to-r from-neon/20 via-neon/10 to-transparent p-4 text-left transition hover:border-neon/60"
        onClick={() => setAbierta(true)}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-neon text-noche">
          <Download className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold">Descarga tu imagen del podio</span>
          <span className="block text-sm text-white/60">Publícala en tus redes y etiqueta a @{instagram}</span>
        </span>
      </button>
      <Hoja abierta={abierta} onClose={() => setAbierta(false)} titulo={dupla ? "¿Cuál es tu dupla?" : "¿Quién eres?"} sub="Elige tu nombre para armar tu imagen." ancho="max-w-lg">
        <Selector evento={evento} tabla={tabla} />
      </Hoja>
    </>
  );
}

function Selector({ evento, tabla }: { evento: EventoAmericano; tabla: TablaPosiciones }) {
  const [elegida, setElegida] = useState<FilaPosicion | null>(null);
  if (elegida) return <Vista evento={evento} tabla={tabla} fila={elegida} onVolver={() => setElegida(null)} />;
  return (
    <ul className="space-y-2">
      {tabla.filas.map((f) => (
        <li key={f.entidadId}>
          <button className="glass flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/10" onClick={() => setElegida(f)}>
            <Posicion n={f.posicion} />
            <AvatarPareja nombres={nombresDeFila(evento, f)} fotos={f.fotoUrls} dupla={f.fotoDupla} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.nombre}</span>
            <span className="font-display font-bold tabular text-neon">{f.puntos}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Vista({ evento, tabla, fila, onVolver }: { evento: EventoAmericano; tabla: TablaPosiciones; fila: FilaPosicion; onVolver: () => void }) {
  const instagram = useAmericanos((s) => s.club.contacto.instagram) || INSTAGRAM_POR_DEFECTO;
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState(false);
  const nombres = nombresCompletosDeFila(evento, fila);
  const titulo = tituloPuesto(evento, fila, tabla.filas.length);
  const archivo = `${evento.nombre}-${nombres.join("-")}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + ".png";

  useEffect(() => {
    let url = "";
    let vivo = true;
    generarImagenPodio({ evento, fila, nombres, total: tabla.filas.length, instagram })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (vivo) setImg({ blob, url });
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento.id, fila.entidadId, instagram]);

  const texto = `${titulo} en ${evento.nombre} 🎾 @${instagram}`;
  const file = img ? new File([img.blob], archivo, { type: "image/png" }) : null;
  const puedeCompartir = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  async function compartir() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: evento.nombre, text: texto });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("No se pudo compartir. Descárgala y súbela desde tu galería.", "error");
    }
  }

  return (
    <div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl bg-white/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={`${titulo} · ${nombres.join(" y ")}`} className="size-full object-contain" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            {error ? "No se pudo armar la imagen." : <Loader2 className="size-8 animate-spin text-neon" />}
          </span>
        )}
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-white/55">
        <AtSign className="mt-0.5 size-3.5 shrink-0 text-neon" />
        <span>
          Súbela a tu historia o a tu perfil y etiqueta a <b className="text-white">@{instagram}</b>.
        </span>
      </p>
      <div className={clsx("mt-4 grid gap-2", puedeCompartir ? "grid-cols-2" : "grid-cols-1")}>
        {puedeCompartir && (
          <button className="btn-neon" onClick={compartir}>
            <Share2 className="size-4" /> Compartir
          </button>
        )}
        <a className={clsx(puedeCompartir ? "btn-ghost" : "btn-neon", !img && "pointer-events-none opacity-50")} href={img?.url} download={archivo} aria-disabled={!img}>
          <Download className="size-4" /> Descargar
        </a>
      </div>
      <button className="mt-3 w-full text-center text-xs text-white/50 hover:text-white" onClick={onVolver}>
        No soy yo, elegir otro nombre
      </button>
    </div>
  );
}
