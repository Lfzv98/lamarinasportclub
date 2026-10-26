import { notFound } from "next/navigation";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";

/** Tenis solo existe en los clubes que lo tienen encendido (ver lib/tenis/activo.ts). */
export default function TenisLayout({ children }: { children: React.ReactNode }) {
  if (!TENIS_ACTIVO) notFound();
  return children;
}
