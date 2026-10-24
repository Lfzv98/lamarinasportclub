"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Delete, KeyRound, Loader2, LogIn, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { toast } from "@/components/ui/Toaster";
import { sonar, vibrar } from "@/lib/feedback";
import { useAmericanos } from "@/lib/store";


/** Ingreso del staff: teclado de PIN o usuario de PadelReserve. */
export function StaffLogin() {
  const abierto = useAmericanos((s) => s.pedirLogin);
  const setAbierto = useAmericanos((s) => s.setPedirLogin);
  const metodos = useAmericanos((s) => s.metodosLogin);
  const login = useAmericanos((s) => s.login);
  const LARGO_PIN = Math.min(8, Math.max(4, metodos.pinLargo || 4));
  const [modo, setModo] = useState<"pin" | "cuenta">("pin");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setPin("");
    setError(null);
    setModo(metodos.pin ? "pin" : "cuenta");
  }, [abierto, metodos.pin]);

  async function enviar(datos: { pin: string } | { email: string; password: string }) {
    setCargando(true);
    setError(null);
    const err = await login(datos);
    setCargando(false);
    if (err) {
      setError(err);
      setPin("");
      vibrar([40, 60, 40]);
      return;
    }
    sonar("ok");
    vibrar(20);
    toast("Modo staff activado");
  }

  function tecla(d: string) {
    if (cargando) return;
    vibrar(8);
    const nuevo = (pin + d).slice(0, LARGO_PIN);
    setPin(nuevo);
    setError(null);
    if (nuevo.length === LARGO_PIN) enviar({ pin: nuevo });
  }

  useEffect(() => {
    if (!abierto || modo !== "pin") return;
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-marino-2/60 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAbierto(false)} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Ingreso de staff"
            className="glass-strong fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-sm rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="flex items-start justify-between">
              <Logo compacto />
              <button className="btn-ghost !p-2.5" onClick={() => setAbierto(false)} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">Acceso staff</h2>
            <p className="mt-1 text-sm text-white/50">Solo el staff de La Marina puede crear eventos y cargar marcadores.</p>

            {metodos.pin && metodos.padelreserve && (
              <div className="glass mt-5 flex rounded-xl p-1 text-sm font-semibold">
                {(["pin", "cuenta"] as const).map((m) => (
                  <button key={m} onClick={() => setModo(m)} className={clsx("flex-1 rounded-lg py-2 transition", modo === m ? "bg-neon text-noche" : "text-white/60")}>
                    {m === "pin" ? "PIN del club" : "PadelReserve"}
                  </button>
                ))}
              </div>
            )}

            {modo === "pin" ? (
              <>
                <motion.div
                  className="mt-6 flex justify-center gap-4"
                  animate={error ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {Array.from({ length: LARGO_PIN }, (_, i) => (
                    <span
                      key={i}
                      className={clsx(
                        "size-4 rounded-full border-2 transition",
                        error ? "border-coral bg-coral/40" : i < pin.length ? "border-neon bg-neon shadow-[0_0_12px_rgba(127,227,2,0.7)]" : "border-white/25",
                      )}
                    />
                  ))}
                </motion.div>
                <p className={clsx("mt-3 h-5 text-center text-sm", error ? "text-coral" : "text-white/40")}>
                  {cargando ? <Loader2 className="mx-auto size-4 animate-spin" /> : error ?? `Ingresa el PIN de ${LARGO_PIN} dígitos`}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
                    d === "" ? (
                      <span key={i} />
                    ) : (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => (d === "⌫" ? setPin((p) => p.slice(0, -1)) : tecla(d))}
                        className="glass flex h-16 items-center justify-center rounded-2xl font-display text-2xl font-semibold transition hover:bg-white/10"
                        aria-label={d === "⌫" ? "Borrar" : d}
                      >
                        {d === "⌫" ? <Delete className="size-6" /> : d}
                      </motion.button>
                    ),
                  )}
                </div>
              </>
            ) : (
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar({ email, password });
                }}
              >
                <input className="input" type="email" autoComplete="username" placeholder="Correo de PadelReserve" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="input" type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
                {error && <p className="text-sm text-coral">{error}</p>}
                <button className="btn-neon w-full py-4 text-base" disabled={cargando}>
                  {cargando ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />} Ingresar
                </button>
              </form>
            )}
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/35">
              <KeyRound className="size-3" /> Los jugadores pueden ver el ranking sin ingresar.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
