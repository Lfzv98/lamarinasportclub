import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonInstagram, BotonWhatsApp, ByPadelReserve, INSTAGRAM_CLUB, WHATSAPP_VISIBLE } from "@/components/Marcas";

/** Fecha en que se creó la plataforma (primer despliegue). */
const CREADA = "22 de octubre de 2026";

/** Pie de página del club: contacto, reservas por WhatsApp, Instagram y la parte legal. */
/** `firma`: repite el sello "by PadelReserve" en la barra final (en el inicio ya va bajo los módulos). */
export function PieDePagina({ firma = true }: { firma?: boolean }) {
  const anio = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/20">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr] sm:px-6">
        <div>
          <Logo className="!h-12" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Americanos, torneos y ranking de pádel en vivo de La Marina Sport Club.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <BotonWhatsApp />
            <BotonInstagram />
          </div>
        </div>
        <nav aria-label="Legal">
          <p className="label">Legal</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link className="hover:text-neon" href="/privacidad">Política de privacidad</Link></li>
            <li><Link className="hover:text-neon" href="/terminos">Términos y condiciones de uso</Link></li>
            <li><Link className="hover:text-neon" href="/privacidad#fotos">Uso de fotos e imágenes</Link></li>
            <li><Link className="hover:text-neon" href="/privacidad#derechos">Tus derechos sobre tus datos</Link></li>
          </ul>
        </nav>
        <div>
          <p className="label">Contacto</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li>Reservas por WhatsApp: <a className="text-white hover:text-neon" href="https://wa.me/584245968373" target="_blank" rel="noopener noreferrer">{WHATSAPP_VISIBLE}</a></li>
            <li>Instagram: <a className="text-white hover:text-neon" href={`https://www.instagram.com/${INSTAGRAM_CLUB}/`} target="_blank" rel="noopener noreferrer">@{INSTAGRAM_CLUB}</a></li>
            <li>Plataforma en servicio desde el {CREADA}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <p className="text-xs text-white/40">
            © {anio} La Marina Sport Club. Todos los derechos reservados. Marcas, logos y fotos pertenecen a sus dueños.
          </p>
          {firma && <ByPadelReserve />}
        </div>
      </div>
    </footer>
  );
}
