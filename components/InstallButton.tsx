"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Muestra "Instalar app" cuando el navegador ofrece instalar la PWA. */
export function InstallButton() {
  const [evento, setEvento] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvento(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evento) return null;
  return (
    <button
      className="btn-ghost !px-3 !py-2 text-xs"
      onClick={async () => {
        await evento.prompt();
        setEvento(null);
      }}
    >
      <Download className="size-3.5" /> Instalar app
    </button>
  );
}
