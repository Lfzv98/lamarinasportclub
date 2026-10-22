"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, CloudRain, Dices, Sun, Warehouse, Settings2, Mars, Plus, Rocket, Shuffle, Trash2, UserPlus, Users, Venus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { toast } from "@/components/ui/Toaster";
import { categoriaLabel, METODOS, MODALIDADES, nivelLabel, NIVELES, RAMAS } from "@/lib/categories";
import { crearEvento, generarRondas, nuevoId } from "@/lib/evento";
import { sonar, vibrar } from "@/lib/feedback";
import { partidosPorRonda, rondasSugeridas } from "@/lib/rotation";
import { configPorDefecto } from "@/lib/scoring";
import { aHora, aMinutos, DIAS, diaSemana, franjas, horaFinPrevista, horarioDelDia, nombrePista, rondasQueCaben, validarFranja } from "@/lib/horarios";
import { useAmericanos } from "@/lib/store";
import type { ConfigPuntuacion, Genero, Jugador, MetodoPuntuacion, Modalidad, Nivel, Pareja, Rama } from "@/types/americano";

const PASOS = ["Categoría", "Formato", "Pistas", "Jugadores", "Listo"];

const NOMBRES_DEMO: Record<Genero, string[]> = {
  F: ["Valentina", "Camila", "Lucía", "Sofía", "Martina", "Isabella", "Renata", "Paula", "Antonia", "Julieta", "Elena", "Mía"],
  M: ["Mateo", "Diego", "Tomás", "Joaquín", "Sebastián", "Andrés", "Nicolás", "Martín", "Lucas", "Felipe", "Bruno", "Emilio"],
};

const variantes = {
  entra: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  centro: { x: 0, opacity: 1 },
  sale: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function SetupPage() {
  const router = useRouter();
  const guardar = useAmericanos((s) => s.guardar);
  const club = useAmericanos((s) => s.club);

  const [paso, setPaso] = useState(0);
  const [dir, setDir] = useState(1);

  const [rama, setRama] = useState<Rama>("MIXTO");
  const [nivel, setNivel] = useState<Nivel>("5TA");
  const [modalidad, setModalidad] = useState<Modalidad>("INDIVIDUAL_ROTATIVO");
  const [puntuacion, setPuntuacion] = useState<ConfigPuntuacion>(configPorDefecto("PUNTOS_TOTALES"));
  const pistasActivas = club.pistas.filter((c) => c.activa);
  const [seleccion, setSeleccion] = useState<number[]>(() => club.pistas.filter((c) => c.activa && c.techada).map((c) => c.numero));
  // Techadas primero (la primera recibe el partido de mayor nivel), luego por número.
  const canchas = pistasActivas
    .filter((c) => seleccion.includes(c.numero))
    .sort((a, b) => Number(b.techada) - Number(a.techada) || a.numero - b.numero);
  const pistas = Math.max(1, canchas.length);
  const [duracion, setDuracion] = useState(15);
  const [rondasManual, setRondasManual] = useState<number | null>(null);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [parejas, setParejas] = useState<Pareja[]>([]);
  const [nombre, setNombre] = useState("");
  const [semilla, setSemilla] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [horaInicio, setHoraInicio] = useState("19:00");
  const [horaFin, setHoraFin] = useState("22:00");

  const horarioDia = horarioDelDia(club, fecha);
  const slots = franjas(horarioDia);
  const errorHorario = validarFranja(horarioDia, horaInicio, horaFin);
  const caben = rondasQueCaben(horaInicio, horaFin, duracion, club.minutosEntreRondas);

  const mixto = rama === "MIXTO";
  const generoFijo: Genero | null = rama === "FEMENINO" ? "F" : rama === "MASCULINO" ? "M" : null;
  const unidades = modalidad === "DUPLA_FIJA" ? parejas.length : jugadores.length;
  const sugeridas = rondasSugeridas(unidades || (modalidad === "DUPLA_FIJA" ? pistas * 2 : pistas * 4), modalidad, pistas);
  // Con franja válida, las rondas salen del horario; si no, de la cantidad de jugadores.
  const automaticas = !errorHorario && caben > 0 ? caben : sugeridas;
  const totalRondas = rondasManual ?? automaticas;
  const finPrevisto = horaFinPrevista({ horaInicio, duracionRondaMin: duracion, minutosEntreRondas: club.minutosEntreRondas, totalRondas });
  const excedeFranja = aMinutos(finPrevisto) > aMinutos(horaFin);

  const nH = jugadores.filter((j) => j.genero === "M").length;
  const nF = jugadores.length - nH;
  const porRonda = modalidad === "DUPLA_FIJA" ? Math.min(pistas, Math.floor(parejas.length / 2)) : partidosPorRonda(jugadores, pistas, mixto);
  const descansan = modalidad === "DUPLA_FIJA" ? parejas.length - porRonda * 2 : jugadores.length - porRonda * 4;

  const errorJugadores = useMemo(() => {
    if (modalidad === "DUPLA_FIJA") {
      if (parejas.length < 2) return "Agrega al menos 2 parejas.";
      return null;
    }
    if (jugadores.length < 4) return `Faltan ${4 - jugadores.length} jugador(es) para el primer partido.`;
    if (mixto && (nH < 2 || nF < 2)) return "En Mixto necesitas al menos 2 hombres y 2 mujeres.";
    return null;
  }, [modalidad, parejas.length, jugadores.length, mixto, nH, nF]);

  const preview = useMemo(() => {
    if (errorJugadores) return null;
    return generarRondas({ modalidad, jugadores, parejas, pistas, canchas, totalRondas: 1, semilla, categoria: { rama, nivel } })[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorJugadores, modalidad, jugadores, parejas, pistas, seleccion.join(), semilla, rama, nivel]);

  const errorPaso = paso === 3 ? errorJugadores : paso === 2 ? errorHorario : null;
  const puedeAvanzar = !errorPaso;

  function ir(n: number) {
    if (n > paso && !puedeAvanzar) {
      vibrar([30, 40, 30]);
      toast(errorPaso ?? "Completa este paso", "error");
      return;
    }
    vibrar(10);
    setDir(n > paso ? 1 : -1);
    setPaso(Math.max(0, Math.min(PASOS.length - 1, n)));
  }

  function cambiarRama(r: Rama) {
    setRama(r);
    const g: Genero | null = r === "FEMENINO" ? "F" : r === "MASCULINO" ? "M" : null;
    if (g) {
      setJugadores((js) => js.map((j) => ({ ...j, genero: g })));
    }
  }

  function crear() {
    const evento = crearEvento({
      nombre: nombre || `Americano ${categoriaLabel({ rama, nivel })}`,
      categoria: { rama, nivel },
      fecha,
      horaInicio,
      horaFin,
      minutosEntreRondas: club.minutosEntreRondas,
      modalidad,
      puntuacion,
      pistas,
      canchas,
      duracionRondaMin: duracion,
      totalRondas,
      jugadores,
      parejas,
      semilla,
    });
    guardar(evento);
    sonar("ok");
    vibrar([20, 40, 60]);
    toast("¡Evento creado! A jugar 🎾");
    router.push(`/evento/${evento.id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="btn-ghost !p-2.5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <Logo compacto />
        <span className="w-10 text-right text-xs font-semibold text-white/40">
          {paso + 1}/{PASOS.length}
        </span>
      </header>

      <nav className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <button key={p} onClick={() => (i <= paso ? ir(i) : ir(paso + 1))} className="group text-left">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-neon" animate={{ width: i <= paso ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
            </div>
            <span className={clsx("mt-2 hidden text-[11px] font-semibold sm:block", i === paso ? "text-white" : "text-white/40")}>{p}</span>
          </button>
        ))}
      </nav>

      <div className="relative mt-8 flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={paso}
            custom={dir}
            variants={variantes}
            initial="entra"
            animate="centro"
            exit="sale"
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {paso === 0 && (
              <Paso titulo="¿Qué categoría se juega?" sub="Staff La Marina · configura el evento">
                <span className="label">Rama</span>
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
                  onChange={cambiarRama}
                />
                <span className="label mt-8">Nivel</span>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {NIVELES.map((n) => (
                    <Opcion key={n} activo={nivel === n} onClick={() => setNivel(n)} className="py-5 text-center">
                      <span className="font-display text-xl font-bold">{nivelLabel(n, rama)}</span>
                    </Opcion>
                  ))}
                </div>
                <p className="mt-6 text-center text-sm text-white/50">
                  Categoría: <span className="font-semibold text-neon">{categoriaLabel({ rama, nivel })}</span>
                </p>
              </Paso>
            )}

            {paso === 1 && (
              <Paso titulo="Formato y puntuación" sub="¿Cómo se forman las parejas y cómo se cuenta?">
                <span className="label">Modalidad</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MODALIDADES.map((m) => (
                    <Opcion key={m.id} activo={modalidad === m.id} onClick={() => setModalidad(m.id)}>
                      <span className="flex items-center gap-2 font-semibold">
                        {m.id === "INDIVIDUAL_ROTATIVO" ? <Shuffle className="size-4 text-neon" /> : <Users className="size-4 text-neon" />}
                        {m.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/50">{m.descripcion}</span>
                    </Opcion>
                  ))}
                </div>

                <span className="label mt-8">Método de puntuación</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  {METODOS.map((m) => (
                    <Opcion
                      key={m.id}
                      activo={puntuacion.metodo === m.id}
                      onClick={() => setPuntuacion(configPorDefecto(m.id as MetodoPuntuacion))}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/50">{m.descripcion}</span>
                    </Opcion>
                  ))}
                </div>

                <div className="glass mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
                  {puntuacion.metodo === "PUNTOS_TOTALES" && (
                    <>
                      <span className="text-sm text-white/70">Puntos por partido</span>
                      <div className="flex gap-2">
                        {[16, 21, 24, 32].map((p) => (
                          <Chip key={p} activo={puntuacion.puntosPorPartido === p} onClick={() => setPuntuacion({ ...puntuacion, puntosPorPartido: p })}>
                            {p}
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}
                  {puntuacion.metodo === "GAMES_PUNTO_ORO" && (
                    <>
                      <span className="text-sm text-white/70">Games por partido</span>
                      <div className="flex gap-2">
                        {[4, 6, 9].map((g) => (
                          <Chip key={g} activo={puntuacion.gamesPorPartido === g} onClick={() => setPuntuacion({ ...puntuacion, gamesPorPartido: g })}>
                            {g}
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}
                  {puntuacion.metodo === "SETS_CORTOS" && (
                    <>
                      <span className="text-sm text-white/70">Sets</span>
                      <div className="flex gap-2">
                        {[1, 3].map((s) => (
                          <Chip key={s} activo={puntuacion.setsMaximos === s} onClick={() => setPuntuacion({ ...puntuacion, setsMaximos: s })}>
                            {s === 1 ? "1 set" : "Mejor de 3"}
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Paso>
            )}

            {paso === 2 && (
              <Paso titulo="Pistas y horario" sub="Toca las pistas que usará el evento">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">
                    <span className="font-semibold text-white">{pistas}</span> de {pistasActivas.length} pistas
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      onClick={() => {
                        vibrar(10);
                        setSeleccion(pistasActivas.filter((c) => c.techada).map((c) => c.numero));
                        toast("Solo pistas techadas ☔", "info");
                      }}
                    >
                      <CloudRain className="size-3.5" /> ¿Llueve?
                    </button>
                    <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setSeleccion(pistasActivas.map((c) => c.numero))}>
                      Todas
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {pistasActivas.map((c) => {
                    const on = seleccion.includes(c.numero);
                    return (
                      <motion.button
                        key={c.numero}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          vibrar(10);
                          setSeleccion((s) => (on ? (s.length > 1 ? s.filter((n) => n !== c.numero) : s) : [...s, c.numero]));
                          setRondasManual(null);
                        }}
                        aria-pressed={on}
                        className={clsx(
                          "relative aspect-[3/4] overflow-hidden rounded-2xl border-2 transition",
                          on ? "border-neon bg-neon/10" : "border-white/10 bg-white/[0.03]",
                        )}
                        aria-label={`${c.nombre} ${c.techada ? "techada" : "al aire libre"}`}
                      >
                        <MiniPista activa={on} />
                        <span
                          className={clsx(
                            "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full",
                            c.techada ? "bg-cielo/15 text-cielo" : "bg-amber-400/15 text-amber-300",
                          )}
                          title={c.techada ? "Techada" : "Al aire libre"}
                        >
                          {c.techada ? <Warehouse className="size-3.5" /> : <Sun className="size-3.5" />}
                        </span>
                        <span className={clsx("absolute bottom-2 left-0 right-0 text-center font-display text-sm font-bold", on ? "text-neon" : "text-white/40")}>
                          {c.nombre}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <p className="mt-3 flex items-center gap-3 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Warehouse className="size-3 text-cielo" /> Techada</span>
                  <span className="flex items-center gap-1"><Sun className="size-3 text-amber-300" /> Al aire libre</span>
                  <span>· Las techadas reciben primero los partidos.</span>
                </p>

                <div className="mt-8 flex items-center justify-between">
                  <span className="label !mb-0 flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Horario del evento
                  </span>
                  <Link href="/club" className="flex items-center gap-1 text-xs text-white/50 hover:text-neon">
                    <Settings2 className="size-3.5" /> Mi club
                  </Link>
                </div>
                <div className="glass mt-3 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <CalendarDays className="size-4 text-neon" />
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => e.target.value && setFecha(e.target.value)}
                        className="bg-transparent text-sm font-semibold outline-none [color-scheme:dark]"
                      />
                    </label>
                    <span className="text-sm text-white/60">
                      {DIAS[diaSemana(fecha)]}:{" "}
                      {horarioDia.abierto ? (
                        <span className="font-semibold text-white">
                          {horarioDia.apertura} – {horarioDia.cierre}
                        </span>
                      ) : (
                        <span className="font-semibold text-coral">cerrado</span>
                      )}
                    </span>
                  </div>
                  {slots.length > 0 && (
                    <>
                      <p className="mb-2 mt-4 text-xs text-white/50">Inicio</p>
                      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                        {slots.slice(0, -1).map((h) => (
                          <SlotChip
                            key={h}
                            activo={h === horaInicio}
                            enRango={aMinutos(h) > aMinutos(horaInicio) && aMinutos(h) < aMinutos(horaFin)}
                            onClick={() => {
                              setHoraInicio(h);
                              setRondasManual(null);
                              if (aMinutos(horaFin) <= aMinutos(h)) setHoraFin(aHora(Math.min(aMinutos(h) + 120, aMinutos(horarioDia.cierre))));
                            }}
                          >
                            {h}
                          </SlotChip>
                        ))}
                      </div>
                      <p className="mb-2 mt-3 text-xs text-white/50">Fin</p>
                      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                        {slots.filter((h) => aMinutos(h) > aMinutos(horaInicio)).map((h) => (
                          <SlotChip
                            key={h}
                            activo={h === horaFin}
                            enRango={aMinutos(h) < aMinutos(horaFin)}
                            onClick={() => {
                              setHoraFin(h);
                              setRondasManual(null);
                            }}
                          >
                            {h}
                          </SlotChip>
                        ))}
                      </div>
                    </>
                  )}
                  {errorHorario ? (
                    <p className="mt-3 text-sm text-coral">{errorHorario}</p>
                  ) : (
                    <p className="mt-3 text-sm text-white/60">
                      {horaInicio} – {horaFin} · caben <span className="font-semibold text-neon">{caben} rondas</span> de {duracion} min (+{club.minutosEntreRondas} min de cambio)
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="glass flex items-center justify-between rounded-2xl p-4">
                    <div>
                      <p className="text-sm font-semibold">Duración de ronda</p>
                      <p className="text-xs text-white/50">Cronómetro por ronda</p>
                    </div>
                    <Stepper
                      valor={duracion}
                      onChange={(v) => {
                        setDuracion(v);
                        setRondasManual(null);
                      }}
                      min={5}
                      max={45}
                      paso={5}
                      sufijo="min"
                    />
                  </div>
                  <div className="glass flex items-center justify-between rounded-2xl p-4">
                    <div>
                      <p className="text-sm font-semibold">Rondas</p>
                      <button className="text-xs text-neon/80 underline-offset-2 hover:underline" onClick={() => setRondasManual(null)}>
                        {!errorHorario && caben > 0 ? `Según horario: ${caben}` : `Sugeridas: ${sugeridas}`}
                      </button>
                    </div>
                    <Stepper valor={totalRondas} onChange={setRondasManual} min={1} max={20} />
                  </div>
                </div>
                <p className={clsx("mt-4 text-center text-sm", excedeFranja ? "text-coral" : "text-white/50")}>
                  Termina aprox. a las <span className="font-semibold text-white">{finPrevisto}</span>
                  {excedeFranja && " (se pasa del horario elegido)"} ·{" "}
                  ideal para <span className="font-semibold text-white">{modalidad === "DUPLA_FIJA" ? `${pistas * 2} parejas` : `${pistas * 4} jugadores`}</span>
                </p>
              </Paso>
            )}

            {paso === 3 && (
              <Paso
                titulo={modalidad === "DUPLA_FIJA" ? "Inscribe las parejas" : "¿Quiénes juegan?"}
                sub={modalidad === "DUPLA_FIJA" ? "Cada pareja juega contra todas" : "Escribe un nombre y presiona Enter"}
              >
                {modalidad === "DUPLA_FIJA" ? (
                  <EditorParejas
                    parejas={parejas}
                    setParejas={setParejas}
                    jugadores={jugadores}
                    setJugadores={setJugadores}
                    generoFijo={generoFijo}
                    nivel={nivel}
                  />
                ) : (
                  <EditorJugadores jugadores={jugadores} setJugadores={setJugadores} generoFijo={generoFijo} nivel={nivel} mixto={mixto} />
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {errorJugadores ? (
                    <span className="chip border-coral/30 text-coral">{errorJugadores}</span>
                  ) : (
                    <span className="chip border-neon/30 text-neon">
                      <Check className="size-3" /> {porRonda} partido(s) por ronda
                    </span>
                  )}
                  {!errorJugadores && descansan > 0 && (
                    <span className="chip">
                      {descansan} {modalidad === "DUPLA_FIJA" ? "pareja(s)" : "jugador(es)"} descansa(n) por ronda — rotan equitativamente
                    </span>
                  )}
                  {mixto && modalidad === "INDIVIDUAL_ROTATIVO" && (
                    <span className="chip">
                      <Mars className="size-3" /> {nH} · <Venus className="size-3" /> {nF}
                    </span>
                  )}
                </div>
              </Paso>
            )}

            {paso === 4 && (
              <Paso titulo="¡Todo listo!" sub="Revisa y lanza el evento">
                <span className="label">Nombre del evento</span>
                <input
                  className="input text-lg font-semibold"
                  placeholder={`Americano ${categoriaLabel({ rama, nivel })}`}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="chip text-neon">{categoriaLabel({ rama, nivel })}</span>
                  <span className="chip">{MODALIDADES.find((m) => m.id === modalidad)?.label}</span>
                  <span className="chip">{METODOS.find((m) => m.id === puntuacion.metodo)?.label}</span>
                  <span className="chip">{pistas} pistas</span>
                  <span className="chip">{totalRondas} rondas × {duracion} min</span>
                  <span className="chip">
                    <CalendarDays className="size-3" /> {DIAS[diaSemana(fecha)]} {fecha.slice(8)}/{fecha.slice(5, 7)} · {horaInicio}–{finPrevisto}
                  </span>
                  <span className="chip">{modalidad === "DUPLA_FIJA" ? `${parejas.length} parejas` : `${jugadores.length} jugadores`}</span>
                </div>

                {preview && (
                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="label !mb-0">Vista previa · Ronda 1</span>
                      <button
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => {
                          sonar("tap");
                          vibrar(10);
                          setSemilla(Math.floor(Math.random() * 2 ** 31));
                        }}
                      >
                        <Dices className="size-3.5" /> Otro sorteo
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {preview.partidos.map((p) => (
                        <motion.div key={`${semilla}-${p.id}`} initial={{ opacity: 0, rotateX: -30 }} animate={{ opacity: 1, rotateX: 0 }} className="glass rounded-2xl p-4">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-neon">{nombrePista({ canchas }, p.pista)}</p>
                          <p className="mt-2 text-sm font-semibold">{nombrePar(p.parejaA, jugadores)}</p>
                          <p className="my-1 text-[10px] font-bold text-white/30">VS</p>
                          <p className="text-sm font-semibold">{nombrePar(p.parejaB, jugadores)}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </Paso>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-noche/80 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 sm:px-6">
          {paso > 0 && (
            <button className="btn-ghost" onClick={() => ir(paso - 1)}>
              <ArrowLeft className="size-4" /> Atrás
            </button>
          )}
          {paso < PASOS.length - 1 ? (
            <button className={clsx("btn-neon flex-1 text-base", !puedeAvanzar && "opacity-50")} onClick={() => ir(paso + 1)}>
              Siguiente <ArrowRight className="size-4" />
            </button>
          ) : (
            <button className="btn-neon flex-1 text-base" onClick={crear} disabled={!!errorJugadores || !!errorHorario}>
              <Rocket className="size-5" /> Crear y abrir cuadro
            </button>
          )}
        </div>
      </footer>
    </main>
  );

  function nombrePar(p: Pareja, js: Jugador[]) {
    return p.nombre ?? p.jugadorIds.map((id) => js.find((j) => j.id === id)?.nombre).join(" / ");
  }
}

/* ---------- piezas del wizard ---------- */

function Paso({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
      <p className="mb-8 mt-2 text-white/50">{sub}</p>
      {children}
    </div>
  );
}

function Opcion({ activo, onClick, children, className }: { activo: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        vibrar(10);
        onClick();
      }}
      aria-pressed={activo}
      className={clsx(
        "relative rounded-2xl border-2 p-4 text-left transition",
        activo ? "border-neon bg-neon/10 shadow-[0_0_30px_-10px_rgba(127,227,2,0.6)]" : "border-white/10 bg-white/[0.03] hover:border-white/25",
        className,
      )}
    >
      {activo && (
        <motion.span layoutId="opcion-check" className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-neon text-noche">
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      )}
      {children}
    </motion.button>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrar(8);
        onClick();
      }}
      className={clsx("rounded-xl px-4 py-2 text-sm font-bold transition", activo ? "bg-neon text-noche" : "bg-white/5 text-white/70 hover:bg-white/10")}
    >
      {children}
    </button>
  );
}

function SlotChip({ activo, enRango, onClick, children }: { activo: boolean; enRango: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrar(8);
        onClick();
      }}
      className={clsx(
        "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular transition",
        activo ? "bg-neon text-noche" : enRango ? "bg-neon/15 text-neon" : "bg-white/5 text-white/60 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function MiniPista({ activa }: { activa: boolean }) {
  const c = activa ? "#7FE302" : "rgba(255,255,255,0.18)";
  return (
    <svg viewBox="0 0 60 80" className="absolute inset-3 bottom-8 h-[calc(100%-2.75rem)] w-[calc(100%-1.5rem)]" preserveAspectRatio="none">
      <rect x="1" y="1" width="58" height="78" rx="3" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="1" y1="40" x2="59" y2="40" stroke={c} strokeWidth="2.5" />
      <line x1="1" y1="16" x2="59" y2="16" stroke={c} strokeWidth="1" />
      <line x1="1" y1="64" x2="59" y2="64" stroke={c} strokeWidth="1" />
      <line x1="30" y1="16" x2="30" y2="64" stroke={c} strokeWidth="1" />
    </svg>
  );
}

function GeneroToggle({ genero, onChange }: { genero: Genero; onChange: (g: Genero) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrar(8);
        onChange(genero === "M" ? "F" : "M");
      }}
      className={clsx("flex size-11 shrink-0 items-center justify-center rounded-xl border transition", genero === "F" ? "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300" : "border-cielo/40 bg-cielo/10 text-cielo")}
      aria-label={genero === "F" ? "Mujer (cambiar)" : "Hombre (cambiar)"}
      title="Cambiar género"
    >
      {genero === "F" ? <Venus className="size-4" /> : <Mars className="size-4" />}
    </button>
  );
}

function crearJugador(nombreCompleto: string, genero: Genero, nivel: Nivel): Jugador {
  const [nombre, ...resto] = nombreCompleto.trim().split(/\s+/);
  return { id: nuevoId("jug_"), nombre, apellido: resto.join(" ") || undefined, genero, nivel, fotoUrl: null };
}

function EditorJugadores({
  jugadores,
  setJugadores,
  generoFijo,
  nivel,
  mixto,
}: {
  jugadores: Jugador[];
  setJugadores: React.Dispatch<React.SetStateAction<Jugador[]>>;
  generoFijo: Genero | null;
  nivel: Nivel;
  mixto: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [genero, setGenero] = useState<Genero>(generoFijo ?? "F");
  const input = useRef<HTMLInputElement>(null);
  const g = generoFijo ?? genero;

  function agregar() {
    const nombres = texto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!nombres.length) return;
    vibrar(10);
    sonar("tap");
    setJugadores((js) => [...js, ...nombres.map((n) => crearJugador(n, g, nivel))]);
    setTexto("");
    // En mixto alterna automáticamente para cargar más rápido.
    if (mixto) setGenero((x) => (x === "M" ? "F" : "M"));
    input.current?.focus();
  }

  function rellenarDemo() {
    const faltan = Math.max(4, 8 - jugadores.length);
    const nuevos: Jugador[] = [];
    for (let i = 0; i < faltan; i++) {
      const gen: Genero = generoFijo ?? (i % 2 === 0 ? "F" : "M");
      const usados = new Set([...jugadores, ...nuevos].map((j) => j.nombre));
      const n = NOMBRES_DEMO[gen].find((x) => !usados.has(x)) ?? `Jugador ${jugadores.length + i + 1}`;
      nuevos.push(crearJugador(n, gen, nivel));
    }
    setJugadores((js) => [...js, ...nuevos]);
    toast(`${nuevos.length} jugadores de ejemplo agregados`, "info");
  }

  return (
    <div>
      <div className="flex gap-2">
        {!generoFijo && <GeneroToggle genero={genero} onChange={setGenero} />}
        <input
          ref={input}
          className="input"
          placeholder="Nombre Apellido (o varios separados por coma)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button className="btn-neon !px-4" onClick={agregar} aria-label="Agregar jugador">
          <UserPlus className="size-5" />
        </button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {jugadores.map((j, i) => (
            <motion.li
              key={j.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -30 }}
              className="glass flex items-center gap-3 rounded-2xl px-3 py-2"
            >
              <span className="w-5 text-right text-xs font-semibold text-white/30">{i + 1}</span>
              <Avatar nombre={`${j.nombre} ${j.apellido ?? ""}`} size={34} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {j.nombre} {j.apellido}
              </span>
              {!generoFijo && (
                <GeneroToggle genero={j.genero} onChange={(gen) => setJugadores((js) => js.map((x) => (x.id === j.id ? { ...x, genero: gen } : x)))} />
              )}
              <button
                className="rounded-lg p-2 text-white/40 hover:bg-coral/10 hover:text-coral"
                onClick={() => setJugadores((js) => js.filter((x) => x.id !== j.id))}
                aria-label={`Quitar a ${j.nombre}`}
              >
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-ghost !py-2 text-xs" onClick={rellenarDemo}>
          <Dices className="size-3.5" /> Rellenar con jugadores demo
        </button>
        {jugadores.length > 0 && (
          <button className="btn-ghost !py-2 text-xs text-coral" onClick={() => setJugadores([])}>
            <Trash2 className="size-3.5" /> Vaciar
          </button>
        )}
      </div>
    </div>
  );
}

function EditorParejas({
  parejas,
  setParejas,
  jugadores,
  setJugadores,
  generoFijo,
  nivel,
}: {
  parejas: Pareja[];
  setParejas: React.Dispatch<React.SetStateAction<Pareja[]>>;
  jugadores: Jugador[];
  setJugadores: React.Dispatch<React.SetStateAction<Jugador[]>>;
  generoFijo: Genero | null;
  nivel: Nivel;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const refA = useRef<HTMLInputElement>(null);
  const porId = new Map(jugadores.map((j) => [j.id, j]));

  function agregar(na = a, nb = b) {
    if (!na.trim() || !nb.trim()) {
      toast("Escribe los dos nombres de la pareja", "error");
      return;
    }
    // En dupla mixta: primer jugador hombre, segundo mujer.
    const ja = crearJugador(na, generoFijo ?? "M", nivel);
    const jb = crearJugador(nb, generoFijo ?? "F", nivel);
    setJugadores((js) => [...js, ja, jb]);
    setParejas((ps) => [...ps, { id: nuevoId("par_"), jugadorIds: [ja.id, jb.id], nombre: `${ja.nombre} / ${jb.nombre}` }]);
    setA("");
    setB("");
    vibrar(10);
    sonar("tap");
    refA.current?.focus();
  }

  function quitar(p: Pareja) {
    setParejas((ps) => ps.filter((x) => x.id !== p.id));
    setJugadores((js) => js.filter((j) => !p.jugadorIds.includes(j.id)));
  }

  function rellenarDemo() {
    const faltan = Math.max(2, 6 - parejas.length);
    const gA: Genero = generoFijo ?? "M";
    const gB: Genero = generoFijo ?? "F";
    const usados = new Set(jugadores.map((j) => j.nombre));
    const libres = (g: Genero) => NOMBRES_DEMO[g].filter((n) => !usados.has(n));
    const la = libres(gA);
    const lb = gA === gB ? la.slice(faltan) : libres(gB);
    const nuevosJ: Jugador[] = [];
    const nuevasP: Pareja[] = [];
    for (let i = 0; i < faltan; i++) {
      const ja = crearJugador(la[i] ?? `Jugador ${i * 2 + 1}`, gA, nivel);
      const jb = crearJugador(lb[i] ?? `Jugador ${i * 2 + 2}`, gB, nivel);
      nuevosJ.push(ja, jb);
      nuevasP.push({ id: nuevoId("par_"), jugadorIds: [ja.id, jb.id], nombre: `${ja.nombre} / ${jb.nombre}` });
    }
    setJugadores((js) => [...js, ...nuevosJ]);
    setParejas((ps) => [...ps, ...nuevasP]);
    toast(`${faltan} parejas de ejemplo agregadas`, "info");
  }

  return (
    <div>
      <div className="glass flex flex-col gap-2 rounded-2xl p-3 sm:flex-row">
        <input ref={refA} className="input" placeholder="Jugador 1" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()} />
        <input className="input" placeholder="Jugador 2" value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()} />
        <button className="btn-neon" onClick={() => agregar()}>
          <Plus className="size-4" /> Pareja
        </button>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {parejas.map((p, i) => {
            const [x, y] = p.jugadorIds.map((id) => porId.get(id));
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -30 }}
                className="glass flex items-center gap-3 rounded-2xl px-3 py-2"
              >
                <span className="w-5 text-right text-xs font-semibold text-white/30">{i + 1}</span>
                <span className="flex -space-x-2">
                  <Avatar nombre={x?.nombre ?? "?"} size={32} />
                  <Avatar nombre={y?.nombre ?? "?"} size={32} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                <button className="rounded-lg p-2 text-white/40 hover:bg-coral/10 hover:text-coral" onClick={() => quitar(p)} aria-label="Quitar pareja">
                  <X className="size-4" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <button className="btn-ghost mt-4 !py-2 text-xs" onClick={rellenarDemo}>
        <Dices className="size-3.5" /> Rellenar con parejas demo
      </button>
    </div>
  );
}
