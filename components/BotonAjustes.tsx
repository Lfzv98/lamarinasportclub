"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEsStaff } from "@/lib/store";

/** Botón "Ajustes" del módulo, solo para el staff. */
export function BotonAjustes({ href, titulo }: { href: string; titulo: string }) {
  const esStaff = useEsStaff();
  if (!esStaff) return null;
  return (
    <Link href={href} className="btn-ghost !px-3 !py-2 text-xs" title={titulo} aria-label={titulo}>
      <Settings className="size-4" /> Ajustes
    </Link>
  );
}
