"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useAmericanos, useEsStaff } from "@/lib/store";

/** Muestra el contenido solo al staff; al resto le ofrece ingresar. */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const esStaff = useEsStaff();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);

  useEffect(() => {
    if (esStaff === false) setPedirLogin(true);
  }, [esStaff, setPedirLogin]);

  if (esStaff === undefined)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
      </main>
    );
  if (!esStaff)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <LockKeyhole className="size-12 text-neon" />
        <h1 className="font-display text-2xl font-bold">Solo staff</h1>
        <p className="max-w-sm text-white/60">Esta sección es para el staff de La Marina. Si eres jugador, puedes ver el ranking de cualquier evento desde el inicio.</p>
        <div className="flex gap-3">
          <Link href="/" className="btn-ghost">
            <ArrowLeft className="size-4" /> Inicio
          </Link>
          <button className="btn-neon" onClick={() => setPedirLogin(true)}>
            Ingresar como staff
          </button>
        </div>
      </main>
    );
  return <>{children}</>;
}

/** Chip de sesión: "Soy staff" para entrar, o el nombre con opción de salir. */
export function StaffChip() {
  const staff = useAmericanos((s) => s.staff);
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const logout = useAmericanos((s) => s.logout);
  if (staff === undefined) return null;
  if (!staff)
    return (
      <button className="chip hover:border-neon/40 hover:text-white" onClick={() => setPedirLogin(true)}>
        <LockKeyhole className="size-3" /> Soy staff
      </button>
    );
  return (
    <button
      className="chip border-neon/30 text-neon"
      title={`${staff.nombre} · tocar para salir`}
      onClick={() => confirm("¿Cerrar sesión de staff en este dispositivo?") && logout()}
    >
      <ShieldCheck className="size-3" /> Staff
      <LogOut className="size-3 opacity-60" />
    </button>
  );
}
