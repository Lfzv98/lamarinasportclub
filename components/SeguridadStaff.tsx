"use client";

import clsx from "clsx";
import { CheckCircle2, KeyRound, Loader2, LogOut, Mail, Plus, ShieldCheck, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { vibrar } from "@/lib/feedback";
import { useAmericanos } from "@/lib/store";

interface Acceso {
  en: string;
  ok: boolean;
  metodo: "PIN" | "PADELRESERVE";
  nombre?: string;
  correo?: string;
  dispositivo: string;
  motivo?: string;
}

interface Estado {
  politica: { pinApagado: boolean; correos: string[]; actualizadoEn: string; por?: string };
  accesos: Acceso[];
  padelreserve: boolean;
  pinConfigurado: boolean;
  yo: { nombre: string; metodo: "PIN" | "PADELRESERVE"; correo: string | null };
  puedeCambiar: boolean;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Ajustes → Seguridad del staff: cada persona entra con su usuario de PadelReserve (el del CRM),
 * se puede apagar el PIN compartido, cerrar todas las sesiones y ver quién entró y desde dónde.
 * Solo una sesión con usuario de PadelReserve puede cambiar algo: quien solo sabe el PIN, no.
 */
export function SeguridadStaff() {
  const [e, setE] = useState<Estado | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [correo, setCorreo] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/staff/seguridad", { cache: "no-store" });
      if (r.status === 401) return useAmericanos.setState({ staff: null, pedirLogin: true });
      if (r.ok) setE((await r.json()) as Estado);
    } catch {
      /* sin conexión: se reintenta al volver */
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiar(cuerpo: object, clave: string, ok: string) {
    setOcupado(clave);
    try {
      const r = await fetch("/api/staff/seguridad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 401) useAmericanos.setState({ staff: null, pedirLogin: true });
      if (!r.ok) return toast(d.error ?? "No se pudo guardar.", "error");
      vibrar(15);
      toast(ok);
      await Promise.all([cargar(), useAmericanos.getState().cargarStaff()]);
    } catch {
      toast("Sin conexión. Prueba otra vez.", "error");
    } finally {
      setOcupado(null);
    }
  }

  if (!e)
    return (
      <section id="seguridad" className="scroll-mt-6">
        <h2 className="label mt-10 flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Seguridad del staff
        </h2>
        <div className="glass h-32 animate-pulse rounded-2xl" />
      </section>
    );

  const { politica, puedeCambiar } = e;
  const bloqueado = !puedeCambiar;
  const agregar = () => {
    const c = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return toast("Escribe un correo válido", "error");
    if (politica.correos.includes(c)) return toast("Ese correo ya está en la lista", "info");
    cambiar({ accion: "correos", correos: [...politica.correos, c] }, "correos", `${c} ya puede entrar como staff`);
    setCorreo("");
  };

  return (
    <section id="seguridad" className="scroll-mt-6">
      <h2 className="label mt-10 flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" /> Seguridad del staff
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-white/50">
        Cada persona del staff entra con su propio usuario de PadelReserve (el mismo del CRM). Así se sabe quién hizo cada cosa, nadie puede usar la
        app con una clave prestada y, si alguien deja el club, se le quita el acceso sin cambiarle la clave a todos.
      </p>

      {bloqueado && (
        <div className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Entraste con el PIN compartido. Para cambiar la seguridad, cierra sesión y entra con tu usuario de PadelReserve.
            {!e.padelreserve && " (El ingreso con PadelReserve aún no está conectado en el servidor.)"}
          </span>
        </div>
      )}

      <div className="glass space-y-4 rounded-2xl p-4">
        <Fila
          titulo="Ingreso con usuario de PadelReserve"
          detalle={e.padelreserve ? "Conectado. Entran quienes tienen rol staff en el CRM o están en la lista de abajo." : "No conectado en el servidor. Hay que configurarlo antes de apagar el PIN."}
          ok={e.padelreserve}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="size-4 text-neon" /> PIN compartido del club
            </p>
            <p className="text-xs text-white/50">
              {!e.pinConfigurado
                ? "No hay PIN configurado: solo se entra con usuario."
                : politica.pinApagado
                  ? "Apagado: nadie entra con el PIN, aunque lo sepa."
                  : "Encendido: cualquiera que sepa el PIN entra como staff."}
            </p>
          </div>
          {e.pinConfigurado && (
            <button
              role="switch"
              aria-checked={!politica.pinApagado}
              aria-label="PIN compartido encendido"
              disabled={bloqueado || !!ocupado || (!politica.pinApagado && !e.padelreserve)}
              onClick={() => {
                const apagar = !politica.pinApagado;
                if (apagar && !confirm("¿Apagar el PIN compartido? Desde ahora solo se entra con usuario de PadelReserve y las sesiones abiertas con el PIN se cierran.")) return;
                cambiar({ accion: "pin", apagado: apagar }, "pin", apagar ? "PIN compartido apagado" : "PIN compartido encendido");
              }}
              className={clsx("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40", !politica.pinApagado ? "bg-neon" : "bg-white/15")}
            >
              <span className={clsx("absolute top-1 size-5 rounded-full bg-blanco shadow transition-all", !politica.pinApagado ? "right-1" : "left-1")} />
            </button>
          )}
        </div>

        <div className="border-t border-white/5 pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Mail className="size-4 text-neon" /> Correos con permiso de staff
          </p>
          <p className="mb-2 text-xs text-white/50">Usuarios de PadelReserve que pueden entrar aunque no tengan el rol staff en el CRM.</p>
          {politica.correos.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {politica.correos.map((c) => (
                <li key={c} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{c}</span>
                  {c === e.yo.correo && <span className="chip !py-0 text-[10px]">Tú</span>}
                  <button
                    className="rounded-lg p-1.5 text-white/40 hover:text-coral disabled:opacity-30"
                    disabled={bloqueado || !!ocupado}
                    aria-label={`Quitar ${c}`}
                    onClick={() =>
                      confirm(`¿Quitar el acceso de staff a ${c}? Su sesión se cierra al instante.`) &&
                      cambiar({ accion: "correos", correos: politica.correos.filter((x) => x !== c) }, "correos", `${c} ya no es staff`)
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              className="input !py-2"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="correo@ejemplo.com"
              value={correo}
              disabled={bloqueado}
              onChange={(ev) => setCorreo(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && agregar()}
              aria-label="Correo nuevo de staff"
            />
            <button className="btn-neon shrink-0 !py-2" disabled={bloqueado || !!ocupado || !correo.trim()} onClick={agregar}>
              {ocupado === "correos" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Cerrar sesión en todos los dispositivos</p>
            <p className="text-xs text-white/50">Si se perdió una tablet o alguien sabe una clave que no debe: todos tienen que volver a entrar menos tú.</p>
          </div>
          <button
            className="btn-ghost shrink-0 !py-2 text-sm hover:!text-coral"
            disabled={bloqueado || !!ocupado}
            onClick={() =>
              confirm("¿Cerrar la sesión de staff en todos los demás dispositivos?") && cambiar({ accion: "cerrarTodo" }, "todo", "Listo: las demás sesiones se cerraron")
            }
          >
            {ocupado === "todo" ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Cerrar todas
          </button>
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Últimos ingresos</h3>
      {e.accesos.length === 0 ? (
        <p className="glass rounded-2xl p-4 text-sm text-white/50">Aún no hay ingresos registrados.</p>
      ) : (
        <ul className="glass divide-y divide-white/5 overflow-hidden rounded-2xl">
          {e.accesos.slice(0, 30).map((a, i) => (
            <li key={`${a.en}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              {a.ok ? <CheckCircle2 className="size-4 shrink-0 text-neon" /> : <XCircle className="size-4 shrink-0 text-coral" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.ok ? a.nombre ?? a.correo ?? "Staff" : a.correo ?? "Intento con PIN"}</span>
                <span className="block truncate text-xs text-white/45">
                  {a.metodo === "PIN" ? "PIN compartido" : "PadelReserve"} · {a.dispositivo}
                  {!a.ok && a.motivo ? ` · ${a.motivo}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-white/45">{hora(a.en)}</span>
            </li>
          ))}
        </ul>
      )}
      {politica.por && <p className="mt-2 text-[11px] text-white/35">Último cambio de seguridad: {politica.por}, {hora(politica.actualizadoEn)}</p>}
    </section>
  );
}

function Fila({ titulo, detalle, ok }: { titulo: string; detalle: string; ok: boolean }) {
  return (
    <div className="flex items-start gap-3">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neon" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-white/50">{detalle}</p>
      </div>
    </div>
  );
}
