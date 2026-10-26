"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BarChart3, Coins, Eye, HeartPulse, LockKeyhole, Repeat, Undo2, Volume2, VolumeX } from "lucide-react";
import { Confetti } from "@/components/ui/Confetti";
import { toast } from "@/components/ui/Toaster";
import { MarcadorTenis, textoResultado, TEXTO_AVISO, useVistaPartido } from "@/components/tenis/Marcador";
import { Cancha, PelotaTenis, temaSuperficie } from "@/components/tenis/piezas";
import { esArbitroDe, useArbitro } from "@/lib/arbitro";
import { formatoReloj, sonar, vibrar } from "@/lib/feedback";
import { useAmericanos, useEsStaff } from "@/lib/store";
import { usePartidoTenis, useTenis } from "@/lib/tenisStore";
import { anotar, canto, deshacer, falta, nuevoMarcador } from "@/lib/tenis/marcador";
import { actualizarPartido, inscrito, nombreInscrito, SUPERFICIES } from "@/lib/tenis/torneo";
import type { Lado, MarcadorTenis as Marcador, PartidoTenis, TipoPunto, TorneoTenis } from "@/types/tenis";

const RELOJ_SAQUE = 25;

export default function AnotarTenisPage() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const { torneo: t, partido: p } = usePartidoTenis(id, pid);
  const hidratado = useTenis((s) => s.hidratado);
  const esStaff = useEsStaff();
  const arbitro = useArbitro();
  const setPedirLogin = useAmericanos((s) => s.setPedirLogin);
  const puede = !!esStaff || esArbitroDe(arbitro);

  if (!t || !p)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {hidratado ? <p className="text-white/60">Partido no encontrado.</p> : <PelotaTenis className="size-12" girando />}
      </main>
    );
  if (esStaff === undefined || arbitro === undefined)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <PelotaTenis className="size-12" girando />
      </main>
    );
  if (!puede)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <LockKeyhole className="size-12 text-neon" />
        <h1 className="font-display text-2xl font-bold">Solo staff o árbitros</h1>
        <p className="max-w-sm text-white/60">Para anotar este partido entra como staff o como árbitro del club. Puedes seguirlo en vivo sin entrar.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/tenis/t/${t.id}/p/${p.id}`} className="btn-ghost">
            Ver en vivo
          </Link>
          <Link href="/arbitro" className="btn-ghost">
            Soy árbitro
          </Link>
          <button className="btn-neon" onClick={() => setPedirLogin(true)}>
            Soy staff
          </button>
        </div>
      </main>
    );
  if (!p.a || !p.b) return <main className="flex min-h-dvh items-center justify-center text-white/60">Este partido todavía no tiene a los dos rivales.</main>;
  return (
    <div style={temaSuperficie(t.superficie)}>
      {p.marcador ? <Anotador torneo={t} partido={p} /> : <AntesDeEmpezar torneo={t} partido={p} quien={esStaff ? "Staff" : arbitro ? `Árbitro ${arbitro.nombre}` : null} />}
    </div>
  );
}

/* ---------- Antes de empezar: sorteo, saque y lados ---------- */

function AntesDeEmpezar({ torneo: t, partido: p, quien }: { torneo: TorneoTenis; partido: PartidoTenis; quien: string | null }) {
  const guardar = useTenis((s) => s.guardar);
  const d = SUPERFICIES[t.superficie];
  const [gano, setGano] = useState<Lado | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [eligio, setEligio] = useState<"SACAR" | "RESTAR" | "LADO" | null>(null);
  const [saca, setSaca] = useState<Lado | null>(null);
  const [primeros, setPrimeros] = useState<[number, number]>([0, 0]);
  const [ladoA, setLadoA] = useState<"IZQ" | "DER">("IZQ");
  const ins = [inscrito(t, p.a)!, inscrito(t, p.b)!];
  const corto = (l: Lado) => nombreInscrito(t, l === 0 ? p.a : p.b, true);
  const sacaFinal: Lado | null = eligio === "SACAR" ? gano : eligio === "RESTAR" && gano !== null ? ((1 - gano) as Lado) : saca;
  const dobles = t.modalidad === "DOBLES";

  const lanzar = () => {
    setLanzando(true);
    vibrar([10, 40, 10]);
    setTimeout(() => {
      setGano(Math.random() < 0.5 ? 0 : 1);
      setLanzando(false);
      sonar("ok");
    }, 1200);
  };

  const empezar = () => {
    if (sacaFinal === null) return;
    const s = ins[sacaFinal].jugadores;
    const r = ins[1 - sacaFinal].jugadores;
    const ps = primeros[sacaFinal];
    const pr = primeros[1 - sacaFinal];
    const orden = dobles ? [s[ps].id, r[pr].id, s[1 - ps].id, r[1 - pr].id] : [s[0].id, r[0].id];
    const m = nuevoMarcador(orden, ladoA, gano !== null && eligio ? { gano, eligio } : null, quien);
    guardar(actualizarPartido(t, p.id, (x) => ({ ...x, estado: "EN_JUEGO", marcador: m })));
    sonar("ok");
  };

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2 py-3">
        <Link href={`/tenis/t/${t.id}`} className="btn-ghost !p-2.5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-xs text-white/50">
            {t.nombre}
            {p.cancha ? ` · Cancha ${p.cancha}` : ""}
          </p>
          <h1 className="font-display text-xl font-bold">Antes de empezar</h1>
        </div>
      </header>

      <div className="glass mt-2 rounded-3xl p-5 text-center">
        <p className="font-display text-xl font-bold">
          {nombreInscrito(t, p.a)} <span className="text-white/35">vs</span> {nombreInscrito(t, p.b)}
        </p>
      </div>

      <Paso n={1} titulo="Sorteo" listo={gano !== null}>
        <div className="flex flex-col items-center">
          <motion.div
            animate={lanzando ? { rotateY: [0, 1800], y: [0, -90, 0] } : { rotateY: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="flex size-20 items-center justify-center rounded-full text-3xl font-black shadow-xl"
            style={{ background: "radial-gradient(circle at 35% 30%, #fff6c8, #e2b33c 60%, #a87912)", color: "#6b4a00" }}
          >
            <Coins className="size-9" />
          </motion.div>
          {gano !== null && !lanzando && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 font-display text-lg font-bold">
              Ganó {corto(gano)}
            </motion.p>
          )}
          <button className="btn-ghost mt-4" onClick={lanzar} disabled={lanzando}>
            <Coins className="size-4" /> Lanzar la moneda
          </button>
          <p className="mt-3 text-xs text-white/50">o marca quién ganó el sorteo con la moneda de verdad:</p>
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            {([0, 1] as Lado[]).map((l) => (
              <Opcion key={l} activo={gano === l} onClick={() => setGano(l)}>
                {corto(l)}
              </Opcion>
            ))}
          </div>
        </div>
      </Paso>

      {gano !== null && (
        <Paso n={2} titulo={`¿Qué eligió ${corto(gano)}?`} listo={!!eligio}>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["SACAR", "Sacar"],
                ["RESTAR", "Restar"],
                ["LADO", "Lado"],
              ] as const
            ).map(([v, l]) => (
              <Opcion key={v} activo={eligio === v} onClick={() => setEligio(v)}>
                {l}
              </Opcion>
            ))}
          </div>
          {eligio === "LADO" && (
            <>
              <p className="mt-3 text-sm text-white/60">Entonces {corto((1 - gano) as Lado)} elige saque o resto. ¿Quién saca primero?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([0, 1] as Lado[]).map((l) => (
                  <Opcion key={l} activo={saca === l} onClick={() => setSaca(l)}>
                    {corto(l)}
                  </Opcion>
                ))}
              </div>
            </>
          )}
        </Paso>
      )}

      {sacaFinal !== null && dobles && (
        <Paso n={3} titulo="Orden de saque" listo>
          {([sacaFinal, (1 - sacaFinal) as Lado] as Lado[]).map((l, k) => (
            <div key={l} className={k ? "mt-3" : ""}>
              <p className="mb-2 text-sm text-white/60">{k === 0 ? "¿Quién saca el primer juego?" : `En ${corto(l)}, ¿quién saca primero?`}</p>
              <div className="grid grid-cols-2 gap-2">
                {ins[l].jugadores.map((j, i) => (
                  <Opcion key={j.id} activo={primeros[l] === i} onClick={() => setPrimeros((x) => (l === 0 ? [i, x[1]] : [x[0], i]))}>
                    {j.nombre}
                  </Opcion>
                ))}
              </div>
            </div>
          ))}
        </Paso>
      )}

      {sacaFinal !== null && (
        <Paso n={dobles ? 4 : 3} titulo="Lados (vistos desde la silla del árbitro)" listo>
          <div className="grid grid-cols-2 gap-2">
            {(["IZQ", "DER"] as const).map((l) => (
              <Opcion key={l} activo={ladoA === l} onClick={() => setLadoA(l)}>
                {corto(0)} a la {l === "IZQ" ? "izquierda" : "derecha"}
              </Opcion>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl">
            <Cancha
              superficie={t.superficie}
              izquierda={ins[ladoA === "IZQ" ? 0 : 1].jugadores.map((j) => ({ nombre: j.nombre, equipo: ladoA === "IZQ" ? 0 : 1 }))}
              derecha={ins[ladoA === "IZQ" ? 1 : 0].jugadores.map((j) => ({ nombre: j.nombre, equipo: ladoA === "IZQ" ? 1 : 0 }))}
              saque={{ lado: (sacaFinal === 0) === (ladoA === "IZQ") ? "IZQ" : "DER", desde: "DERECHA", jugador: dobles ? primeros[sacaFinal] : 0 }}
            />
          </div>
        </Paso>
      )}

      <button
        className="btn mt-8 w-full py-4 text-lg font-bold text-blanco shadow-xl"
        style={{ background: `linear-gradient(135deg, ${d.color}, ${d.oscuro})` }}
        disabled={sacaFinal === null}
        onClick={empezar}
      >
        <PelotaTenis className="size-6" /> Empezar el partido
      </button>
      <p className="mt-3 text-center text-xs text-white/40">Peloteo de calentamiento: 5 minutos (ITF).</p>
    </main>
  );
}

function Paso({ n, titulo, listo, children }: { n: number; titulo: string; listo: boolean; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className={clsx("flex size-6 items-center justify-center rounded-full text-xs font-bold", listo ? "text-blanco" : "bg-white/10")} style={listo ? { background: "var(--sup)" } : undefined}>
          {n}
        </span>
        {titulo}
      </h2>
      {children}
    </motion.section>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrar(8);
        onClick();
      }}
      className={clsx("glass truncate rounded-2xl px-3 py-3.5 text-sm font-semibold transition active:scale-[0.97]", activo && "!border-transparent text-blanco")}
      style={activo ? { background: "linear-gradient(135deg, var(--sup), var(--sup-oscuro))" } : undefined}
    >
      {children}
    </button>
  );
}

/* ---------- El anotador ---------- */

function useVoz() {
  const [activa, setActiva] = useState(false);
  useEffect(() => {
    try {
      setActiva(localStorage.getItem("tenis-voz") === "1");
    } catch {
      /* nada */
    }
  }, []);
  const cambiar = (v: boolean) => {
    setActiva(v);
    try {
      localStorage.setItem("tenis-voz", v ? "1" : "0");
    } catch {
      /* nada */
    }
  };
  const decir = (texto: string) => {
    if (!activa || !texto || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-ES";
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  return { activa, cambiar, decir };
}

function Anotador({ torneo: t, partido: p }: { torneo: TorneoTenis; partido: PartidoTenis }) {
  const guardar = useTenis((s) => s.guardar);
  const v = useVistaPartido(t, p)!;
  const e = v.e!;
  const m = p.marcador!;
  const d = SUPERFICIES[t.superficie];
  const voz = useVoz();
  const arcilla = t.superficie === "ARCILLA";
  const terminado = e.ganador !== null || !!p.resultado;
  const ins = [inscrito(t, p.a)!, inscrito(t, p.b)!];
  const sacadorId = m.ordenSaque[e.turnoSaque];
  const sacador = ins[e.equipoSaca].jugadores.find((j) => j.id === sacadorId);
  const [marcaAbierta, setMarcaAbierta] = useState(false);
  const [pausa, setPausa] = useState<{ hasta: number; texto: string } | null>(null);
  const [ultimoEn, setUltimoEn] = useState<number>(() => (m.puntos.at(-1) ? new Date(m.puntos.at(-1)!.en).getTime() : Date.now()));
  const [ahora, setAhora] = useState(Date.now());
  const primerRender = useRef(true);

  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  // Tras cada punto: cambio de lado / descanso y canto en voz alta.
  const nPuntos = m.puntos.length;
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    if (!nPuntos) return;
    setUltimoEn(Date.now());
    if (e.ganador !== null) {
      voz.decir(`Juego, set y partido, ${nombreInscrito(t, e.ganador === 0 ? p.a : p.b, true)}`);
      return;
    }
    if (e.descanso || e.cambioDeLado) {
      const texto = e.descanso === 120 ? "Descanso entre sets" : e.cambioDeLado ? (e.descanso ? "Cambio de lado" : "Cambio de lado sin descanso") : "";
      if (e.descanso) setPausa({ hasta: Date.now() + e.descanso * 1000, texto });
      else toast(texto, "info");
      vibrar([30, 60, 30]);
    }
    const gano = nombreInscrito(t, m.puntos.at(-1)!.g === 0 ? p.a : p.b, true);
    voz.decir(e.finSet ? `Juego y set, ${gano}` : e.finJuego ? `Juego, ${gano}` : canto(e, t.reglas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nPuntos]);

  const subir = (nuevo: Marcador) => guardar(actualizarPartido(t, p.id, (x) => ({ ...x, estado: "EN_JUEGO", marcador: nuevo })));
  const punto = (g: Lado, tipo?: TipoPunto, j?: string) => {
    if (terminado) return;
    vibrar(15);
    sonar("tap");
    subir(anotar(m, g, tipo, j));
  };
  const detalle = (tipo: TipoPunto) => {
    const ultimo = m.puntos.at(-1);
    if (!ultimo || ultimo.tipo === "ACE" || ultimo.tipo === "DOBLE_FALTA") return;
    subir({ ...m, puntos: [...m.puntos.slice(0, -1), { ...ultimo, tipo: ultimo.tipo === tipo ? undefined : tipo }] });
  };

  const izquierdaEsA = e.ladoA === "IZQ";
  const lados: Lado[] = izquierdaEsA ? [0, 1] : [1, 0];
  const restante = pausa ? Math.ceil((pausa.hasta - ahora) / 1000) : 0;
  const relojSaque = Math.max(0, RELOJ_SAQUE - Math.floor((ahora - ultimoEn) / 1000));
  const ultimo = m.puntos.at(-1);
  const posJugador = (l: Lado) => ins[l].jugadores.map((j) => ({ nombre: j.nombre, equipo: l }));
  const saqueEnCancha = terminado ? null : { lado: (e.equipoSaca === 0) === izquierdaEsA ? ("IZQ" as const) : ("DER" as const), desde: e.ladoSaque, jugador: Math.max(0, ins[e.equipoSaca].jugadores.findIndex((j) => j.id === sacadorId)) };

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2 py-2">
        <Link href={`/tenis/t/${t.id}`} className="btn-ghost !p-2.5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-xs text-white/50">
          {p.cancha ? <b className="text-white/80">Cancha {p.cancha} · </b> : null}
          {t.nombre}
        </p>
        <button className="btn-ghost !p-2.5" onClick={() => voz.cambiar(!voz.activa)} title={voz.activa ? "Silenciar el canto" : "Cantar el marcador en voz alta"}>
          {voz.activa ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <Link href={`/tenis/t/${t.id}/p/${p.id}`} className="btn-ghost !p-2.5" aria-label="Estadísticas">
          <BarChart3 className="size-4" />
        </Link>
      </header>

      <div className="glass rounded-3xl px-4 py-3">
        <MarcadorTenis torneo={t} partido={p} />
      </div>

      {!terminado && (
        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <AnimatePresence mode="popLayout">
              <motion.p key={nPuntos} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="truncate font-display text-2xl font-bold">
                {canto(e, t.reglas) || "Cero iguales"}
              </motion.p>
            </AnimatePresence>
            <p className="truncate text-xs text-white/50">
              Saca <b className="text-white/80">{sacador?.nombre}</b> desde la {e.ladoSaque === "DERECHA" ? "derecha" : "izquierda"}
              {m.falta && <b className="ml-1 text-amber-200">· 2º saque</b>}
              {e.enTieBreak && <b className="ml-1" style={{ color: d.claro }}>· {e.superTieBreak ? "Súper tie-break" : "Tie-break"} a {e.objetivoTieBreak}</b>}
            </p>
          </div>
          <RelojSaque segundos={relojSaque} />
        </div>
      )}

      <div className="relative mt-3 overflow-hidden rounded-3xl ring-1 ring-white/10">
        <Cancha superficie={t.superficie} izquierda={posJugador(lados[0])} derecha={posJugador(lados[1])} saque={saqueEnCancha} />
        {v.aviso && !terminado && (
          <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-[#dcf03c] px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f1a2e" }}>
            {TEXTO_AVISO[v.aviso.tipo]}
          </span>
        )}
      </div>

      {terminado ? (
        <Final torneo={t} partido={p} onDeshacer={() => subir(deshacer(m))} />
      ) : (
        <>
          {/* Un botón por lado de la cancha, como lo ve el árbitro desde la silla. */}
          <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
            {lados.map((l) => (
              <motion.button
                key={l}
                whileTap={{ scale: 0.96 }}
                onClick={() => punto(l)}
                className={clsx(
                  "flex min-h-36 flex-col items-center justify-center rounded-3xl p-3 text-center shadow-xl ring-1 transition",
                  l === 0 ? "bg-[#0f1a2e] text-blanco ring-[#dcf03c]/60" : "bg-blanco ring-white/20",
                )}
                style={l === 1 ? { color: "#0f1a2e" } : undefined}
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest opacity-60">Punto</span>
                <span className="mt-1 line-clamp-2 font-display text-xl font-bold leading-tight sm:text-2xl">{nombreInscrito(t, l === 0 ? p.a : p.b, true)}</span>
                {e.equipoSaca === l && <PelotaTenis className="mt-2 size-6" />}
              </motion.button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <BotonChico onClick={() => subir(falta(m, e.equipoSaca, sacadorId))} activo={m.falta} titulo={m.falta ? "Doble falta" : "Falta"} />
            <BotonChico onClick={() => punto(e.equipoSaca, "ACE", sacadorId)} titulo="Ace" />
            {arcilla ? <BotonChico onClick={() => setMarcaAbierta(true)} titulo="Ver marca" icono={<Eye className="size-4" />} /> : <BotonChico onClick={() => setPausa({ hasta: Date.now() + 180_000, texto: "Atención médica" })} titulo="Médico 3:00" icono={<HeartPulse className="size-4" />} />}
            <BotonChico onClick={() => m.puntos.length || m.falta ? subir(deshacer(m)) : undefined} titulo="Deshacer" icono={<Undo2 className="size-4" />} />
          </div>

          {ultimo && ultimo.tipo !== "ACE" && ultimo.tipo !== "DOBLE_FALTA" && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-[11px] text-white/45">Último punto:</span>
              {(
                [
                  ["WINNER", "Winner"],
                  ["ERROR_NF", "Error no forzado"],
                  ["ERROR_F", "Error forzado"],
                ] as const
              ).map(([tipo, label]) => (
                <button key={tipo} onClick={() => detalle(tipo)} className={clsx("chip shrink-0 transition", ultimo.tipo === tipo && "!border-transparent !text-blanco")} style={ultimo.tipo === tipo ? { background: "var(--sup)" } : undefined}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {pausa && restante > 0 && (
          <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6 text-center backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="label !text-white/60">{pausa.texto}</p>
            <p className="font-display text-8xl font-bold tabular" style={{ color: restante <= 15 ? "#dcf03c" : undefined }}>
              {formatoReloj(restante)}
            </p>
            {e.cambioDeLado && pausa.texto !== "Atención médica" && <p className="mt-3 flex items-center gap-2 text-white/70"><Repeat className="size-4" /> Los jugadores cambian de lado</p>}
            {arcilla && e.descanso === 120 && <p className="mt-2 max-w-xs text-sm text-white/55">Buen momento para barrer las líneas.</p>}
            <button className="btn-ghost mt-8" onClick={() => setPausa(null)}>
              Seguir
            </button>
          </motion.div>
        )}
        {marcaAbierta && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMarcaAbierta(false)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="glass-strong w-full max-w-md rounded-t-[2rem] p-6 sm:rounded-[2rem]" onClick={(ev) => ev.stopPropagation()}>
              <p className="font-display text-xl font-bold">Revisión de marca</p>
              <p className="mt-1 text-sm text-white/60">En arcilla el árbitro puede bajar a ver la marca de la pelota. ¿Qué dice la marca?</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(["BUENA", "MALA"] as const).map((r) => (
                  <button
                    key={r}
                    className="btn-ghost py-4 text-base"
                    onClick={() => {
                      subir({ ...m, marcas: [...m.marcas, { en: new Date().toISOString(), punto: m.puntos.length - 1, resultado: r }] });
                      setMarcaAbierta(false);
                      toast(r === "BUENA" ? "Marca: tocó la línea, buena" : "Marca: afuera, mala", "info");
                    }}
                  >
                    {r === "BUENA" ? "Buena (tocó línea)" : "Mala (afuera)"}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/45">Si la marca cambia el punto, toca Deshacer y anota el punto correcto.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function BotonChico({ titulo, onClick, activo = false, icono }: { titulo: string; onClick: () => void; activo?: boolean; icono?: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        vibrar(10);
        onClick();
      }}
      className={clsx("glass flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-semibold transition active:scale-[0.95]", activo && "!border-amber-300/60 text-amber-200")}
    >
      {icono}
      {titulo}
    </button>
  );
}

function RelojSaque({ segundos }: { segundos: number }) {
  const pct = segundos / RELOJ_SAQUE;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0" title="Reloj de saque: 25 segundos entre puntos">
      <svg viewBox="0 0 48 48" className="size-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={segundos <= 5 ? "#ff6b86" : "var(--sup-claro)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span className={clsx("absolute inset-0 flex items-center justify-center font-display text-lg font-bold tabular", segundos <= 5 && "text-coral")}>{segundos}</span>
    </div>
  );
}

function Final({ torneo: t, partido: p, onDeshacer }: { torneo: TorneoTenis; partido: PartidoTenis; onDeshacer: () => void }) {
  const g = p.resultado?.ganador ?? null;
  const [confeti, setConfeti] = useState(true);
  useEffect(() => {
    const x = setTimeout(() => setConfeti(false), 3500);
    return () => clearTimeout(x);
  }, []);
  const siguiente = useMemo(() => t.partidos.find((x) => x.id !== p.id && x.a && x.b && !x.resultado && x.estado !== "EN_JUEGO"), [t, p.id]);
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
      <Confetti activo={confeti} />
      <p className="text-5xl">🏆</p>
      <p className="mt-2 font-display text-2xl font-bold">{g !== null ? nombreInscrito(t, g === 0 ? p.a : p.b) : ""}</p>
      <p className="mt-1 text-white/60">gana {textoResultado(t, p)}</p>
      {t.superficie === "ARCILLA" && (
        <div className="glass mx-auto mt-5 max-w-sm rounded-2xl p-4 text-left text-sm">
          <p className="font-semibold" style={{ color: "var(--sup-claro)" }}>
            Cancha de arcilla
          </p>
          <p className="mt-1 text-white/65">Antes del próximo partido: pasen la rastra, barran las líneas y rieguen si está seca.</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={`/tenis/t/${t.id}/p/${p.id}`} className="btn-ghost">
          <BarChart3 className="size-4" /> Estadísticas
        </Link>
        {siguiente && (
          <Link href={`/tenis/t/${t.id}/p/${siguiente.id}/anotar`} className="btn text-blanco" style={{ background: "linear-gradient(135deg, var(--sup), var(--sup-oscuro))" }}>
            Siguiente partido
          </Link>
        )}
        <Link href={`/tenis/t/${t.id}`} className="btn-ghost">
          Volver al cuadro
        </Link>
        {p.resultado?.tipo === "NORMAL" && (
          <button className="btn-ghost text-white/60" onClick={onDeshacer}>
            <Undo2 className="size-4" /> Deshacer último punto
          </button>
        )}
      </div>
    </motion.section>
  );
}
