"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Día local (YYYY-MM-DD) de un instante; sin argumento, hoy. */
export function diaLocal(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Un evento ya cerrado se sigue mostrando todo el día en que terminó (resultados y podio);
 * desde el día siguiente el enlace (TV de la terraza, pantalla de pista) vuelve al inicio.
 */
export function cerradoOtroDia(finalizado: boolean, cierreISO: string | null | undefined, hoy = diaLocal()): boolean {
  if (!finalizado) return false;
  const dia = diaLocal(cierreISO);
  return !!dia && dia < hoy;
}

/** Hoy (YYYY-MM-DD), revisado cada minuto para que una pantalla encendida toda la noche cambie de día sola. */
export function useHoy(): string {
  const [hoy, setHoy] = useState(() => diaLocal());
  useEffect(() => {
    const t = setInterval(() => setHoy(diaLocal()), 60_000);
    return () => clearInterval(t);
  }, []);
  return hoy;
}

/**
 * true cuando ya se puede afirmar que algo "no existe": datos locales cargados y, o bien llegó
 * la primera sincronización, o pasaron unos segundos sin ella (sin internet no se queda girando).
 */
export function useCargaLista(hidratado: boolean, sincronizado: boolean, esperaMs = 8000): boolean {
  const [vencido, setVencido] = useState(false);
  useEffect(() => {
    if (!hidratado || sincronizado) return;
    const t = setTimeout(() => setVencido(true), esperaMs);
    return () => clearTimeout(t);
  }, [hidratado, sincronizado, esperaMs]);
  return hidratado && (sincronizado || vencido);
}

/** Lleva a la página principal de módulos (reemplaza la entrada: "atrás" no regresa al enlace viejo). */
export function useSalirAlInicio(salir: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (salir) router.replace("/");
  }, [salir, router]);
}

/** Pantalla de paso mientras se redirige al inicio (evento inexistente, borrado o de otro día). */
export function SalidaAlInicio() {
  useSalirAlInicio(true);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      <p className="text-sm text-white/50">Volviendo al inicio…</p>
    </main>
  );
}
