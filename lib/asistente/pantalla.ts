"use client";

/**
 * Lo que la pantalla abierta tiene a medio llenar (ej. las duplas ya cargadas en el
 * Americano Torneo), para que el asistente lo vea y sume en vez de pisar.
 */
import { useEffect } from "react";

let actual: unknown = null;

export const contextoPantalla = () => actual;

export function useContextoPantalla(datos: unknown) {
  const json = JSON.stringify(datos ?? null);
  useEffect(() => {
    actual = JSON.parse(json);
    return () => {
      actual = null;
    };
  }, [json]);
}
