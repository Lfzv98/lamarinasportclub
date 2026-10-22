import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="size-12 text-neon" />
      <h1 className="font-display text-2xl font-bold">Sin conexión</h1>
      <p className="max-w-sm text-white/60">Tus eventos siguen guardados en este dispositivo. Vuelve al inicio y continúa cargando marcadores.</p>
      <Link href="/" className="btn-neon">Ir al inicio</Link>
    </main>
  );
}
