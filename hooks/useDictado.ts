"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Lo mínimo de la Web Speech API que usamos (Chrome, Edge, Safari; no Firefox). */
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type ConstructorReconocedor = new () => Reconocedor;

function constructor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORES: Record<string, string> = {
  "not-allowed": "Permite el micrófono para dictar (candado de la barra de direcciones).",
  "service-not-allowed": "Este navegador no deja dictar. Usa el micrófono del teclado.",
  "audio-capture": "No encuentro un micrófono.",
  network: "El dictado necesita internet.",
};

/**
 * Dictado por voz con el reconocimiento del propio navegador (gratis, en español).
 * `alTerminar` recibe todo lo dicho cuando el staff toca parar o se corta solo.
 */
export function useDictado(alTerminar: (texto: string) => void) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const final = useRef("");
  const cb = useRef(alTerminar);
  cb.current = alTerminar;

  useEffect(() => setSoportado(!!constructor()), []);
  useEffect(() => () => rec.current?.abort(), []);

  const empezar = useCallback(() => {
    const C = constructor();
    if (!C || rec.current) return;
    const r = new C();
    r.lang = "es-VE";
    r.continuous = true;
    r.interimResults = true;
    final.current = "";
    setParcial("");
    setError(null);
    r.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final.current += (final.current ? " " : "") + t.trim();
        else interino += t;
      }
      setParcial([final.current, interino.trim()].filter(Boolean).join(" "));
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORES[e.error] ?? "No se pudo dictar. Intenta de nuevo.");
    };
    r.onend = () => {
      rec.current = null;
      setEscuchando(false);
      const texto = final.current.trim();
      setParcial("");
      if (texto) cb.current(texto);
    };
    try {
      r.start();
      rec.current = r;
      setEscuchando(true);
    } catch {
      setError("No se pudo abrir el micrófono.");
    }
  }, []);

  const parar = useCallback(() => rec.current?.stop(), []);

  return { soportado, escuchando, parcial, error, empezar, parar };
}
