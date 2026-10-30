"use client";

/**
 * Lo que el asistente deja preparado para una pantalla: se guarda en sessionStorage,
 * la pantalla lo toma una sola vez al abrirse y llena su formulario.
 */
import { useEffect, useRef } from "react";

const CLAVE = "lamarina-asistente-prefill";
const VIGENCIA_MS = 10 * 60_000;

export type DestinoPrefill = "habibi" | "torneo-nuevo" | "torneo-duplas";

export function dejarPrefill(destino: DestinoPrefill, datos: unknown) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ destino, datos, t: Date.now() }));
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function tomarPrefill<T>(destino: DestinoPrefill): T | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(CLAVE) ?? "null") as { destino: string; datos: T; t: number } | null;
    if (!p || p.destino !== destino) return null;
    sessionStorage.removeItem(CLAVE);
    return Date.now() - p.t < VIGENCIA_MS ? p.datos : null;
  } catch {
    return null;
  }
}

/** Aviso a la pantalla que ya está abierta: el asistente le dejó algo nuevo. */
export const EVENTO_PREFILL = "lamarina-asistente-prefill";
export const avisarPrefill = () => window.dispatchEvent(new Event(EVENTO_PREFILL));

/** Al montar la pantalla (o si ya estaba abierta y llega algo nuevo), aplica lo que dejó el asistente. */
export function usePrefill<T>(destino: DestinoPrefill, aplicar: (datos: T) => void) {
  const fn = useRef(aplicar);
  fn.current = aplicar;
  useEffect(() => {
    const tomar = () => {
      const datos = tomarPrefill<T>(destino);
      if (datos) fn.current(datos);
    };
    tomar();
    window.addEventListener(EVENTO_PREFILL, tomar);
    return () => window.removeEventListener(EVENTO_PREFILL, tomar);
  }, [destino]);
}
