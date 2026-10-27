"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Shuffle, Trash2, Trophy } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { useAmericanos } from "@/lib/store";
import { TENIS_ACTIVO } from "@/lib/tenis/activo";
import { useTenis } from "@/lib/tenisStore";
import { useTorneos } from "@/lib/torneosStore";

type Accion = "torneo" | "americano" | "cargar" | "borrar";

/**
 * Ajustes → Modo prueba (solo staff). Arriba de todo, para no perder tiempo:
 * - "Crear torneo de prueba": 3 categorías con 8 duplas cada una, listo para sortear.
 * - "Crear americano de prueba": 12 jugadores en 3 pistas, listo para empezar.
 * - El paquete completo para enseñar la app y el botón para borrarlo todo. No toca lo real.
 */
export function DatosPrueba({ onCambio }: { onCambio?: () => void }) {
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const router = useRouter();

  async function hacer(accion: Accion) {
    if (
      accion === "borrar" &&
      !confirm("¿Quitar todos los datos de prueba? Se borran los torneos, americanos y árbitros de prueba. Lo tuyo no se toca.")
    )
      return;
    setOcupado(accion);
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!r.ok) return toast(d.error ?? "No se pudo. Revisa la conexión.", "error");
      await Promise.all([
        useAmericanos.getState().sincronizar(),
        useTorneos.getState().sincronizar(),
        TENIS_ACTIVO ? useTenis.getState().sincronizar() : null,
      ]);
      onCambio?.();
      vibrar(20);
      if (accion === "torneo" && d.id) {
        toast("Torneo de prueba listo: 24 duplas inscritas. Toca Sorteo en cada categoría.");
        router.push(`/torneos/${d.id}/categorias`);
      } else if (accion === "americano" && d.id) {
        toast("Americano de prueba listo: 12 jugadores en 3 pistas. ¡A jugar!");
        router.push(`/evento/${d.id}`);
      } else toast(accion === "cargar" ? "Datos de prueba cargados: mira Inicio" : "Datos de prueba borrados");
    } catch {
      toast("Sin conexión. Necesitas internet para esto.", "error");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section id="datos-prueba" className="mt-8 scroll-mt-6">
      <h2 className="label !text-neon">Modo prueba</h2>
      <div className="seleccion space-y-4 rounded-[2rem] border p-5">
        <p className="text-sm text-white/70">
          Crea en un toque un evento con todo lleno, para ensayar sin escribir nombres. Solo lo ves tú (staff) y se borra con un toque.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="btn-neon flex-col !items-start !gap-1 !rounded-3xl !p-4 text-left" disabled={!!ocupado} onClick={() => hacer("torneo")}>
            <span className="flex items-center gap-2 text-base font-bold">
              <Trophy className="size-5" /> {ocupado === "torneo" ? "Creando…" : "Crear torneo de prueba"}
            </span>
            <span className="text-xs font-medium opacity-75">3 categorías · 24 duplas inscritas · listo para sortear</span>
          </button>
          <button className="btn-neon flex-col !items-start !gap-1 !rounded-3xl !p-4 text-left" disabled={!!ocupado} onClick={() => hacer("americano")}>
            <span className="flex items-center gap-2 text-base font-bold">
              <Shuffle className="size-5" /> {ocupado === "americano" ? "Creando…" : "Crear americano de prueba"}
            </span>
            <span className="text-xs font-medium opacity-75">12 jugadores · 3 pistas · 6 rondas · listo para empezar</span>
          </button>
        </div>
        <div className="flex items-start gap-3 border-t border-white/10 pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-neon">
            <FlaskConical className="size-5" />
          </span>
          <p className="text-sm text-white/55">
            <b className="text-white/85">Paquete para enseñar la app:</b> 3 americanos, un torneo de hoy con partidos en juego, la Copa Navidad con inscripciones
            abiertas{TENIS_ACTIVO ? ", 2 torneos de tenis" : ""} y 6 árbitros de ejemplo (código <b className="text-white/85">1234</b>; si no hay PIN de
            árbitros, queda el <b className="text-white/85">2468</b>).
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-ghost !py-3" disabled={!!ocupado} onClick={() => hacer("cargar")}>
            <FlaskConical className="size-4" /> {ocupado === "cargar" ? "Cargando…" : "Cargar paquete completo"}
          </button>
          <button className="btn-ghost !py-3 hover:!text-coral" disabled={!!ocupado} onClick={() => hacer("borrar")}>
            <Trash2 className="size-4" /> {ocupado === "borrar" ? "Borrando…" : "Borrar todo lo de prueba"}
          </button>
        </div>
      </div>
    </section>
  );
}
