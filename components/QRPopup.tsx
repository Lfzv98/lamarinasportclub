"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QrCode, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QR } from "@/components/QR";
import { vibrar } from "@/lib/feedback";
import type { EventoAmericano } from "@/types/americano";

/** Enlace público del ranking de un evento (lo que abre el QR). */
export function useUrlRanking(id: string) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${location.origin}/evento/${id}/tabla`), [id]);
  return url;
}

/** QR a pantalla completa: grande, con mucho contraste y fácil de escanear desde lejos. */
export function QRPopup({ evento, abierto, onClose }: { evento: EventoAmericano; abierto: boolean; onClose: () => void }) {
  const url = useUrlRanking(evento.id);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierto, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {abierto && url && (
        <motion.div
          className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center gap-5 bg-noche/95 p-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label="Código QR del ranking"
        >
          <button className="btn-ghost absolute right-4 top-[max(1rem,env(safe-area-inset-top))] !p-3" onClick={onClose} aria-label="Cerrar QR">
            <X className="size-6" />
          </button>
          <p className="text-center text-sm font-bold uppercase tracking-[0.25em] text-neon">Escanea para ver el ranking</p>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="rounded-[2rem] bg-white p-4 shadow-[0_0_80px_-10px_rgba(127,227,2,0.55)] sm:p-6"
          >
            <QR texto={url} size="min(78vw, 62dvh)" />
          </motion.div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold">{evento.nombre}</p>
            <p className="mt-1 break-all text-sm text-white/45">{url.replace(/^https?:\/\//, "")}</p>
          </div>
          <p className="text-xs text-white/35">Toca en cualquier parte para cerrar</p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Botón con ícono de QR que abre el QR grande. */
export function QRBoton({ evento, className }: { evento: EventoAmericano; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        className={className ?? "btn-ghost !p-2.5"}
        onClick={() => {
          vibrar(10);
          setAbierto(true);
        }}
        aria-label="Mostrar QR del ranking"
      >
        <QrCode className="size-5" />
      </button>
      <QRPopup evento={evento} abierto={abierto} onClose={() => setAbierto(false)} />
    </>
  );
}
