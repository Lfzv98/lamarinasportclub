"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";

/** Comparte un enlace con la hoja nativa del teléfono (o lo copia). */
export function CompartirButton({ titulo, ruta, className }: { titulo: string; ruta: string; className?: string }) {
  return (
    <button
      className={className ?? "btn-ghost !px-3 !py-2 text-xs"}
      onClick={async () => {
        vibrar(10);
        const url = new URL(ruta, location.origin).toString();
        try {
          if (navigator.share) await navigator.share({ title: titulo, url });
          else {
            await navigator.clipboard.writeText(url);
            toast("Enlace copiado", "info");
          }
        } catch {
          /* cancelado */
        }
      }}
    >
      <Share2 className="size-3.5" /> Compartir
    </button>
  );
}
