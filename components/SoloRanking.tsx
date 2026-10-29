"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAmericanos, useEsStaff } from "@/lib/store";

/**
 * Pantalla pública del QR (ranking y podio): quien la escanea sin ser staff queda solo en esa
 * pantalla. Si intenta abrir otra parte de la app, vuelve al ranking. El staff que necesite
 * entrar desde ese mismo equipo abre cualquier página con `?staff=1` e ingresa su PIN.
 */
const CLAVE = "lm-solo-ranking";

export function marcarSoloRanking(ruta: string) {
  try {
    localStorage.setItem(CLAVE, ruta);
  } catch {}
}

export function GuardiaSoloRanking() {
  const esStaff = useEsStaff();
  const pathname = usePathname();
  const router = useRouter();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);

  useEffect(() => {
    if (esStaff === undefined) return;
    let ruta: string | null = null;
    try {
      ruta = localStorage.getItem(CLAVE);
      if (esStaff) {
        if (ruta) localStorage.removeItem(CLAVE);
        return;
      }
    } catch {
      return;
    }
    if (!ruta || pathname === ruta) return;
    if (new URLSearchParams(location.search).get("staff") === "1") {
      setPedirLogin(true);
      return;
    }
    router.replace(ruta);
  }, [esStaff, pathname, router, setPedirLogin]);

  return null;
}
