"use client";

import { useEffect, useRef, useState } from "react";
import { segundosTranscurridos } from "@/lib/evento";
import { sonar, vibrar } from "@/lib/feedback";
import type { Ronda } from "@/types/americano";

/** Cronómetro de ronda (cuenta regresiva). Suena y vibra una vez al llegar a 0. */
export function useReloj(ronda: Ronda | undefined, duracionMin: number, { alarma = true } = {}) {
  const [ahora, setAhora] = useState(() => Date.now());
  const sonó = useRef<string | null>(null);

  useEffect(() => {
    if (ronda?.estado !== "EN_JUEGO") return;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [ronda?.estado]);

  const total = duracionMin * 60;
  const transcurridos = ronda ? segundosTranscurridos(ronda, ahora) : 0;
  const restantes = total - transcurridos;
  const clave = ronda ? `${ronda.numero}-${ronda.inicioEn}` : null;

  useEffect(() => {
    if (!alarma || !clave || ronda?.estado !== "EN_JUEGO") return;
    if (restantes <= 0 && sonó.current !== clave) {
      sonó.current = clave;
      sonar("alarma");
      vibrar([200, 100, 200, 100, 400]);
    }
  }, [restantes, clave, alarma, ronda?.estado]);

  return {
    transcurridos,
    restantes,
    excedido: restantes < 0,
    progreso: total ? Math.min(1, transcurridos / total) : 0,
    corriendo: ronda?.estado === "EN_JUEGO",
  };
}
