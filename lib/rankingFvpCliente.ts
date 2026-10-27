"use client";

/**
 * Consulta del ranking FVP desde las pantallas del staff: busca por cédula en
 * /api/ranking-fvp. Cada consulta pide todas las cédulas de la pantalla y guarda la
 * respuesta junto con las cédulas que pidió, así "listo" nunca depende de una caché
 * que otra respuesta pudo vaciar (antes quedaba en "Buscando…" para siempre).
 */
import { useEffect, useMemo, useState } from "react";
import { claveCedula, type BuscarAtleta } from "@/lib/ranking/fvp";
import type { AtletaFvp, ResumenRankingFvp } from "@/types/ranking";

/** Si el servidor no contesta en este tiempo, la dupla queda por verificar y se puede inscribir igual. */
const ESPERA_MS = 8000;

interface Respuesta {
  llave: string;
  resumen: ResumenRankingFvp;
  atletas: Map<string, AtletaFvp | null>;
}

async function pedir(claves: string[], signal: AbortSignal): Promise<Omit<Respuesta, "llave">> {
  const res = await fetch(`/api/ranking-fvp?cedulas=${encodeURIComponent(claves.join(","))}`, { cache: "no-store", signal });
  if (!res.ok) throw new Error(String(res.status));
  const d = (await res.json()) as { resumen: ResumenRankingFvp; atletas: Record<string, AtletaFvp | null> };
  return { resumen: d.resumen, atletas: new Map(Object.entries(d.atletas).map(([c, a]) => [claveCedula(c)!, a])) };
}

export interface ConsultaFvp {
  resumen: ResumenRankingFvp | null;
  /** Buscador para `verificarDupla`; null = no hay lista o no hay conexión. */
  buscar: BuscarAtleta | null;
  /** Todas las cédulas pedidas ya tienen respuesta (o el servidor no contestó). */
  listo: boolean;
  error: boolean;
}

export function useRankingFvp(cedulas: (string | null | undefined)[]): ConsultaFvp {
  const llave = useMemo(() => [...new Set(cedulas.map(claveCedula).filter((c): c is string => !!c))].sort().join(","), [cedulas]);
  const [r, setR] = useState<Respuesta | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const ctl = new AbortController();
    const corte = setTimeout(() => ctl.abort(), ESPERA_MS);
    // Mientras escribe la cédula se espera un poco; la primera vez, no.
    const t = setTimeout(
      () => {
        pedir(llave ? llave.split(",") : [], ctl.signal)
          .then((d) => {
            if (!vivo) return;
            setR({ llave, ...d });
            setFallo(null);
          })
          .catch(() => vivo && setFallo(llave))
          .finally(() => clearTimeout(corte));
      },
      r ? 350 : 0,
    );
    return () => {
      vivo = false;
      clearTimeout(t);
      clearTimeout(corte);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llave]);

  const error = fallo === llave;
  const cargada = !!r?.resumen.cargado && !error;
  return {
    resumen: r?.resumen ?? null,
    buscar: cargada ? (c) => r!.atletas.get(claveCedula(c) ?? "") ?? null : null,
    listo: error || r?.llave === llave,
    error,
  };
}
