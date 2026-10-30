import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BotonWhatsApp } from "@/components/Marcas";
import { PieDePagina } from "@/components/PieDePagina";

export interface SeccionLegal {
  id: string;
  titulo: string;
  contenido: React.ReactNode;
}

/**
 * Marco de las páginas legales: título, fecha, "en 30 segundos" con lo esencial, índice y
 * secciones numeradas con ancla (#fotos, #derechos…), y al final a quién escribir.
 */
export function PaginaLegal({
  titulo,
  vigencia,
  resumen,
  secciones,
}: {
  titulo: string;
  vigencia: string;
  resumen: string[];
  secciones: SeccionLegal[];
}) {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/" className="btn-ghost mt-3 !px-3 text-sm">
          <ArrowLeft className="size-4" /> Inicio
        </Link>
        <p className="label mt-8 !text-neon">Legal · La Marina Sport Club</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{titulo}</h1>
        <p className="mt-3 text-sm text-white/45">Última actualización: {vigencia}</p>

        <section aria-label="En 30 segundos" className="glass mt-8 rounded-3xl p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon">En 30 segundos</p>
          <ul className="mt-3 space-y-2.5">
            {resumen.map((r) => (
              <li key={r} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neon" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label="Contenido" className="mt-8 flex flex-wrap gap-2">
          {secciones.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="chip hover:border-neon/40 hover:text-white">
              {i + 1}. {s.titulo}
            </a>
          ))}
        </nav>

        <article className="legal mt-6 divide-y divide-white/[0.06]">
          {secciones.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 py-7">
              <h2 className="flex items-baseline gap-3">
                <span className="font-display text-sm tabular-nums text-neon">{String(i + 1).padStart(2, "0")}</span>
                {s.titulo}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/70">{s.contenido}</div>
            </section>
          ))}
        </article>

        <section className="glass mb-4 mt-6 flex flex-col items-start gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-display text-lg font-bold">¿Alguna pregunta?</p>
            <p className="text-sm text-white/55">Te responde el equipo del Club.</p>
          </div>
          <BotonWhatsApp texto="Atención al cliente" atencion />
        </section>
      </div>
      <PieDePagina />
    </main>
  );
}
