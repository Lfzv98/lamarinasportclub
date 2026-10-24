import clsx from "clsx";

/** Logo oficial de La Marina Sport Club (public/brand/logo.png, fondo transparente). */
export function Logo({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  if (compacto)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/icons/isotipo-256.png" alt="La Marina Sport Club" className={clsx("size-10 rounded-xl ring-1 ring-white/20 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)]", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo.png" alt="La Marina Sport Club" width={800} height={262} className={clsx("h-10 w-auto", className)} />;
}
