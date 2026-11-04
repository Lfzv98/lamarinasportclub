"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { ConsolaPartido, Vacio } from "@/components/arbitro/Consola";
import { AnotadorGate, useVolverAnotador } from "@/components/torneo/Arbitraje";
import { TorneoShellMinimo } from "@/components/torneo/minimo";
import { partido } from "@/lib/torneo/torneo";
import type { Torneo } from "@/types/torneo";

/**
 * Anotador de un partido (staff desde el En vivo o la mesa, o un árbitro de relevo).
 * Es la misma consola de una sola pantalla que usa la tablet de la pista en /arbitro.
 */
export default function AnotarPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  return (
    <AnotadorGate torneoId={id}>
      <TorneoShellMinimo id={id}>{(t) => <Anotar torneo={t} partidoId={decodeURIComponent(pid)} />}</TorneoShellMinimo>
    </AnotadorGate>
  );
}

function Anotar({ torneo, partidoId }: { torneo: Torneo; partidoId: string }) {
  const router = useRouter();
  const volver = useVolverAnotador(torneo.id);
  const p = partido(torneo, partidoId);
  const atras = (
    <Link href={volver} className="btn-ghost shrink-0 !p-3" aria-label="Volver">
      <ArrowLeft className="size-5" />
    </Link>
  );
  return (
    <main className="mx-auto flex h-dvh max-w-[1600px] flex-col px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3">
      {p ? <ConsolaPartido key={p.id} torneo={torneo} p={p} izquierda={atras} onEnviado={() => router.push(volver)} /> : <Vacio titulo="Partido no encontrado">{atras}</Vacio>}
    </main>
  );
}
