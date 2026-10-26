"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronRight,
  CircleDot,
  Flag,
  FlaskConical,
  Home,
  KeyRound,
  LockKeyhole,
  LogOut,
  Medal,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Shuffle,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAmericanos, useEsStaff } from "@/lib/store";

interface Item {
  href: string;
  titulo: string;
  sub?: string;
  Icono: LucideIcon;
  /** Solo staff: sin sesión pide el PIN y, al entrar, abre la sección. */
  staff?: boolean;
}

const SECCIONES: { titulo: string; items: Item[] }[] = [
  {
    titulo: "La app",
    items: [
      { href: "/", titulo: "Inicio", Icono: Home },
      { href: "/americanos", titulo: "Americanos", sub: "Eventos, cuadro vivo y ranking", Icono: Shuffle },
      { href: "/torneos", titulo: "Torneos", sub: "Categorías, llaves y programación", Icono: Trophy },
      { href: "/tenis", titulo: "Tenis", sub: "Cancha dura y arcilla", Icono: CircleDot },
      { href: "/arbitro", titulo: "Árbitros", sub: "La tablet de cada pista", Icono: Flag },
    ],
  },
  {
    titulo: "Staff",
    items: [
      { href: "/setup", titulo: "Nuevo americano", Icono: Plus, staff: true },
      { href: "/torneos/nuevo", titulo: "Nuevo torneo de pádel", Icono: Plus, staff: true },
      { href: "/tenis/nuevo", titulo: "Nuevo torneo de tenis", Icono: Plus, staff: true },
      { href: "/torneos/ranking", titulo: "Ranking FVP", sub: "Lista de atletas federados", Icono: Medal, staff: true },
      { href: "/manual", titulo: "Manual del staff", Icono: BookOpen },
    ],
  },
  {
    titulo: "Ajustes",
    items: [
      { href: "/club#datos-prueba", titulo: "Datos de prueba", sub: "Torneos, americanos y árbitros de ejemplo en un toque", Icono: FlaskConical, staff: true },
      { href: "/club", titulo: "Mi club", sub: "Pistas, horarios y contacto", Icono: Settings, staff: true },
      { href: "/club#arbitros", titulo: "Árbitros del club", sub: "PIN de árbitros y plantel", Icono: Flag, staff: true },
      { href: "/club#claves", titulo: "Claves de torneos", sub: "Acceso de los participantes", Icono: KeyRound, staff: true },
    ],
  },
];

/**
 * Menú de la app (arriba a la derecha): todas las secciones a mano. Lo que es del staff
 * lleva candado; sin sesión pide el mismo PIN del staff y después abre la sección.
 */
export function MenuApp({ className }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const router = useRouter();
  const esStaff = useEsStaff();
  const staff = useAmericanos((s) => s.staff);
  const pedirLogin = useAmericanos((s) => s.pedirLogin);
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const logout = useAmericanos((s) => s.logout);

  // Entró como staff: abre lo que había tocado.
  useEffect(() => {
    if (esStaff && pendiente) {
      router.push(pendiente);
      setPendiente(null);
    }
  }, [esStaff, pendiente, router]);
  // Cerró el PIN sin entrar: se olvida.
  useEffect(() => {
    if (!pedirLogin && !esStaff) setPendiente(null);
  }, [pedirLogin, esStaff]);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  return (
    <>
      <button className={clsx("btn-ghost !p-2.5", className)} onClick={() => setAbierto(true)} aria-label="Menú" title="Menú" aria-expanded={abierto}>
        <Menu className="size-5" />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {abierto && (
              <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menú">
                <motion.button
                  aria-label="Cerrar menú"
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAbierto(false)}
                />
                <motion.nav
                  className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col border-l border-white/10 bg-fondo/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl backdrop-blur-xl"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                >
                  <div className="flex items-center justify-between px-5 pb-3">
                    <p className="font-display text-lg font-bold">La Marina</p>
                    <button className="btn-ghost !p-2" onClick={() => setAbierto(false)} aria-label="Cerrar">
                      <X className="size-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-5 overflow-y-auto px-3">
                    {SECCIONES.map((s) => (
                      <div key={s.titulo}>
                        <p className="label px-2">{s.titulo}</p>
                        <ul className="space-y-1">
                          {s.items.map((it) => {
                            const bloqueado = it.staff && !esStaff;
                            return (
                              <li key={it.href}>
                                <Link
                                  href={it.href}
                                  onClick={(e) => {
                                    setAbierto(false);
                                    if (!bloqueado) return;
                                    e.preventDefault();
                                    setPendiente(it.href);
                                    setPedirLogin(true);
                                  }}
                                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-white/5 active:scale-[0.99]"
                                >
                                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neon">
                                    <it.Icono className="size-5" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-semibold">{it.titulo}</span>
                                    {it.sub && <span className="block truncate text-xs text-white/45">{it.sub}</span>}
                                  </span>
                                  {bloqueado ? <LockKeyhole className="size-4 text-white/35" aria-label="Solo staff" /> : <ChevronRight className="size-4 text-white/25" />}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mx-3 mt-3 border-t border-white/10 pt-3">
                    {staff ? (
                      <button
                        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/5"
                        onClick={() => {
                          if (!confirm("¿Cerrar sesión de staff en este dispositivo?")) return;
                          logout();
                          setAbierto(false);
                        }}
                      >
                        <span className="flex size-10 items-center justify-center rounded-xl bg-neon/10 text-neon">
                          <ShieldCheck className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{staff.nombre}</span>
                          <span className="block text-xs text-white/45">Sesión de staff</span>
                        </span>
                        <LogOut className="size-4 text-white/40" />
                      </button>
                    ) : (
                      <button
                        className="btn-neon w-full"
                        onClick={() => {
                          setAbierto(false);
                          setPedirLogin(true);
                        }}
                      >
                        <LockKeyhole className="size-4" /> Ingresar como staff
                      </button>
                    )}
                  </div>
                </motion.nav>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
