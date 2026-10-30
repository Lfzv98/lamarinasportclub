"use client";

import clsx from "clsx";
import { Camera, ImageIcon, Loader2, SwitchCamera, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AvatarPareja } from "@/components/Avatar";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { comprimirFoto } from "@/lib/fotos";

/** Celular o tablet (incluye iPad con teclado o trackpad, que dice ser un Mac). Ahí la cámara del sistema es la más fiable. */
function esMovil() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Siempre ofrece dos caminos: "Abrir cámara" y "Abrir galería".
 * En celular y tablet la cámara es la del sistema; en computador, o si la del sistema sale en negro,
 * se usa la cámara integrada (en vivo dentro de la app). Comprime la foto y la entrega.
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
  const [enVivo, setEnVivo] = useState(false);

  async function entregar(f: File) {
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

  function recibir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void entregar(f);
  }

  // El clic al input va dentro del mismo toque: iOS no abre la cámara si llega después de algo asíncrono.
  const abrirCamara = () => {
    setMenu(false);
    if (esMovil()) camara.current?.click();
    else setEnVivo(true);
  };
  const abrirGaleria = () => {
    setMenu(false);
    setEnVivo(false);
    galeria.current?.click();
  };

  return (
    <>
      <button
        type="button"
        className={clsx("relative", className ?? "btn-ghost")}
        onClick={() => setMenu(true)}
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
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-neon !h-auto flex-col !py-4" onClick={abrirCamara}>
                  <Camera className="size-7" /> Abrir cámara
                </button>
                <button className="btn-ghost !h-auto flex-col !py-4" onClick={abrirGaleria}>
                  <ImageIcon className="size-7" /> Abrir galería
                </button>
              </div>
              {esMovil() && (
                <button
                  className="mt-3 w-full text-center text-xs text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white"
                  onClick={() => {
                    setMenu(false);
                    setEnVivo(true);
                  }}
                >
                  ¿La cámara sale en negro? Usa la cámara integrada
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {enVivo && <CamaraEnVivo titulo={etiqueta} onCerrar={() => setEnVivo(false)} onGaleria={abrirGaleria} onFoto={(f) => { setEnVivo(false); void entregar(f); }} />}
    </>
  );
}

type Estado = "abriendo" | "lista" | "negra" | { error: string };

function mensajeError(e: unknown): string {
  const n = (e as { name?: string })?.name;
  if (n === "NotAllowedError" || n === "SecurityError")
    return "El navegador no dio permiso para usar la cámara. Toca el candado o el ícono de la cámara en la barra de direcciones, permite la cámara y vuelve a intentar.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "Este dispositivo no tiene una cámara disponible.";
  if (n === "NotReadableError" || n === "AbortError")
    return "Otra aplicación está usando la cámara (WhatsApp, Instagram, una videollamada). Ciérrala y vuelve a intentar.";
  return "No se pudo abrir la cámara en este navegador.";
}

/** Cámara en vivo dentro de la app: vista previa, cambiar de cámara y disparar. */
function CamaraEnVivo({
  titulo,
  onFoto,
  onCerrar,
  onGaleria,
}: {
  titulo: string;
  onFoto: (f: File) => void;
  onCerrar: () => void;
  onGaleria: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [frontal, setFrontal] = useState(false);
  const [varias, setVarias] = useState(false);
  const [estado, setEstado] = useState<Estado>("abriendo");

  useEffect(() => {
    let vivo = true;
    let revisar: ReturnType<typeof setTimeout> | undefined;
    setEstado("abriendo");
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado({ error: "Este navegador no permite usar la cámara dentro de la página. Ábrela en Safari o Chrome, o usa la galería." });
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: frontal ? "user" : "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo.current = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        setEstado("lista");
        navigator.mediaDevices
          .enumerateDevices()
          .then((d) => vivo && setVarias(d.filter((x) => x.kind === "videoinput").length > 1))
          .catch(() => undefined);
        // Si tras un momento la imagen sigue negra, se avisa y se ofrece otro camino.
        revisar = setTimeout(() => vivo && video.current && imagenNegra(video.current) && setEstado("negra"), 2500);
      } catch (e) {
        if (vivo) setEstado({ error: mensajeError(e) });
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(revisar);
      flujo.current?.getTracks().forEach((t) => t.stop());
      flujo.current = null;
    };
  }, [frontal]);

  function disparar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (frontal) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => b && onFoto(new File([b], "foto.jpg", { type: "image/jpeg" })), "image/jpeg", 0.92);
  }

  const error = typeof estado === "object" ? estado.error : null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-black tema-noche" role="dialog" aria-modal aria-label={titulo}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="truncate font-display text-base font-bold">{titulo}</p>
        <button className="btn-ghost !p-2.5" onClick={onCerrar} aria-label="Cerrar cámara">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          className={clsx("absolute inset-0 size-full object-contain", frontal && "-scale-x-100")}
        />
        {estado === "abriendo" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </span>
        )}
        {(error || estado === "negra") && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass-strong max-w-sm rounded-3xl p-5 text-center">
              <p className="text-sm leading-relaxed text-white/80">
                {error ??
                  "La cámara está enviando imagen en negro. Revisa que no esté tapada, cierra otras apps que la usen o cambia de cámara."}
              </p>
              <div className="mt-4 grid gap-2">
                {estado === "negra" && varias && (
                  <button className="btn-ghost" onClick={() => setFrontal((f) => !f)}>
                    <SwitchCamera className="size-5" /> Cambiar de cámara
                  </button>
                )}
                {estado === "negra" && (
                  <button className="btn-ghost" onClick={() => setEstado("lista")}>
                    Seguir con esta cámara
                  </button>
                )}
                <button className="btn-neon" onClick={onGaleria}>
                  <ImageIcon className="size-5" /> Abrir galería
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 items-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button className="btn-ghost justify-self-start !p-3" onClick={onGaleria} aria-label="Abrir galería">
          <ImageIcon className="size-6" />
        </button>
        <button
          className="size-[4.5rem] justify-self-center rounded-full border-4 border-white bg-white/20 transition active:scale-90 disabled:opacity-40"
          onClick={disparar}
          disabled={estado !== "lista"}
          aria-label="Tomar foto"
        />
        {varias ? (
          <button className="btn-ghost justify-self-end !p-3" onClick={() => setFrontal((f) => !f)} aria-label="Cambiar de cámara">
            <SwitchCamera className="size-6" />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** ¿La imagen del video es prácticamente negra? */
function imagenNegra(v: HTMLVideoElement) {
  if (!v.videoWidth) return true;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 18;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let suma = 0;
  for (let i = 0; i < d.length; i += 4) suma += d[i] + d[i + 1] + d[i + 2];
  return suma / (d.length / 4) / 3 < 4;
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
