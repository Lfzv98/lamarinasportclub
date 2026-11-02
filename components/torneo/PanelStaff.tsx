"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarClock, ClipboardCheck, ClipboardList, Flag, Gauge, LayoutDashboard, Settings, Ticket, Truck, Users } from "lucide-react";
import { pendientesFvp } from "@/lib/ranking/fvp";
import { todosLosPartidos } from "@/lib/torneo/torneo";
import type { Torneo } from "@/types/torneo";

export type SeccionStaff = "PREVIA" | "CONTROL" | "LOGISTICA";

interface Destino {
  ruta: string;
  label: string;
  icon: typeof Users;
  /** Número para destacar (pendientes de esa pantalla). */
  badge?: number;
}

/** Sección del panel del staff a la que pertenece cada pantalla del torneo. */
export function seccionDe(pathname: string, base: string): SeccionStaff | null {
  const r = pathname.slice(base.length) || "/";
  if (r.startsWith("/categorias") || r.startsWith("/inscripciones") || r.startsWith("/ajustes")) return "PREVIA";
  if (r === "/" || r.startsWith("/mesa")) return "CONTROL";
  if (r.startsWith("/programacion") || r.startsWith("/arbitros")) return "LOGISTICA";
  return null;
}

/**
 * Panel del staff en tres bloques, para no mezclar tareas bajo presión:
 * 1) Gestión previa: pagos, inscritos, cupos, sorteo y publicación.
 * 2) Centro de control: mesa técnica, pistas, resultados por revisar y clima.
 * 3) Logística: horarios, reacomodo «Desde ahora», turnos de árbitros y avisos a jugadores.
 * El árbitro principal solo ve el Centro de control.
 */
export function PanelStaff({ torneo, esStaff, esMesa }: { torneo: Torneo; esStaff: boolean; esMesa: boolean }) {
  const pathname = usePathname();
  const base = `/torneos/${torneo.id}`;
  if (!esStaff && !esMesa) return null;
  const actual = seccionDe(pathname, base);

  const partidos = todosLosPartidos(torneo).filter((p) => !p.bye);
  const porRevisar = partidos.filter((p) => p.estado === "FINALIZADO" && p.revision?.estado === "POR_REVISAR").length;
  const cambios = partidos.filter((p) => p.estado === "PENDIENTE" && p.cambioHorario).length;
  const fvp = torneo.validarFvp === false ? 0 : torneo.categorias.reduce((s, c) => s + pendientesFvp(torneo, c.categoria.id).length, 0);
  const sinSorteo = torneo.categorias.filter((c) => !c.cuadro || !c.cuadro.publicado).length;
  const publicado = torneo.categorias.some((c) => c.cuadro?.publicado);
  const sinTurnos = publicado && !(torneo.arbitros?.turnos?.length ?? 0) ? 1 : 0;

  const secciones: { id: SeccionStaff; titulo: string; corto: string; sub: string; icon: typeof Users; badge: number; destinos: Destino[] }[] = [
    {
      id: "PREVIA",
      titulo: "Gestión previa",
      corto: "Previa",
      sub: "Pagos, cupos y sorteo",
      icon: ClipboardList,
      badge: fvp,
      destinos: [
        { ruta: "/categorias", label: "Inscritos · cupos · sorteo", icon: Users, badge: fvp + (torneo.estado === "INSCRIPCION" ? sinSorteo : 0) },
        { ruta: "/inscripciones", label: "Pagos online", icon: Ticket },
        { ruta: "/ajustes", label: "Ajustes", icon: Settings },
      ],
    },
    {
      id: "CONTROL",
      titulo: "Centro de control",
      corto: "Control",
      sub: "Mesa, pistas y clima",
      icon: Gauge,
      badge: porRevisar,
      destinos: [
        ...(publicado ? [{ ruta: "/mesa", label: "Mesa técnica", icon: ClipboardCheck, badge: porRevisar }] : []),
        { ruta: "", label: "En vivo", icon: LayoutDashboard },
      ],
    },
    {
      id: "LOGISTICA",
      titulo: "Logística",
      corto: "Logística",
      sub: "Horarios, turnos y avisos",
      icon: Truck,
      badge: cambios + sinTurnos,
      destinos: [
        { ruta: "/programacion", label: "Horarios y avisos", icon: CalendarClock, badge: cambios },
        { ruta: "/arbitros", label: "Turnos de árbitros", icon: Flag, badge: sinTurnos },
      ],
    },
  ];
  const visibles = esStaff ? secciones : secciones.filter((s) => s.id === "CONTROL");
  const activa = visibles.find((s) => s.id === actual);

  return (
    <nav className="mb-3" aria-label="Panel del staff" data-panel-staff>
      <div className={clsx("glass grid gap-1 rounded-2xl p-1", visibles.length === 3 ? "grid-cols-3" : "grid-cols-1")}>
        {visibles.map((s) => {
          const on = s.id === actual;
          return (
            <Link
              key={s.id}
              href={`${base}${s.destinos[0].ruta}`}
              className={clsx("relative flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-left transition", on ? "text-noche" : "text-white/70 hover:text-white")}
              data-seccion={s.id}
              aria-current={on ? "page" : undefined}
            >
              {on && <motion.span layoutId="seccion-staff" className="absolute inset-0 rounded-xl bg-neon" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <s.icon className="relative size-4 shrink-0" />
              <span className="relative min-w-0">
                <span className="block truncate text-[13px] font-bold leading-tight sm:hidden">{s.corto}</span>
                <span className="hidden truncate text-sm font-bold leading-tight sm:block">{s.titulo}</span>
                <span className={clsx("hidden truncate text-[11px] leading-tight sm:block", on ? "text-noche/70" : "text-white/45")}>{s.sub}</span>
              </span>
              {s.badge > 0 && (
                <span
                  className={clsx(
                    "absolute -right-1 -top-1.5 z-10 min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold shadow sm:relative sm:right-auto sm:top-auto sm:z-auto sm:ml-auto sm:shadow-none",
                    on ? "bg-noche text-neon" : "bg-amber-300 text-marino-2",
                  )}
                >
                  {s.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {activa && activa.destinos.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {activa.destinos.map((d) => {
            const href = `${base}${d.ruta}`;
            const on = d.ruta === "" ? pathname === base : pathname.startsWith(href);
            return (
              <Link key={d.ruta} href={href} className={clsx("chip shrink-0 !py-1.5", on ? "!border-neon/50 !text-neon" : "text-white/70")} data-destino={d.ruta || "/"}>
                <d.icon className="size-3.5" /> {d.label}
                {!!d.badge && <span className="rounded-full bg-amber-300 px-1.5 text-[10px] font-bold text-marino-2">{d.badge}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
