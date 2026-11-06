"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CLAVE = "lamarina-setup-borrador";
/** Un borrador de más de 12 h se considera abandonado y no se recupera. */
const VIGENCIA_MS = 12 * 3600_000;

function leer(): Record<string, unknown> {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Record<string, unknown>;
    // Un borrador viejo (ej. de otro día) no se recupera: si no, el americano
    // nuevo saldría con la fecha, los jugadores y las reglas de aquella vez.
    if (typeof b._t === "number" && Date.now() - b._t > VIGENCIA_MS) {
      localStorage.removeItem(CLAVE);
      return {};
    }
    // La fecha nunca queda en un día que ya pasó (ej. borrador de anoche).
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (typeof b.fecha === "string" && b.fecha < hoy) b.fecha = hoy;
    return b;
  } catch {
    return {};
  }
}

/**
 * useState que se guarda en un borrador local: si la app se cierra o se
 * recarga en medio del setup, al volver se recupera todo lo cargado.
 */
export function useBorrador<T>(campo: string, inicial: T | (() => T)) {
  const [valor, setValor] = useState<T>(inicial);
  const listo = useRef(false);

  useEffect(() => {
    const b = leer();
    if (campo in b) setValor(b[campo] as T);
    listo.current = true;
  }, [campo]);

  useEffect(() => {
    if (!listo.current) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), [campo]: valor, _t: Date.now() }));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [campo, valor]);

  return [valor, setValor] as const;
}

export function hayBorrador(): boolean {
  const b = leer() as { jugadores?: unknown[]; parejas?: unknown[]; _t?: number };
  // Borradores de más de 12 h se consideran abandonados.
  return !!b._t && Date.now() - b._t < VIGENCIA_MS && ((b.jugadores?.length ?? 0) > 0 || (b.parejas?.length ?? 0) > 0);
}

export function useLimpiarBorrador() {
  return useCallback(() => {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada */
    }
  }, []);
}
