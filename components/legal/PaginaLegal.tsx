import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PieDePagina } from "@/components/PieDePagina";

/** Marco común de las páginas legales: título, fecha de vigencia y texto legible. */
export function PaginaLegal({ titulo, vigencia, children }: { titulo: string; vigencia: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/" className="btn-ghost mt-3 !px-3 text-sm">
          <ArrowLeft className="size-4" /> Inicio
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-white/45">Vigente desde el {vigencia}</p>
        <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-white/75">{children}</article>
      </div>
      <PieDePagina />
    </main>
  );
}
