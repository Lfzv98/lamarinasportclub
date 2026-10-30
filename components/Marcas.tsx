import clsx from "clsx";
import { siInstagram, siWhatsapp } from "simple-icons";

/** Contacto oficial del club: WhatsApp de reservas (CRM) e Instagram. */
export const WHATSAPP_RESERVAS = "584245968373";
export const WHATSAPP_VISIBLE = "+58 424 596 8373";
/** WhatsApp de atención al cliente (preguntas, datos personales, reclamos). */
export const WHATSAPP_ATENCION = "584248302078";
export const WHATSAPP_ATENCION_VISIBLE = "+58 424 830 2078";
export const INSTAGRAM_CLUB = "lamarinasportclub";

const Icono = ({ path, className }: { path: string; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d={path} />
  </svg>
);

export const IconoWhatsApp = ({ className }: { className?: string }) => <Icono path={siWhatsapp.path} className={className} />;
export const IconoInstagram = ({ className }: { className?: string }) => <Icono path={siInstagram.path} className={className} />;

/** Botón de WhatsApp (verde oficial): reservas por defecto; `atencion` va a atención al cliente. */
export function BotonWhatsApp({ className, texto = "Reserva tu pista", atencion = false }: { className?: string; texto?: string; atencion?: boolean }) {
  const numero = atencion ? WHATSAPP_ATENCION : WHATSAPP_RESERVAS;
  const mensaje = atencion ? "¡Hola La Marina! Tengo una pregunta." : "¡Hola La Marina! Quiero reservar una pista.";
  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${texto} por WhatsApp`}
      className={clsx("inline-flex items-center gap-2.5 rounded-2xl bg-[#25D366] px-4 py-3 font-semibold text-[#0b1f12] shadow-[0_10px_30px_-12px_rgba(37,211,102,0.9)] transition hover:brightness-105 active:scale-[0.98]", className)}
    >
      <IconoWhatsApp className="size-5" />
      {/* Solo la etiqueta: el número lo abre WhatsApp. */}
      <span className="leading-tight">{texto}</span>
    </a>
  );
}

/** Botón de Instagram con el degradado oficial. */
export function BotonInstagram({ className }: { className?: string }) {
  return (
    <a
      href={`https://www.instagram.com/${INSTAGRAM_CLUB}/`}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "inline-flex items-center gap-2.5 rounded-2xl bg-[linear-gradient(45deg,#feda75_0%,#fa7e1e_25%,#d62976_50%,#962fbf_75%,#4f5bd5_100%)] px-4 py-3 font-semibold text-white shadow-[0_10px_30px_-12px_rgba(214,41,118,0.9)] transition hover:brightness-110 active:scale-[0.98]",
        className,
      )}
    >
      <IconoInstagram className="size-5" />
      <span className="flex flex-col leading-tight">
        <span>Síguenos</span>
        <span className="text-xs font-medium opacity-85">@{INSTAGRAM_CLUB}</span>
      </span>
    </a>
  );
}

/** Firma "by PadelReserve": isotipo PR. y la palabra con la tipografía de la app. */
export function ByPadelReserve({ className }: { className?: string }) {
  return (
    <span
      className={clsx("group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 ", className)}
      aria-label="by PadelReserve"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-[#0b0f1f] font-display text-[13px] font-bold tracking-tight text-white ring-1 ring-neon/40">
        PR<span className="text-neon">.</span>
      </span>
      <span className="text-sm text-white/45">by</span>
      <span className="font-display text-lg font-bold tracking-tight text-white transition group-hover:text-neon">
        Padel<span className="text-neon">Reserve</span>
      </span>
    </span>
  );
}
