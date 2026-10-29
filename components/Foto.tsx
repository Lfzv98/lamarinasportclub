"use client";

import clsx from "clsx";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { comprimirFoto } from "@/lib/fotos";

/**
 * Abre la cámara trasera (o la galería en un computador), comprime la foto y la entrega.
 * `children` es lo que se toca; si no hay, un botón con ícono de cámara.
 */
export function TomarFoto({
  onFoto,
  className,
  children,
  etiqueta = "Tomar foto",
}: {
  onFoto: (dataUrl: string) => Promise<void> | void;
  className?: string;
  children?: React.ReactNode;
  etiqueta?: string;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [menu, setMenu] = useState(false);

  async function recibir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setTrabajando(true);
    try {
      vibrar(10);
      await onFoto(await comprimirFoto(f));
    } catch {
      toast("No se pudo leer la foto. Prueba otra vez o elígela de la galería.", "error");
    } finally {
      setTrabajando(false);
    }
  }

  const abrir = (input: React.RefObject<HTMLInputElement | null>) => {
    setMenu(false);
    input.current?.click();
  };

  return (
    <>
      <button
        type="button"
        className={clsx("relative", className ?? "btn-ghost")}
        onClick={() => {
          // En computador no hay cámara del teléfono: abre el selector de archivos directo.
          // En celular y tablet se elige: cámara o galería (si la cámara se queda en negro, la galería siempre funciona).
          if (window.matchMedia?.("(pointer: coarse)").matches) setMenu(true);
          else galeria.current?.click();
        }}
        aria-label={etiqueta}
        disabled={trabajando}
      >
        {children ?? (
          <>
            <Camera className="size-4" /> {etiqueta}
          </>
        )}
        {trabajando && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/50">
            <Loader2 className="size-6 animate-spin text-white" />
          </span>
        )}
      </button>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={recibir} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={recibir} aria-label={`${etiqueta} desde la galería`} />
      {menu &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center tema-noche sm:items-center" role="dialog" aria-modal aria-label={etiqueta}>
            <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar" onClick={() => setMenu(false)} />
            <div className="glass-strong relative m-3 w-full max-w-sm rounded-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="mb-3 text-center font-display text-lg font-bold">{etiqueta}</p>
              <div className="grid gap-2">
                <button className="btn-neon" onClick={() => abrir(camara)}>
                  <Camera className="size-5" /> Tomar foto con la cámara
                </button>
                <button className="btn-ghost" onClick={() => abrir(galeria)}>
                  <ImageIcon className="size-5" /> Elegir de la galería o archivos
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/50">
                ¿La cámara sale en negro? Cierra otras apps que estén usando la cámara (WhatsApp, Instagram, videollamadas) o
                abre la página en Safari o Chrome en vez de dentro de WhatsApp. También puedes tomar la foto con la cámara normal del
                teléfono y luego tocar “Elegir de la galería”.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Foto de la dupla (horizontal) o, si no hay, sus dos avatares. */
export function FotoDupla({
  url,
  nombres,
  fotos,
  className,
  avatar = 44,
}: {
  url?: string | null;
  nombres: string[];
  fotos?: (string | null | undefined)[];
  className?: string;
  avatar?: number;
}) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombres.join(" y ")} className={clsx("shrink-0 object-cover", className)} />;
  return (
    <span className={clsx("flex shrink-0 items-center justify-center bg-white/[0.04]", className)}>
      <AvatarPareja nombres={nombres} fotos={fotos} size={avatar} />
    </span>
  );
}
