"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowRightLeft, CalendarDays, Clock, Dices, Mars, Medal, Plus, Rocket, Swords, Timer, Trophy, Users, Venus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AvisoFotos, BotonFoto, FotoDelRegistro } from "@/components/FotosRegistro";
import { Opcion, Paso } from "@/components/habibi/piezas";
import { Logo } from "@/components/Logo";
import { ReglasPuntuacion } from "@/components/ReglasPuntuacion";
import { StaffGate } from "@/components/StaffGate";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toaster";
import { categoriaLabel, METODOS, nivelesPara, nivelLabel, RAMAS } from "@/lib/categories";
import { nuevoId } from "@/lib/evento";
import { sonar, vibrar } from "@/lib/feedback";
import { subirFotosDelRegistro, useFotosRegistro } from "@/lib/fotosRegistro";
import {
  CLASIFICAN,
  crearHabibi,
  CRUCES,
  duplasPosibles,
  EMPAREJAR,
  erroresHabibi,
  iniciosPosibles,
  INICIOS,
  LETRAS,
  MAX_DUPLAS_GRUPO,
  MAX_JUGADORES_GRUPO,
  NOMBRE_HABIBI,
  type NuevoHabibiInput,
} from "@/lib/habibi";
import { planRondas } from "@/lib/rotation";
import { configPorDefecto, descripcionPuntuacion } from "@/lib/scoring";
import { useAmericanos } from "@/lib/store";
import type { ConfigPuntuacion, EmparejarLlave, Genero, InicioLlave, Jugador, MetodoPuntuacion, Modalidad, Nivel, Pareja, PistaClub, Rama } from "@/types/americano";

const PASOS = ["Torneo", "Jugadores", "Grupos", "Llave", "Listo"];

const variantes = {
  entra: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  centro: { x: 0, opacity: 1 },
  sale: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

/** Pista asignada: a un grupo, a los dos (se turnan) o libre. */
type Uso = "A" | "B" | "AB" | null;

const A16: ConfigPuntuacion = { metodo: "PUNTOS_TOTALES", puntosPorPartido: 16, modo: "TOTAL" };

function porMetodo(metodo: MetodoPuntuacion): ConfigPuntuacion {
  return metodo === "PUNTOS_TOTALES" ? A16 : configPorDefecto(metodo);
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function NuevoHabibiPage() {
  return (
    <StaffGate>
      <NuevoHabibi />
    </StaffGate>
  );
}

interface Dupla {
  pareja: Pareja;
  jugadores: [Jugador, Jugador];
}

function NuevoHabibi() {
  const router = useRouter();
  const guardar = useAmericanos((s) => s.guardar);
  const club = useAmericanos((s) => s.club);
  const activas = club.pistas.filter((p) => p.activa);

  const [paso, setPaso] = useState(0);
  const [dir, setDir] = useState(1);
  const [nombre, setNombre] = useState(NOMBRE_HABIBI);
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState("19:00");
  const [rama, setRama] = useState<Rama>("MIXTO");
  const [nivel, setNivel] = useState<Nivel>("5TA");
  const [modalidad, setModalidad] = useState<Modalidad>("DUPLA_FIJA");
  const [grupos, setGrupos] = useState<Dupla[][]>([[], []]);
  const [sueltos, setSueltos] = useState<Jugador[][]>([[], []]);
  const [emparejar, setEmparejar] = useState<EmparejarLlave>("EQUILIBRADO");
  const [grupoActivo, setGrupoActivo] = useState(0);
  const [puntGrupos, setPuntGrupos] = useState<ConfigPuntuacion>(A16);
  const [uso, setUso] = useState<Record<number, Uso>>(() => {
    const mitad = Math.ceil(activas.length / 2);
    return Object.fromEntries(activas.map((p, i) => [p.numero, (activas.length === 1 ? "AB" : i < mitad ? "A" : "B") as Uso]));
  });
  const [cronometro, setCronometro] = useState(true);
  const [duracion, setDuracion] = useState(15);
  const [inicio, setInicio] = useState<InicioLlave>("OCTAVOS");
  const [tercerPuesto, setTercerPuesto] = useState(false);
  const [puntLlave, setPuntLlave] = useState<ConfigPuntuacion>(A16);
  const [finalDistinta, setFinalDistinta] = useState(false);
  const [puntFinal, setPuntFinal] = useState<ConfigPuntuacion>(configPorDefecto("SETS_CORTOS"));
  const [creando, setCreando] = useState(false);

  const canchasDe = (letra: "A" | "B"): PistaClub[] =>
    activas.filter((p) => uso[p.numero] === letra || uso[p.numero] === "AB").sort((a, b) => Number(b.techada) - Number(a.techada) || a.numero - b.numero);
  const canchasLlave = activas.filter((p) => uso[p.numero]).sort((a, b) => Number(b.techada) - Number(a.techada) || a.numero - b.numero);
  const individual = modalidad === "INDIVIDUAL_ROTATIVO";
  const mixto = rama === "MIXTO";
  const datosGrupo = (i: number) =>
    individual ? { parejas: [] as Pareja[], jugadores: sueltos[i] } : { parejas: grupos[i].map((d) => d.pareja), jugadores: grupos[i].flatMap((d) => d.jugadores) };
  const menor = Math.min(...LETRAS.map((_, i) => duplasPosibles({ modalidad, ...datosGrupo(i) }, mixto)));
  const posibles = iniciosPosibles(menor);
  // Si cambian las duplas y el inicio elegido ya no alcanza, se baja al siguiente posible.
  const inicioEfectivo: InicioLlave = posibles.includes(inicio) ? inicio : (posibles[0] ?? inicio);
  const compartidas = activas.filter((p) => uso[p.numero] === "AB").length;

  const input: NuevoHabibiInput = useMemo(
    () => ({
      nombre,
      fecha,
      horaInicio: hora,
      horaFin: "23:59",
      minutosEntreRondas: club.minutosEntreRondas,
      categoria: { rama, nivel },
      modalidad,
      emparejar: individual ? emparejar : undefined,
      grupos: LETRAS.map((l, i) => ({ ...datosGrupo(i), canchas: canchasDe(l) })),
      puntuacionGrupos: puntGrupos,
      cronometro,
      duracionRondaMin: duracion,
      inicio: inicioEfectivo,
      tercerPuesto,
      puntuacionLlave: puntLlave,
      puntuacionFinal: finalDistinta ? puntFinal : null,
      canchasLlave,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nombre, fecha, hora, rama, nivel, modalidad, emparejar, grupos, sueltos, puntGrupos, uso, cronometro, duracion, inicioEfectivo, tercerPuesto, puntLlave, finalDistinta, puntFinal, club.minutosEntreRondas],
  );
  const errores = erroresHabibi(input);

  const errorPaso = (p: number): string | null => {
    if (p === 0) return nombre.trim() ? null : "Ponle nombre al torneo.";
    if (p === 1) {
      for (const [i, l] of LETRAS.entries()) {
        if (!individual && grupos[i].length < 2) return `El grupo ${l} necesita al menos 2 duplas.`;
        if (individual && sueltos[i].length < 4) return `El grupo ${l} necesita al menos 4 jugadores.`;
        if (individual && mixto && duplasPosibles({ modalidad, ...datosGrupo(i) }, true) < 2) return `El grupo ${l} necesita al menos 2 hombres y 2 mujeres.`;
      }
      return null;
    }
    if (p === 2) {
      for (const l of LETRAS) if (!canchasDe(l).length) return `Elige al menos una pista para el grupo ${l}.`;
      return null;
    }
    return null;
  };

  function ir(n: number) {
    if (n > paso) {
      for (let p = paso; p < n; p++) {
        const e = errorPaso(p);
        if (e) {
          toast(e, "error");
          vibrar([30, 40, 30]);
          return;
        }
      }
    }
    setDir(n > paso ? 1 : -1);
    setPaso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function crear() {
    if (creando) return;
    if (errores.length) {
      toast(errores[0], "error");
      return;
    }
    setCreando(true);
    const { llave, grupos: gs } = crearHabibi(input);
    for (const g of gs) guardar(g);
    guardar(llave);
    // Las fotos del registro se suben en segundo plano apenas cada grupo llega al servidor.
    const fotos = useFotosRegistro.getState().fotos;
    useFotosRegistro.getState().limpiar();
    for (const g of gs) void subirFotosDelRegistro(g, fotos);
    sonar("ok");
    vibrar([20, 40, 60]);
    toast("¡Americano HABIBI creado! A jugar 🎾");
    router.replace(`/habibi/${llave.id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <button onClick={() => (paso > 0 ? ir(paso - 1) : router.push("/habibi"))} className="btn-ghost !p-2.5" aria-label={paso > 0 ? `Volver a ${PASOS[paso - 1]}` : "Volver"}>
          <ArrowLeft className="size-5" />
        </button>
        <Logo compacto />
        <span className="w-10 text-right text-xs font-semibold text-white/40">
          {paso + 1}/{PASOS.length}
        </span>
      </header>

      <nav className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <button key={p} onClick={() => ir(i)} className="text-left" aria-current={i === paso ? "step" : undefined}>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-neon" animate={{ width: i <= paso ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
            </div>
            <span className={clsx("mt-2 hidden text-[11px] font-semibold sm:block", i === paso ? "text-white" : "text-white/40")}>{p}</span>
          </button>
        ))}
      </nav>

      <div className="relative mt-8 flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section key={paso} custom={dir} variants={variantes} initial="entra" animate="centro" exit="sale" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            {paso === 0 && (
              <Paso titulo="Americano HABIBI Tournament" sub="Staff La Marina · nombre, día y categoría">
                <label className="label" htmlFor="hab-nombre">
                  Nombre del torneo
                </label>
                <input id="hab-nombre" className="input text-lg font-semibold" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> Día
                    </span>
                    <input type="date" className="input" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label flex items-center gap-1.5">
                      <Clock className="size-3.5" /> Hora de inicio
                    </span>
                    <input type="time" className="input" value={hora} step={300} onChange={(e) => e.target.value && setHora(e.target.value)} />
                  </label>
                </div>
                <span className="label mt-6 block">Rama</span>
                <Segmented
                  opciones={RAMAS.map((r) => ({
                    id: r.id,
                    label: (
                      <span className="flex items-center justify-center gap-1.5">
                        {r.id === "FEMENINO" ? <Venus className="size-4" /> : r.id === "MASCULINO" ? <Mars className="size-4" /> : <Users className="size-4" />}
                        {r.label}
                      </span>
                    ),
                  }))}
                  valor={rama}
                  onChange={(r) => {
                    setRama(r);
                    if (r === "FEMENINO" && nivel === "2DA") setNivel("3RA");
                  }}
                />
                <span className="label mt-6 block">Categoría</span>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {nivelesPara(rama).map((n) => (
                    <Opcion key={n} activo={nivel === n} onClick={() => setNivel(n)} className="!p-3 text-center">
                      <span className="font-display text-lg font-bold">{nivelLabel(n, rama)}</span>
                    </Opcion>
                  ))}
                </div>
              </Paso>
            )}

            {paso === 1 && (
              <Paso
                titulo={individual ? "Jugadores por grupo" : "Duplas por grupo"}
                sub={individual ? "Anota a cada jugador en su grupo: cambian de pareja cada ronda." : "Anota cada dupla en su grupo. Lo normal: 8 en el A y 8 en el B."}
              >
                <span className="label">¿Cómo se juega en los grupos?</span>
                <div className="mb-6 grid grid-cols-2 gap-2">
                  {FORMATOS.map((f) => (
                    <Opcion key={f.id} activo={modalidad === f.id} onClick={() => setModalidad(f.id)}>
                      <span className="block font-display text-lg font-bold">{f.label}</span>
                      <span className="mt-1 block text-xs opacity-70">{f.detalle}</span>
                    </Opcion>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {LETRAS.map((l, i) => {
                    const n = individual ? sueltos[i].length : grupos[i].length;
                    const unidad = individual ? "jugador" : "dupla";
                    return (
                      <Opcion key={l} activo={grupoActivo === i} onClick={() => setGrupoActivo(i)} className="!py-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">Grupo</span>
                        <span className="flex items-baseline gap-2">
                          <span className="font-display text-3xl font-bold">{l}</span>
                          <span className="text-sm font-semibold opacity-70">
                            {n} {unidad}
                            {n === 1 ? "" : individual ? "es" : "s"}
                          </span>
                        </span>
                      </Opcion>
                    );
                  })}
                </div>
                {individual ? (
                  <EditorJugadores
                    key={`j${grupoActivo}`}
                    letra={LETRAS[grupoActivo]}
                    rama={rama}
                    nivel={nivel}
                    jugadores={sueltos[grupoActivo]}
                    todos={sueltos.flat()}
                    onAgregar={(j) => setSueltos((gs) => gs.map((g, i) => (i === grupoActivo ? [...g, j] : g)))}
                    onQuitar={(id) => setSueltos((gs) => gs.map((g) => g.filter((j) => j.id !== id)))}
                    onMover={(id) =>
                      setSueltos((gs) => {
                        const j = gs[grupoActivo].find((x) => x.id === id);
                        if (!j) return gs;
                        const otro = 1 - grupoActivo;
                        if (gs[otro].length >= MAX_JUGADORES_GRUPO) {
                          toast(`El grupo ${LETRAS[otro]} ya tiene ${MAX_JUGADORES_GRUPO} jugadores`, "error");
                          return gs;
                        }
                        toast(`${j.nombre} pasó al grupo ${LETRAS[otro]}`, "info");
                        return gs.map((g, i) => (i === grupoActivo ? g.filter((x) => x.id !== id) : i === otro ? [...g, j] : g));
                      })
                    }
                  />
                ) : (
                  <EditorDuplas
                    key={grupoActivo}
                    letra={LETRAS[grupoActivo]}
                    rama={rama}
                    nivel={nivel}
                    duplas={grupos[grupoActivo]}
                    todos={grupos.flat()}
                    onAgregar={(d) => setGrupos((gs) => gs.map((g, i) => (i === grupoActivo ? [...g, d] : g)))}
                    onQuitar={(id) => setGrupos((gs) => gs.map((g) => g.filter((d) => d.pareja.id !== id)))}
                    onMover={(id) =>
                      setGrupos((gs) => {
                        const d = gs[grupoActivo].find((x) => x.pareja.id === id);
                        if (!d) return gs;
                        const otro = 1 - grupoActivo;
                        if (gs[otro].length >= MAX_DUPLAS_GRUPO) {
                          toast(`El grupo ${LETRAS[otro]} ya tiene ${MAX_DUPLAS_GRUPO} duplas`, "error");
                          return gs;
                        }
                        toast(`${d.pareja.nombre} pasó al grupo ${LETRAS[otro]}`, "info");
                        return gs.map((g, i) => (i === grupoActivo ? g.filter((x) => x.pareja.id !== id) : i === otro ? [...g, d] : g));
                      })
                    }
                  />
                )}
                {(individual ? sueltos.flat().length >= 8 : grupos.flat().length >= 4) && (
                  <button
                    type="button"
                    className="btn-ghost mt-4 w-full text-sm"
                    onClick={() => {
                      if (!confirm(`¿Repartir ${individual ? "a todos los jugadores" : "todas las duplas"} al azar entre los dos grupos?`)) return;
                      if (individual) {
                        // En mixto se sortea a hombres y mujeres por separado: los grupos quedan parejos.
                        const a: Jugador[] = [];
                        const b: Jugador[] = [];
                        for (const lista of mixto ? [sueltos.flat().filter((j) => j.genero === "M"), sueltos.flat().filter((j) => j.genero !== "M")] : [sueltos.flat()]) {
                          barajar(lista).forEach((j) => (a.length <= b.length ? a : b).push(j));
                        }
                        setSueltos([a, b]);
                      } else {
                        const todas = barajar(grupos.flat());
                        const mitad = Math.ceil(todas.length / 2);
                        setGrupos([todas.slice(0, mitad), todas.slice(mitad)]);
                      }
                      vibrar(20);
                      toast("Grupos sorteados", "info");
                    }}
                  >
                    <Dices className="size-4" /> Sortear los grupos al azar
                  </button>
                )}
                <AvisoFotos />
                <p className="mt-1 px-1 text-xs text-white/40">
                  Toca la cámara antes de agregar{individual ? " al jugador" : " la dupla"}, o su círculo en la lista para tomarla después. También se pueden tomar luego en cada grupo, en «{individual ? "Jugadores" : "Parejas"} y fotos».
                </p>
              </Paso>
            )}

            {paso === 2 && (
              <Paso titulo="Fase de grupos" sub={individual ? "Cada grupo juega su americano individual: cada ronda cambian de pareja y de rivales." : "Cada grupo juega su americano en dupla fija, todos contra todos."}>
                <span className="label">¿Cómo se cuenta cada partido?</span>
                <MetodoSelector valor={puntGrupos} onChange={setPuntGrupos} />
                <ReglasPuntuacion valor={puntGrupos} onChange={setPuntGrupos} />

                <span className="label mt-8 block">Pistas de cada grupo</span>
                <p className="mb-3 text-xs text-white/50">Toca una pista para cambiarla: grupo A, grupo B, los dos (se turnan) o libre.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {activas.map((p) => {
                    const u = uso[p.numero] ?? null;
                    return (
                      <button
                        key={p.numero}
                        type="button"
                        onClick={() => {
                          vibrar(8);
                          const ciclo: Uso[] = ["A", "B", "AB", null];
                          setUso((x) => ({ ...x, [p.numero]: ciclo[(ciclo.indexOf(x[p.numero] ?? null) + 1) % ciclo.length] }));
                        }}
                        className={clsx("rounded-2xl border-2 p-3 text-left transition", u ? "seleccion sobre-marca" : "glass border-dashed border-white/15")}
                      >
                        <span className="block text-xs font-semibold opacity-70">
                          {p.nombre}
                          {p.techada ? " · techada" : ""}
                        </span>
                        <span className="font-display text-xl font-bold">{u === "AB" ? "A y B" : u ? `Grupo ${u}` : "Libre"}</span>
                      </button>
                    );
                  })}
                </div>
                {compartidas > 0 && <p className="mt-2 text-xs text-amber-600">Con pistas compartidas los dos grupos se turnan: tardará más.</p>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {LETRAS.map((l, i) => {
                    const n = individual ? sueltos[i].length : grupos[i].length;
                    const pistas = canchasDe(l).length;
                    const hombres = sueltos[i].filter((j) => j.genero === "M").length;
                    const plan = planRondas(n, modalidad, Math.max(1, pistas), individual && mixto ? { hombres, mujeres: n - hombres } : undefined);
                    return (
                      <div key={l} className="glass rounded-2xl p-3 text-sm">
                        <p className="font-semibold">Grupo {l}</p>
                        <p className="text-white/55">
                          {n} {individual ? "jugadores" : "duplas"} · {pistas} pista{pistas === 1 ? "" : "s"} · <span className="font-semibold text-white">{plan.rondas} rondas</span>
                        </p>
                        <p className="text-xs text-white/45">
                          {individual ? "Cada jugador" : "Cada dupla"} juega {plan.partidos[0] === plan.partidos[1] ? plan.partidos[0] : `${plan.partidos[0]}-${plan.partidos[1]}`} partidos
                          {plan.enEspera > 0 ? ` · ${plan.enEspera} en espera por ronda` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <span className="label mt-8 block">Cronómetro</span>
                <div className="glass space-y-4 rounded-2xl p-4">
                  <FilaSwitch activo={cronometro} onChange={setCronometro} etiqueta="Cronómetro por ronda" />
                  {cronometro && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-white/70">
                        <Timer className="size-4" /> Duración de cada ronda
                      </span>
                      <Stepper valor={duracion} onChange={setDuracion} min={5} max={45} paso={5} sufijo="min" />
                    </div>
                  )}
                </div>
              </Paso>
            )}

            {paso === 3 && (
              <Paso titulo="La llave" sub="¿Desde qué ronda se juega la eliminatoria y cómo se cuentan los partidos?">
                <span className="label">La llave arranca en</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {INICIOS.map((o) => {
                    const ok = posibles.includes(o.id);
                    return (
                      <Opcion key={o.id} activo={inicioEfectivo === o.id} disabled={!ok} onClick={() => ok && setInicio(o.id)}>
                        <span className="block font-display text-lg font-bold">{o.label}</span>
                        <span className="mt-1 block text-xs opacity-70">{ok ? o.detalle : individual ? `Necesita ${mixto ? `${CLASIFICAN[o.id]} hombres y ${CLASIFICAN[o.id]} mujeres` : `${CLASIFICAN[o.id] * 2} jugadores`} en cada grupo.` : `Necesita ${CLASIFICAN[o.id]} duplas en cada grupo.`}</span>
                      </Opcion>
                    );
                  })}
                </div>
                <div className="glass mt-3 rounded-2xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Primeros cruces</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CRUCES[inicioEfectivo].map(([a, b], i) => (
                      <span key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-center text-sm font-semibold tabular">
                        {a} <span className="text-white/35">vs</span> {b}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    Pasan {CLASIFICAN[inicioEfectivo]} duplas por grupo
                    {individual ? ` (${mixto ? `los ${CLASIFICAN[inicioEfectivo]} mejores hombres y las ${CLASIFICAN[inicioEfectivo]} mejores mujeres` : `los ${CLASIFICAN[inicioEfectivo] * 2} mejores jugadores`})` : ""}. 1A y 1B van en mitades opuestas: solo se pueden cruzar en la final.
                  </p>
                </div>

                {individual && (
                  <>
                    <span className="label mt-8 block">¿Cómo se forman las duplas de la llave?</span>
                    <p className="mb-3 text-xs text-white/50">Con el ranking individual de cada grupo{mixto ? ", siempre un hombre con una mujer" : ""}. La dupla del mejor clasificado es 1A (o 1B), la siguiente 2A…</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {EMPAREJAR.map((o) => (
                        <Opcion key={o.id} activo={emparejar === o.id} onClick={() => setEmparejar(o.id)}>
                          <span className="block font-display text-lg font-bold">{o.label}</span>
                          <span className="mt-1 block text-xs opacity-70">{o.detalle}</span>
                        </Opcion>
                      ))}
                    </div>
                  </>
                )}

                <span className="label mt-8 block">¿Cómo se cuenta en la llave?</span>
                <MetodoSelector valor={puntLlave} onChange={setPuntLlave} />
                <ReglasPuntuacion valor={puntLlave} onChange={setPuntLlave} />
                <button type="button" className="mt-2 text-xs font-semibold text-neon underline-offset-2 hover:underline" onClick={() => setPuntLlave(puntGrupos)}>
                  Usar lo mismo que en los grupos
                </button>

                <div className="glass mt-6 space-y-4 rounded-2xl p-4">
                  <FilaSwitch activo={finalDistinta} onChange={setFinalDistinta} etiqueta="La final se juega distinto" />
                  {finalDistinta && (
                    <div>
                      <MetodoSelector valor={puntFinal} onChange={setPuntFinal} />
                      <ReglasPuntuacion valor={puntFinal} onChange={setPuntFinal} />
                    </div>
                  )}
                  <FilaSwitch activo={tercerPuesto} onChange={setTercerPuesto} etiqueta="Partido por el 3er puesto" />
                </div>
                <p className="mt-3 text-xs text-white/50">En la llave no hay empates: si un partido queda igualado, se define con un punto de oro y se anota quién lo ganó.</p>
              </Paso>
            )}

            {paso === 4 && (
              <Paso titulo="¡Todo listo!" sub="Revisa y lanza el torneo">
                <div className="glass rounded-3xl p-5">
                  <p className="font-display text-2xl font-bold">{nombre}</p>
                  <p className="mt-1 text-sm text-white/55">
                    {categoriaLabel({ rama, nivel })} · {new Date(fecha + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })} · {hora}
                  </p>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    {LETRAS.map((l, i) => (
                      <Dato key={l} icono={Users} titulo={`Grupo ${l}`} valor={`${individual ? `${sueltos[i].length} jugadores` : `${grupos[i].length} duplas`} · ${canchasDe(l).map((p) => p.nombre).join(", ") || "sin pistas"}`} />
                    ))}
                    <Dato icono={Timer} titulo="Grupos" valor={`${individual ? "Individual" : "Dupla fija"} · ${descripcionPuntuacion(puntGrupos)}`} />
                    {individual && <Dato icono={Users} titulo="Duplas de la llave" valor={EMPAREJAR.find((x) => x.id === emparejar)!.label + (mixto ? " · hombre + mujer" : "")} />}
                    <Dato icono={Swords} titulo="Llave" valor={`Desde ${INICIOS.find((x) => x.id === inicioEfectivo)!.label.toLowerCase()} · ${descripcionPuntuacion(puntLlave)}`} />
                    <Dato icono={Trophy} titulo="Final" valor={descripcionPuntuacion(finalDistinta ? puntFinal : puntLlave)} />
                    <Dato icono={Medal} titulo="3er puesto" valor={tercerPuesto ? "Se juega" : "No se juega (los dos semifinalistas son 3º)"} />
                  </dl>
                </div>
                {errores.length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm text-coral">
                    {errores.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                )}
              </Paso>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-fondo via-fondo/95 to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 sm:px-6">
          {paso > 0 && (
            <button className="btn-ghost" onClick={() => ir(paso - 1)}>
              <ArrowLeft className="size-4" /> Atrás
            </button>
          )}
          {paso < PASOS.length - 1 ? (
            <button className={clsx("btn-neon flex-1 text-base", errorPaso(paso) && "opacity-50")} onClick={() => ir(paso + 1)}>
              Siguiente <ArrowRight className="size-4" />
            </button>
          ) : (
            <button className="btn-neon flex-1 text-base" onClick={crear} disabled={errores.length > 0 || creando}>
              <Rocket className="size-5" /> Crear torneo
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}

const FORMATOS: { id: Modalidad; label: string; detalle: string }[] = [
  { id: "INDIVIDUAL_ROTATIVO", label: "Individual", detalle: "Cada ronda cambian de pareja. Con el ranking individual se arman las duplas de la llave." },
  { id: "DUPLA_FIJA", label: "Dupla fija", detalle: "La misma dupla todo el torneo, todas contra todas." },
];

function barajar<T>(xs: T[]): T[] {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function FilaSwitch({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{etiqueta}</span>
      <Switch activo={activo} onChange={onChange} etiqueta={etiqueta} />
    </div>
  );
}

function Dato({ icono: Icono, titulo, valor }: { icono: typeof Users; titulo: string; valor: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/[0.03] p-3">
      <Icono className="mt-0.5 size-4 shrink-0 text-neon" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{titulo}</dt>
        <dd className="font-medium">{valor}</dd>
      </div>
    </div>
  );
}

function MetodoSelector({ valor, onChange }: { valor: ConfigPuntuacion; onChange: (c: ConfigPuntuacion) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METODOS.map((m) => (
        <Opcion key={m.id} activo={valor.metodo === m.id} onClick={() => valor.metodo !== m.id && onChange(porMetodo(m.id))} className="!p-3">
          <span className="block font-display text-lg font-bold">{m.label}</span>
          <span className="mt-0.5 hidden text-[11px] opacity-70 sm:block">{m.descripcion}</span>
        </Opcion>
      ))}
    </div>
  );
}

function crearJugador(texto: string, genero: Genero, nivel: Nivel): Jugador {
  const [nombre, ...resto] = texto.trim().replace(/\s+/g, " ").split(" ");
  return { id: nuevoId("jug_"), nombre, apellido: resto.join(" ") || undefined, genero, nivel, fotoUrl: null };
}

function EditorDuplas({
  letra,
  rama,
  nivel,
  duplas,
  todos,
  onAgregar,
  onQuitar,
  onMover,
}: {
  letra: string;
  rama: Rama;
  nivel: Nivel;
  duplas: Dupla[];
  todos: Dupla[];
  onAgregar: (d: Dupla) => void;
  onQuitar: (parejaId: string) => void;
  onMover: (parejaId: string) => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const refA = useRef<HTMLInputElement>(null);
  const mixta = rama === "MIXTO";
  const genero: Genero | null = rama === "FEMENINO" ? "F" : rama === "MASCULINO" ? "M" : null;

  function agregar() {
    if (!a.trim() || !b.trim()) {
      toast("Escribe los dos nombres de la dupla", "error");
      return;
    }
    if (duplas.length >= MAX_DUPLAS_GRUPO) {
      toast(`Máximo ${MAX_DUPLAS_GRUPO} duplas por grupo`, "error");
      return;
    }
    const existentes = new Set(todos.flatMap((d) => d.jugadores.map((j) => `${j.nombre} ${j.apellido ?? ""}`.trim().toLowerCase())));
    const repetido = [a, b].map((x) => x.trim().replace(/\s+/g, " ")).find((x) => existentes.has(x.toLowerCase()));
    if (repetido) {
      toast(`${repetido} ya está anotado. Agrega el apellido para distinguirlo.`, "error");
      return;
    }
    const ja = crearJugador(a, genero ?? "M", nivel);
    const jb = crearJugador(b, genero ?? "F", nivel);
    const pareja: Pareja = { id: nuevoId("par_"), jugadorIds: [ja.id, jb.id], nombre: `${ja.nombre} / ${jb.nombre}` };
    if (foto) useFotosRegistro.getState().poner(pareja.id, foto);
    setFoto(null);
    onAgregar({ pareja, jugadores: [ja, jb] });
    setA("");
    setB("");
    vibrar(10);
    sonar("tap");
    refA.current?.focus();
  }

  return (
    <div className="mt-4">
      <div className="glass flex flex-col gap-2 rounded-2xl p-3 sm:flex-row">
        <input
          ref={refA}
          className="input flex-1"
          placeholder={mixta ? "Él (nombre y apellido)" : "Jugador 1"}
          value={a}
          onChange={(e) => setA(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          aria-label={mixta ? "Hombre de la dupla" : "Jugador 1"}
        />
        <input
          className="input flex-1"
          placeholder={mixta ? "Ella (nombre y apellido)" : "Jugador 2"}
          value={b}
          onChange={(e) => setB(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          aria-label={mixta ? "Mujer de la dupla" : "Jugador 2"}
        />
        <div className="flex gap-2">
          <BotonFoto foto={foto} onFoto={setFoto} etiqueta="Foto de la dupla" />
          <button className="btn-neon flex-1" onClick={agregar}>
            <Plus className="size-4" /> Dupla al {letra}
          </button>
        </div>
      </div>
      {duplas.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">El grupo {letra} aún no tiene duplas.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {duplas.map((d, i) => (
              <motion.li key={d.pareja.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -30 }} className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
                <span className="w-5 text-right text-xs font-semibold text-white/30">{i + 1}</span>
                <FotoDelRegistro id={d.pareja.id} nombres={[d.jugadores[0].nombre, d.jugadores[1].nombre]} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.jugadores.map((j) => [j.nombre, j.apellido].filter(Boolean).join(" ")).join(" / ")}</span>
                <button className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" onClick={() => onMover(d.pareja.id)} aria-label={`Pasar ${d.pareja.nombre} al otro grupo`} title="Pasar al otro grupo">
                  <ArrowRightLeft className="size-4" />
                </button>
                <button className="rounded-lg p-2 text-white/40 hover:bg-coral/10 hover:text-coral" onClick={() => onQuitar(d.pareja.id)} aria-label={`Quitar dupla ${d.pareja.nombre}`}>
                  <X className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function EditorJugadores({
  letra,
  rama,
  nivel,
  jugadores,
  todos,
  onAgregar,
  onQuitar,
  onMover,
}: {
  letra: string;
  rama: Rama;
  nivel: Nivel;
  jugadores: Jugador[];
  todos: Jugador[];
  onAgregar: (j: Jugador) => void;
  onQuitar: (id: string) => void;
  onMover: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const mixta = rama === "MIXTO";
  const [genero, setGenero] = useState<Genero>(rama === "FEMENINO" ? "F" : "M");
  const ref = useRef<HTMLInputElement>(null);
  const hombres = jugadores.filter((j) => j.genero === "M").length;

  function agregar() {
    if (!texto.trim()) {
      toast("Escribe el nombre del jugador", "error");
      return;
    }
    if (jugadores.length >= MAX_JUGADORES_GRUPO) {
      toast(`Máximo ${MAX_JUGADORES_GRUPO} jugadores por grupo`, "error");
      return;
    }
    const limpio = texto.trim().replace(/\s+/g, " ");
    if (todos.some((j) => `${j.nombre} ${j.apellido ?? ""}`.trim().toLowerCase() === limpio.toLowerCase())) {
      toast(`${limpio} ya está anotado. Agrega el apellido para distinguirlo.`, "error");
      return;
    }
    const j = crearJugador(limpio, mixta ? genero : rama === "FEMENINO" ? "F" : "M", nivel);
    if (foto) useFotosRegistro.getState().poner(j.id, foto);
    setFoto(null);
    onAgregar(j);
    setTexto("");
    vibrar(10);
    sonar("tap");
    ref.current?.focus();
  }

  return (
    <div className="mt-4">
      <div className="glass flex flex-col gap-2 rounded-2xl p-3 sm:flex-row">
        {mixta && (
          <div className="grid grid-cols-2 gap-1 sm:w-44" role="group" aria-label="Hombre o mujer">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={genero === g}
                onClick={() => setGenero(g)}
                className={clsx("flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold transition", genero === g ? "bg-marca text-blanco" : "bg-white/5 text-white/60")}
              >
                {g === "M" ? <Mars className="size-4" /> : <Venus className="size-4" />}
                {g === "M" ? "Él" : "Ella"}
              </button>
            ))}
          </div>
        )}
        <input
          ref={ref}
          className="input flex-1"
          placeholder="Nombre y apellido"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          aria-label="Nombre del jugador"
        />
        <div className="flex gap-2">
          <BotonFoto foto={foto} onFoto={setFoto} etiqueta={genero === "F" ? "Foto de la jugadora" : "Foto del jugador"} />
          <button className="btn-neon flex-1" onClick={agregar}>
            <Plus className="size-4" /> Jugador al {letra}
          </button>
        </div>
      </div>
      {mixta && jugadores.length > 0 && (
        <p className={clsx("mt-2 text-xs", hombres === jugadores.length - hombres ? "text-white/45" : "text-amber-600")}>
          {hombres} hombres y {jugadores.length - hombres} mujeres{hombres === jugadores.length - hombres ? "" : ": lo ideal es la misma cantidad"}.
        </p>
      )}
      {jugadores.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">El grupo {letra} aún no tiene jugadores.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {jugadores.map((j, i) => {
              const completo = [j.nombre, j.apellido].filter(Boolean).join(" ");
              return (
                <motion.li key={j.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -30 }} className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
                  <span className="w-5 text-right text-xs font-semibold text-white/30">{i + 1}</span>
                  <FotoDelRegistro id={j.id} nombres={[completo]} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{completo}</span>
                  {mixta && (j.genero === "M" ? <Mars className="size-4 text-white/40" aria-label="Hombre" /> : <Venus className="size-4 text-white/40" aria-label="Mujer" />)}
                  <button className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" onClick={() => onMover(j.id)} aria-label={`Pasar a ${completo} al otro grupo`} title="Pasar al otro grupo">
                    <ArrowRightLeft className="size-4" />
                  </button>
                  <button className="rounded-lg p-2 text-white/40 hover:bg-coral/10 hover:text-coral" onClick={() => onQuitar(j.id)} aria-label={`Quitar a ${completo}`}>
                    <X className="size-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
