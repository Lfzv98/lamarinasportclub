"use client";

import Link from "next/link";

/**
 * El evento todavía no está en este dispositivo ni en el servidor (ej. el
 * servidor se reinició y el celular del staff aún no lo volvió a subir).
 * La app sigue preguntando cada pocos segundos y lo abre sola cuando llega,
 * así que no es un callejón sin salida: el QR o la TV se recuperan solos.
 */
export function EventoBuscando({ volver = true }: { volver?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      <p className="font-display text-2xl font-bold">Buscando el evento…</p>
      <p className="max-w-sm text-sm text-white/60">
        Se abre solo en cuanto esté disponible. Si tarda más de un minuto, pide al staff que abra la app del club en su celular.
      </p>
      {volver && <Link href="/americanos" className="btn-ghost">Volver a Americanos</Link>}
    </main>
  );
}
