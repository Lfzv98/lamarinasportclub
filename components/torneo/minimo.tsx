"use client";

import { cerradoOtroDia, SalidaAlInicio, useCargaLista, useHoy } from "@/components/SalidaAlInicio";
import { useEsStaff } from "@/lib/store";
import { useTorneo, useTorneos } from "@/lib/torneosStore";
import type { Torneo } from "@/types/torneo";
import { ClaveGate } from "./TorneoShell";

/** Carga y acceso del torneo sin encabezado ni pestañas (anotador, pantallas de pista y TV). */
export function TorneoShellMinimo({ id, children, pantalla = false }: { id: string; children: (t: Torneo) => React.ReactNode; pantalla?: boolean }) {
  const torneo = useTorneo(id);
  const hidratado = useTorneos((s) => s.hidratado);
  const ultimoSync = useTorneos((s) => s.ultimoSync);
  const esStaff = useEsStaff();
  const listo = useCargaLista(hidratado, !!ultimoSync);
  const hoy = useHoy();
  // Pantallas (TV, pista): terminado otro día o inexistente, vuelve a la página principal.
  if (torneo && pantalla && cerradoOtroDia(torneo.estado === "FINALIZADO", torneo.actualizadoEn, hoy)) return <SalidaAlInicio />;
  if (!torneo)
    return listo ? (
      <SalidaAlInicio />
    ) : (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );
  if (torneo.bloqueado && !esStaff) return <ClaveGate torneo={torneo} />;
  return <>{children(torneo)}</>;
}
