"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";
import { vibrar } from "@/lib/feedback";

/** Campo con etiqueta, ícono opcional y mensaje de error debajo. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  opcional,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: React.ReactNode;
  opcional?: boolean;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-white/80">
        <span>{etiqueta}</span>
        {opcional && <span className="text-[11px] font-medium text-white/40">Opcional</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1.5 text-xs font-medium text-coral">{error}</p> : ayuda ? <div className="mt-1.5 text-xs text-white/50">{ayuda}</div> : null}
    </div>
  );
}

export function Entrada({ icono: Icono, invalido, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { icono?: React.ComponentType<{ className?: string }>; invalido?: boolean }) {
  return (
    <div className="relative">
      {Icono && <Icono className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/40" />}
      <input {...p} aria-invalid={invalido || undefined} className={clsx("input !rounded-2xl !py-3.5 text-[15px]", Icono && "!pl-11", invalido && "!border-coral/70", className)} />
    </div>
  );
}

const COLUMNAS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/** Botones de opción (talla, lado, género): uno elegido, con indicador animado. */
export function Opciones<T extends string>({
  opciones,
  valor,
  onChange,
  invalido,
  columnas,
}: {
  opciones: { id: T; label: React.ReactNode }[];
  valor?: T | null;
  onChange: (v: T) => void;
  invalido?: boolean;
  columnas?: string;
}) {
  const grupo = useId();
  return (
    <div role="radiogroup" className={clsx("grid gap-2", columnas ?? COLUMNAS[opciones.length] ?? "grid-cols-3 min-[400px]:grid-cols-6")}>
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => {
              vibrar(6);
              onChange(o.id);
            }}
            className={clsx(
              "relative h-12 rounded-2xl border text-sm font-semibold transition active:scale-[0.97]",
              activo ? "border-lima/70 text-marino-2" : invalido ? "border-coral/50 bg-white/[0.04] text-white/70" : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25",
            )}
          >
            {activo && <motion.span layoutId={`op-${grupo}`} className="absolute inset-0 rounded-2xl bg-lima" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Dato de pago con botón de copiar (teléfono, cuenta, correo…). */
export function DatoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!valor.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          vibrar(10);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        } catch {
          /* sin portapapeles */
        }
      }}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/25 active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{etiqueta}</span>
        <span className="block truncate font-display text-[15px] font-semibold tabular">{valor}</span>
      </span>
      <span className={clsx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition", copiado ? "bg-neon/20 text-neon" : "bg-white/5 text-white/60")}>
        {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copiado ? "Copiado" : "Copiar"}
      </span>
    </button>
  );
}

/** Ícono de WhatsApp (Lucide no trae marcas). */
export function IconoWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

export function IconoInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
