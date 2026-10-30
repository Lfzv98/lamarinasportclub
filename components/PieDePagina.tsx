import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonInstagram, BotonWhatsApp, ByPadelReserve } from "@/components/Marcas";

/** Fecha en que se creó la plataforma (primer despliegue). */
const CREADA = "22 de octubre de 2026";

/** Pie de página del club: reservas por WhatsApp, Instagram y la parte legal. */
/** `firma`: repite el sello "by PadelReserve" en la barra final (en el inicio ya va bajo los módulos). */
export function PieDePagina({ firma = true }: { firma?: boolean }) {
  const anio = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/20">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div>
          <Logo className="!h-12" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Americanos, torneos y ranking de pádel en vivo de La Marina Sport Club.
          </p>
          {/* Mismo tamaño: dos columnas iguales. */}
          <div className="mt-5 grid max-w-md grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <BotonWhatsApp className="w-full" />
            <BotonInstagram className="w-full" />
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
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <p className="text-xs text-white/40">
            © {anio} La Marina Sport Club · Todos los derechos reservados · En servicio desde el {CREADA}
          </p>
          {firma && <ByPadelReserve />}
        </div>
      </div>
    </footer>
  );
}
