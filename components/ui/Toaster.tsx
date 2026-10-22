"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { create } from "zustand";

type Tipo = "ok" | "info" | "error";
interface Toast {
  id: number;
  texto: string;
  tipo: Tipo;
  accion?: { label: string; fn: () => void };
}

const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

const quitar = (id: number) => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

/** Muestra un aviso. Con `accion` (ej. Deshacer) queda visible más tiempo. */
export function toast(texto: string, tipo: Tipo = "ok", accion?: Toast["accion"]) {
  const id = Date.now() + Math.random();
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, texto, tipo, accion }] }));
  setTimeout(() => quitar(id), accion ? 6000 : 2800);
}

const ICONOS = { ok: CheckCircle2, info: Info, error: TriangleAlert };

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icono = ICONOS[t.tipo];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="glass-strong pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl"
            >
              <Icono className={t.tipo === "error" ? "size-4 text-coral" : t.tipo === "info" ? "size-4 text-cielo" : "size-4 text-neon"} />
              {t.texto}
              {t.accion && (
                <button
                  className="ml-2 rounded-lg bg-neon px-2.5 py-1 text-xs font-bold text-noche"
                  onClick={() => {
                    t.accion!.fn();
                    quitar(t.id);
                  }}
                >
                  {t.accion.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
