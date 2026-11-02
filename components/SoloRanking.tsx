"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAmericanos, useEsStaff } from "@/lib/store";

/**
 * Pantalla pública del QR (ranking y podio): quien la escanea sin ser staff queda solo en esa
 * pantalla. Si intenta abrir otra parte de la app, vuelve al ranking. El staff que necesite
 * entrar desde ese mismo equipo abre cualquier página con `?staff=1` e ingresa su PIN.
 *
 * El candado vive solo en la pestaña (sessionStorage): escanear otro QR del club, como el
 * sticker de inscripciones, abre una pestaña nueva y entra normal. Antes vivía en
 * localStorage y dejaba al teléfono atado para siempre a la tabla de un americano viejo.
 * Las inscripciones y «¿Cuándo juego?» (los QR fijos del club) nunca se bloquean.
 */
const CLAVE = "lm-solo-ranking";
const SIEMPRE_LIBRE = /^\/(inscripciones|inscripcion\/[^/]+|cuando-juego)\/?$/;

export function marcarSoloRanking(ruta: string) {
  try {
    sessionStorage.setItem(CLAVE, ruta);
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
      localStorage.removeItem(CLAVE); // candado viejo, de cuando era permanente
      ruta = sessionStorage.getItem(CLAVE);
      if (esStaff) {
        if (ruta) sessionStorage.removeItem(CLAVE);
        return;
      }
    } catch {
      return;
    }
    // Otro QR (otro americano) también es una pantalla pública de ranking: se permite.
    if (!ruta || pathname === ruta || SIEMPRE_LIBRE.test(pathname) || /^\/evento\/[^/]+\/tabla$/.test(pathname)) return;
    if (new URLSearchParams(location.search).get("staff") === "1") {
      setPedirLogin(true);
      return;
    }
    router.replace(ruta);
  }, [esStaff, pathname, router, setPedirLogin]);

  return null;
}
