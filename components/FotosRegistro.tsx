"use client";

import { Camera, X } from "lucide-react";
import { AvatarPareja } from "@/components/Avatar";
import { TomarFoto } from "@/components/Foto";
import { useFotosRegistro } from "@/lib/fotosRegistro";

/** Cámara junto a la casilla del nombre: la foto queda lista para el que se agregue con Enter. */
export function BotonFoto({ foto, onFoto, etiqueta }: { foto: string | null; onFoto: (img: string | null) => void; etiqueta: string }) {
  if (foto)
    return (
      <span className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt={etiqueta} className="size-11 rounded-xl object-cover ring-2 ring-neon" />
        <button type="button" className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-coral text-white" onClick={() => onFoto(null)} aria-label="Quitar foto">
          <X className="size-3" />
        </button>
      </span>
    );
  return (
    <TomarFoto className="btn-ghost !h-11 shrink-0 border-neon/40 !px-3 text-neon" etiqueta={etiqueta} onFoto={onFoto}>
      <Camera className="size-5" /> <span className="text-sm font-semibold">Foto</span>
    </TomarFoto>
  );
}

/** Avatar de un jugador o dupla ya inscritos: tócalo para tomar o cambiar la foto. */
export function FotoDelRegistro({ id, nombres }: { id: string; nombres: string[] }) {
  const foto = useFotosRegistro((s) => s.fotos[id]);
  const poner = useFotosRegistro((s) => s.poner);
  return (
    <TomarFoto className="relative shrink-0 rounded-full" etiqueta={`Foto de ${nombres.join(" y ")}`} onFoto={(img) => poner(id, img)}>
      <AvatarPareja nombres={nombres} dupla={nombres.length > 1 ? foto : undefined} fotos={nombres.length > 1 ? undefined : [foto]} size={32} />
      {!foto && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-lima text-marino-2 ring-2 ring-fondo">
          <Camera className="size-3" />
        </span>
      )}
    </TomarFoto>
  );
}

export function AvisoFotos() {
  return (
    <p className="mt-3 flex items-start gap-1.5 px-1 text-xs text-white/40">
      <Camera className="mt-0.5 size-3.5 shrink-0" />
      <span>Foto opcional: toca <b className="text-white/70">Foto</b> antes de agregar, o la cara de alguien ya inscrito. Sale en la TV del club y en el ranking del QR. Pide permiso antes de tomarla.</span>
    </p>
  );
}
