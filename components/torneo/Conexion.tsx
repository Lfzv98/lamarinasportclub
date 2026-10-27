"use client";

import clsx from "clsx";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useTorneos } from "@/lib/torneosStore";

/**
 * Estado de la conexión de este dispositivo: sin señal la app sigue funcionando, guarda lo que
 * se anota y lo sube solo al volver. Aquí se ve cuántos cambios esperan. `siempre` muestra
 * también el estado "En línea" (mesa técnica).
 */
export function EstadoConexion({ siempre = false, className }: { siempre?: boolean; className?: string }) {
  // Mientras se anota siempre hay un punto subiendo: solo se avisa si algo espera más de 8 s.
  const [demora, setDemora] = useState(false);
  const offlineStore = useTorneos((s) => s.offline);
  const pendientes = useTorneos((s) => s.pendientes.length + s.marcadoresPendientes.length + s.accionesPendientes.length);
  const [sinRed, setSinRed] = useState(false);
  useEffect(() => {
    const actualizar = () => setSinRed(!navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  useEffect(() => {
    if (!pendientes) return setDemora(false);
    const t = setTimeout(() => setDemora(true), 8000);
    return () => clearTimeout(t);
  }, [pendientes > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const offline = sinRed || offlineStore;
  if (!offline && !(pendientes && demora) && !siempre) return null;
  const texto = offline
    ? `Sin conexión${pendientes ? ` · ${pendientes} ${pendientes === 1 ? "cambio guardado" : "cambios guardados"} por subir` : ""}`
    : pendientes
      ? `Subiendo ${pendientes} ${pendientes === 1 ? "cambio" : "cambios"}…`
      : "En línea";
  const Icono = offline ? CloudOff : pendientes ? RefreshCw : Wifi;
  return (
    <button
      type="button"
      onClick={() => useTorneos.getState().sincronizar()}
      title={offline ? "La app sigue funcionando: todo se sube solo al volver la señal. Toca para reintentar." : "Toca para sincronizar ahora"}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        offline ? "bg-amber-300/15 text-amber-200" : pendientes ? "bg-cielo/15 text-cielo" : "bg-neon/10 text-neon",
        className,
      )}
      data-conexion={offline ? "offline" : pendientes ? "subiendo" : "ok"}
    >
      <Icono className={clsx("size-3.5", !offline && pendientes > 0 && "animate-spin")} /> {texto}
    </button>
  );
}
