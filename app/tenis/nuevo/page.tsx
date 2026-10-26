"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, Check, GitFork, ListOrdered, Sparkles, Swords, Trophy } from "lucide-react";
import { StaffGate } from "@/components/StaffGate";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toaster";
import { Cancha, slugDe, superficieDe, temaSuperficie } from "@/components/tenis/piezas";
import { useTenis } from "@/lib/tenisStore";
import { FORMATOS } from "@/lib/tenis/marcador";
import { CATEGORIAS_TENIS, crearTorneoTenis, id, leerLista, RAMAS, reglasCon, SUPERFICIES } from "@/lib/tenis/torneo";
import type { FormatoCuadro, FormatoPartidoId, InscritoTenis, Modalidad, Rama, Superficie } from "@/types/tenis";

const hoy = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

export default function NuevoTenisPage() {
  return (
    <StaffGate>
      <Suspense>
        <Formulario />
      </Suspense>
    </StaffGate>
  );
}

function Formulario() {
  const params = useSearchParams();
  const router = useRouter();
  const guardar = useTenis((s) => s.guardar);
  const [superficie, setSuperficie] = useState<Superficie>(superficieDe(params.get("superficie") ?? "") ?? "DURA");
  const [cuadro, setCuadro] = useState<FormatoCuadro>(params.get("rapido") ? "PARTIDO" : "ELIMINACION");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [modalidad, setModalidad] = useState<Modalidad>("SINGLES");
  const [rama, setRama] = useState<Rama>("MASCULINO");
  const [categoria, setCategoria] = useState("Open");
  const [formato, setFormato] = useState<FormatoPartidoId>("SUPER_TB");
  const [ventaja, setVentaja] = useState(true);
  const [canchas, setCanchas] = useState(4);
  const [lista, setLista] = useState("");
  const [rapido, setRapido] = useState<string[]>(["", "", "", ""]);
  const d = SUPERFICIES[superficie];
  const dobles = modalidad === "DOBLES";

  const leidos = useMemo(() => {
    if (cuadro !== "PARTIDO") return leerLista(lista, modalidad);
    const nombres = rapido.map((x) => x.trim());
    const lado = (xs: string[]): InscritoTenis | null => (xs.every(Boolean) ? { id: id("i"), jugadores: xs.map((nombre) => ({ id: id("j"), nombre })) } : null);
    const a = lado(dobles ? [nombres[0], nombres[1]] : [nombres[0]]);
    const b = lado(dobles ? [nombres[2], nombres[3]] : [nombres[2]]);
    return { inscritos: [a, b].filter(Boolean) as InscritoTenis[], errores: [] as string[] };
  }, [cuadro, lista, modalidad, rapido, dobles]);
  const n = leidos.inscritos.length;
  const tam = n > 1 ? 2 ** Math.ceil(Math.log2(n)) : 0;
  const minimo = cuadro === "PARTIDO" ? 2 : cuadro === "LIGA" ? 3 : 2;
  const nombreSugerido =
    cuadro === "PARTIDO"
      ? `Partido en ${d.nombre.toLowerCase()}`
      : `${cuadro === "LIGA" ? "Liga" : "Torneo"} ${modalidad === "SINGLES" ? "singles" : "dobles"} ${RAMAS[rama].toLowerCase()} ${categoria}`;

  const crear = () => {
    if (n < minimo || leidos.errores.length) return;
    const t = crearTorneoTenis({
      nombre: nombre.trim() || nombreSugerido,
      superficie,
      modalidad,
      rama,
      categoria,
      reglas: reglasCon(formato, ventaja),
      formato: cuadro,
      fecha,
      canchas,
      inscritos: leidos.inscritos,
    });
    guardar(t);
    toast(cuadro === "PARTIDO" ? "Partido creado" : "¡Cuadro sorteado!");
    router.push(cuadro === "PARTIDO" ? `/tenis/t/${t.id}/p/${t.partidos[0].id}/anotar` : `/tenis/t/${t.id}`);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6" style={temaSuperficie(superficie)}>
      <header className="flex items-center gap-2 py-3">
        <Link href={`/tenis/${slugDe(superficie)}`} className="btn-ghost !p-2.5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">{cuadro === "PARTIDO" ? "Partido rápido" : "Nuevo torneo de tenis"}</h1>
      </header>

      <Seccion titulo="Superficie">
        <div className="grid grid-cols-2 gap-3">
          {(["DURA", "ARCILLA"] as Superficie[]).map((s) => {
            const x = SUPERFICIES[s];
            const activo = s === superficie;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSuperficie(s)}
                className={clsx("relative overflow-hidden rounded-3xl p-3 text-left text-blanco ring-2 transition active:scale-[0.98]", activo ? "ring-white/80" : "opacity-60 ring-transparent hover:opacity-90")}
                style={{ background: `linear-gradient(150deg, ${x.color}, ${x.oscuro})` }}
              >
                <Cancha superficie={s} animar={false} className="rounded-xl" />
                <p className="mt-2 font-display text-lg font-bold">{x.nombre}</p>
                <p className="text-xs text-white/70">{x.ingles}</p>
                {activo && (
                  <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-blanco" style={{ color: x.oscuro }}>
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo="¿Qué vamos a jugar?">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "ELIMINACION", icon: GitFork, t: "Torneo", d: "Cuadro con cabezas de serie" },
              { id: "LIGA", icon: ListOrdered, t: "Liga", d: "Todos contra todos" },
              { id: "PARTIDO", icon: Swords, t: "Partido", d: "Un partido, ya" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setCuadro(o.id)}
              className={clsx("glass rounded-2xl p-3 text-left transition active:scale-[0.98]", cuadro === o.id ? "!border-[var(--sup-claro)] ring-2 ring-[var(--sup)]" : "opacity-70")}
            >
              <o.icon className="size-5" style={{ color: d.claro }} />
              <p className="mt-2 font-semibold">{o.t}</p>
              <p className="text-xs text-white/50">{o.d}</p>
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Jugadores">
        <Segmented
          valor={modalidad}
          onChange={setModalidad}
          opciones={[
            { id: "SINGLES", label: "Singles" },
            { id: "DOBLES", label: "Dobles" },
          ]}
        />
        <Segmented
          className="mt-2"
          valor={rama}
          onChange={setRama}
          opciones={(Object.keys(RAMAS) as Rama[]).map((r) => ({ id: r, label: RAMAS[r] }))}
        />
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {CATEGORIAS_TENIS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={clsx("chip shrink-0 !px-3.5 !py-1.5 !text-sm transition", categoria === c ? "!border-transparent !text-blanco" : "")}
              style={categoria === c ? { background: d.color } : undefined}
            >
              {c}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Formato del partido" detalle="Reglas de la ITF.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(FORMATOS) as FormatoPartidoId[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFormato(f);
                setVentaja(FORMATOS[f].reglas.ventaja);
              }}
              className={clsx("glass rounded-2xl p-4 text-left transition active:scale-[0.99]", formato === f ? "!border-[var(--sup-claro)] ring-2 ring-[var(--sup)]" : "")}
            >
              <p className="flex items-center gap-2 font-semibold">
                {FORMATOS[f].nombre}
                {f === "SUPER_TB" && <span className="chip !py-0.5 !text-[10px]">Recomendado</span>}
              </p>
              <p className="mt-1 text-xs text-white/55">{FORMATOS[f].detalle}</p>
            </button>
          ))}
        </div>
        <div className="glass mt-3 flex items-center gap-3 rounded-2xl p-4">
          <div className="flex-1">
            <p className="font-semibold">{ventaja ? "Con ventaja" : "Sin ventaja (punto decisivo)"}</p>
            <p className="text-xs text-white/55">{ventaja ? "En 40-40 hay que ganar dos puntos seguidos." : "En 40-40 se juega un solo punto; el que resta elige el lado."}</p>
          </div>
          <Switch activo={ventaja} onChange={setVentaja} etiqueta="Con ventaja" />
        </div>
      </Seccion>

      <Seccion titulo="Día y canchas">
        <div className="flex flex-wrap items-center gap-4">
          <input type="date" className="input !w-auto" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Stepper valor={canchas} onChange={setCanchas} min={1} max={16} sufijo="canchas" />
        </div>
      </Seccion>

      <Seccion titulo={cuadro === "PARTIDO" ? "¿Quiénes juegan?" : `Inscritos (${n})`}>
        {cuadro === "PARTIDO" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((lado) => (
              <div key={lado} className="glass space-y-2 rounded-2xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{lado === 0 ? "Lado A" : "Lado B"}</p>
                {(dobles ? [0, 1] : [0]).map((k) => {
                  const i = lado * 2 + k;
                  return (
                    <input
                      key={i}
                      className="input"
                      placeholder={dobles ? `Jugador ${k + 1}` : "Nombre y apellido"}
                      value={rapido[i]}
                      onChange={(e) => setRapido((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <>
            <textarea
              className="input min-h-48 font-mono text-sm"
              placeholder={dobles ? "(1) Luis Zea / Juan Tirado\n(2) Ana Pérez / Bea Ruiz\nCarlos Gil / Dani Sosa\n…" : "(1) Luis Zea\n(2) Juan Tirado\nCarlos Gil\nDani Sosa\n…"}
              value={lista}
              onChange={(e) => setLista(e.target.value)}
            />
            <p className="mt-2 text-xs text-white/50">
              Uno por línea{dobles ? ", la pareja separada con /" : ""}. Pon <b>(1)</b>, <b>(2)</b>… delante de las cabezas de serie. Pega la lista de WhatsApp tal cual.
            </p>
            {leidos.errores.map((e) => (
              <p key={e} className="mt-1 text-xs text-coral">
                {e}
              </p>
            ))}
            {n > 1 && cuadro === "ELIMINACION" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <Sparkles className="size-4" style={{ color: d.claro }} /> Cuadro de {tam}
                {tam - n > 0 ? `, ${tam - n} bye${tam - n === 1 ? "" : "s"} para los mejores sembrados` : ", sin byes"} · {Math.log2(tam)} rondas
              </p>
            )}
            {n > 2 && cuadro === "LIGA" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <Sparkles className="size-4" style={{ color: d.claro }} /> {(n * (n - 1)) / 2} partidos en {n % 2 ? n : n - 1} jornadas
              </p>
            )}
          </>
        )}
      </Seccion>

      <Seccion titulo="Nombre">
        <input className="input" placeholder={nombreSugerido} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
      </Seccion>

      <div className="glass-strong fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-white/60">
            {d.nombre} · {modalidad === "SINGLES" ? "Singles" : "Dobles"} · {FORMATOS[formato].nombre}
            {!ventaja && " sin ventaja"}
          </p>
          <button type="button" className="btn text-base font-bold text-blanco shadow-xl" style={{ background: `linear-gradient(135deg, ${d.color}, ${d.oscuro})` }} disabled={n < minimo || leidos.errores.length > 0} onClick={crear}>
            <Trophy className="size-5" /> {cuadro === "PARTIDO" ? "Empezar" : "Sortear cuadro"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Seccion({ titulo, detalle, children }: { titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="label">
        {titulo}
        {detalle && <span className="ml-2 normal-case tracking-normal text-white/35">{detalle}</span>}
      </h2>
      {children}
    </section>
  );
}
