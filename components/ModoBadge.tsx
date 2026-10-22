"use client";

import { Cloud, CloudOff, FlaskConical } from "lucide-react";
import { useAmericanos } from "@/lib/store";

export function ModoBadge() {
  const modo = useAmericanos((s) => s.modo);
  if (!modo) return null;
  if (modo === "SUPABASE")
    return (
      <span className="chip text-neon" title="Conectado a PadelReserve">
        <Cloud className="size-3" /> En línea
      </span>
    );
  if (modo === "OFFLINE")
    return (
      <span className="chip text-coral" title="Sin conexión: los cambios se guardan en este dispositivo">
        <CloudOff className="size-3" /> Sin conexión
      </span>
    );
  return (
    <span className="chip text-cielo" title="Datos de ejemplo (mockData.json). Configura Supabase para producción.">
      <FlaskConical className="size-3" /> Demo
    </span>
  );
}
