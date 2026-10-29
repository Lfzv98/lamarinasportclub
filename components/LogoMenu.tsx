"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Home, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { useAmericanos } from "@/lib/store";

/**
 * Logo de La Marina arriba a la derecha: al pasar el cursor (o tocarlo en celular y tablet)
 * abre un menú flotante con "Volver a inicio" (los módulos) y "Cerrar sesión de staff".
 */
export function LogoMenu({ className }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const cerrarT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const staff = useAmericanos((s) => s.staff);
  const logout = useAmericanos((s) => s.logout);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      window.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const entrar = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(cerrarT.current);
    setAbierto(true);
  };
  const salir = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cerrarT.current = setTimeout(() => setAbierto(false), 250);
  };

  return (
    <div ref={caja} className={clsx("relative shrink-0", className)} onPointerEnter={entrar} onPointerLeave={salir}>
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-label="Menú de La Marina" aria-expanded={abierto} aria-haspopup="menu" className="block rounded-xl">
        <Logo compacto />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute right-0 top-full z-[70] mt-2 w-60 rounded-2xl p-1.5 shadow-2xl"
          >
            <Link role="menuitem" href="/" onClick={() => setAbierto(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-white/10">
              <Home className="size-4 text-neon" /> Volver a inicio
            </Link>
            {staff && (
              <button
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-coral hover:bg-white/10"
                onClick={async () => {
                  setAbierto(false);
                  if (!confirm("¿Cerrar sesión de staff en este dispositivo?")) return;
                  await logout();
                }}
              >
                <LogOut className="size-4" /> Cerrar sesión de staff
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
