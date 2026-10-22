"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { useAmericanos } from "@/lib/store";
import { Toaster } from "./ui/Toaster";

const INTERVALO_SYNC_MS = 8000;

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Promise.resolve()
      .then(() => useAmericanos.persist.rehydrate())
      .catch(() => undefined)
      .finally(() => {
        useAmericanos.setState({ hidratado: true });
        useAmericanos.getState().sincronizar();
      });
    const t = setInterval(() => document.visibilityState === "visible" && useAmericanos.getState().sincronizar(), INTERVALO_SYNC_MS);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => clearInterval(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  );
}
