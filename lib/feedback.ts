"use client";

/** Pequeños detalles táctiles/sonoros que hacen la app más amigable en pista. */
export function vibrar(patron: number | number[] = 12) {
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* no soportado */
  }
}

let ctx: AudioContext | null = null;
export function sonar(tipo: "tap" | "ok" | "alarma" = "tap") {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    const notas = tipo === "alarma" ? [880, 660, 880, 660, 880] : tipo === "ok" ? [660, 990] : [520];
    notas.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.16;
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(tipo === "tap" ? 0.05 : 0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.15);
    });
  } catch {
    /* audio bloqueado */
  }
}

export function formatoReloj(seg: number) {
  const s = Math.max(0, Math.abs(Math.floor(seg)));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
