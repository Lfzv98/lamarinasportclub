"use client";

import clsx from "clsx";
import { usePathname } from "next/navigation";
import { ByPadelReserve } from "@/components/Marcas";

/** Pantallas que ya llevan su propio pie (inicio y legales) o son de pantalla completa (TV, anotar, imprimir). */
const SIN_FIRMA = [/^\/$/, /^\/privacidad$/, /^\/terminos$/, /\/tv$/, /\/anotar(\/|$)/, /\/pista\/[^/]+$/, /^\/manual\/imprimir$/, /^\/offline$/];
/** Pantallas con barra fija abajo (navegación o "Guardar"): la firma queda por encima de la barra. */
const CON_BARRA = [/^\/evento\/[^/]+(\/[^/]+)?$/, /^\/habibi\/[^/]+$/, /^\/torneos\/(?!ranking$)[^/]+/, /^\/(setup|club)$/, /\/ajustes$/, /\/nuevo$/];

/** Sello "by PadelReserve" al pie de todas las pantallas de la app. */
export function FirmaGlobal() {
  const ruta = usePathname() ?? "/";
  if (SIN_FIRMA.some((r) => r.test(ruta))) return null;
  return (
    <footer
      aria-label="Plataforma"
      className={clsx("flex justify-center px-4 pt-6", CON_BARRA.some((r) => r.test(ruta)) ? "pb-32" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]")}
    >
      <ByPadelReserve />
    </footer>
  );
}
