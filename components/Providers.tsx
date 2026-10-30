"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { useAmericanos } from "@/lib/store";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";
import { useTenis } from "@/lib/tenisStore";
import { useTorneos } from "@/lib/torneosStore";
import { Toaster } from "./ui/Toaster";
import { StaffLogin } from "./StaffLogin";
import { GuardiaSoloRanking } from "./SoloRanking";
import { FirmaGlobal } from "./FirmaGlobal";
import { Asistente } from "./asistente/Asistente";

const INTERVALO_SYNC_MS = 8000;

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Promise.resolve()
      .then(() => useAmericanos.persist.rehydrate())
      .catch(() => undefined)
      .finally(() => {
        useAmericanos.setState({ hidratado: true });
        useAmericanos.getState().cargarStaff().finally(() => {
          useAmericanos.getState().sincronizar();
          useTorneos.getState().sincronizar();
          if (TENIS_ACTIVO) useTenis.getState().sincronizar();
        });
      });
    Promise.resolve()
      .then(() => useTorneos.persist.rehydrate())
      .catch(() => undefined)
      .finally(() => useTorneos.setState({ hidratado: true }));
    Promise.resolve()
      .then(() => useTenis.persist.rehydrate())
      .catch(() => undefined)
      .finally(() => useTenis.setState({ hidratado: true }));
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      useAmericanos.getState().sincronizar();
      useTorneos.getState().sincronizar();
      if (TENIS_ACTIVO) useTenis.getState().sincronizar();
    }, INTERVALO_SYNC_MS);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => clearInterval(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <FirmaGlobal />
      <Asistente />
      <StaffLogin />
      <GuardiaSoloRanking />
      <Toaster />
    </MotionConfig>
  );
}
