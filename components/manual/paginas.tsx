import type { ReactNode } from "react";

/** Contenido del manual de la app. Cada entrada es una página; el orden es el del libro (portada = 0). */
export type Pagina = {
  tipo?: "tapa" | "contratapa" | "apertura";
  /** Título corrido que se muestra arriba de la página. */
  seccion?: string;
  cuerpo: ReactNode;
  /** Primera página de un capítulo: sale en el índice. */
  capitulo?: { n: string; titulo: string };
};

function Pasos({ items }: { items: ReactNode[] }) {
  return (
    <ol className="ml-pasos">
      {items.map((t, i) => (
        <li key={i}>
          <span className="ml-paso-n">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Nota({ titulo, children, tono = "neon" }: { titulo: string; children: ReactNode; tono?: "neon" | "cielo" | "coral" }) {
  return (
    <aside className={`ml-nota ml-nota-${tono}`}>
      <b>{titulo}</b>
      <div>{children}</div>
    </aside>
  );
}

function Captura({ src, alt, ancho = false }: { src: string; alt: string; ancho?: boolean }) {
  return (
    <figure className={ancho ? "ml-captura ml-captura-ancha" : "ml-captura"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" draggable={false} />
    </figure>
  );
}

function Apertura({ n, titulo, bajada }: { n: string; titulo: string; bajada: string }) {
  return (
    <header className="ml-apertura">
      <span className="ml-cap-n">{n}</span>
      <p className="ml-eyebrow">Capítulo {n}</p>
      <h2>{titulo}</h2>
      <p className="ml-bajada">{bajada}</p>
    </header>
  );
}


/** Captura del celular a la izquierda y el texto a la derecha. */
function ConCaptura({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  return (
    <div className="ml-con-captura">
      <Captura src={`/manual/${src}.webp`} alt={alt} />
      <div>{children}</div>
    </div>
  );
}

const B = ({ children }: { children: ReactNode }) => <b className="ml-btn">{children}</b>;

/** Abre un capítulo: queda en el índice con el número de página donde empieza. */
function capitulo(n: string, titulo: string, bajada: string, resto: ReactNode): Pagina {
  return {
    tipo: "apertura",
    seccion: titulo,
    capitulo: { n, titulo },
    cuerpo: (
      <>
        <Apertura n={n} titulo={titulo} bajada={bajada} />
        {resto}
      </>
    ),
  };
}

const pagina = (seccion: string, cuerpo: ReactNode): Pagina => ({ seccion, cuerpo });

const CONTENIDO: Pagina[] = [
  // Portada
  {
    tipo: "tapa",
    cuerpo: (
      <div className="ml-tapa">
        <svg className="ml-tapa-cancha" viewBox="0 0 100 140" aria-hidden="true">
          <rect x="14" y="10" width="72" height="120" rx="1" />
          <line x1="14" y1="70" x2="86" y2="70" />
          <line x1="14" y1="41" x2="86" y2="41" />
          <line x1="14" y1="99" x2="86" y2="99" />
          <line x1="50" y1="41" x2="50" y2="99" />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="La Marina Sport Club" className="ml-tapa-logo" draggable={false} />
        <div className="ml-tapa-titulo">
          <p className="ml-eyebrow">Americanos · Torneos · Árbitros</p>
          <h1>
            Manual
            <br />
            <span>de la A a la Z</span>
          </h1>
          <p>Todo lo que tiene la app del club: para el staff, los árbitros, los jugadores y el dueño.</p>
        </div>
        <p className="ml-tapa-pie">Edición octubre 2026 · PadelReserve</p>
      </div>
    ),
  },
  pagina(
    "Bienvenida",
    <>
      <p className="ml-eyebrow">Antes de pasar la hoja</p>
      <h2>Hola, equipo.</h2>
      <p>
        Este libro explica la app de La Marina de punta a punta: americanos, torneos, árbitros, pantallas de TV y lo que ve cada
        jugador. Está escrito para leerlo en la pista, con el celular en la mano.
      </p>
      <p>No hace falta leerlo entero. Busca en el índice lo que necesitas hoy.</p>
      <h3>Cómo leer este libro</h3>
      <ul className="ml-lista">
        <li>Arrastra la esquina de la hoja o desliza con el dedo para pasar página.</li>
        <li>En el computador también funcionan las flechas ← → del teclado.</li>
        <li>
          <B>Índice</B> te lleva a cualquier capítulo y <B>Aa</B> agranda la letra.
        </li>
        <li>
          ¿Lo quieres en papel? Abre <b>/manual/imprimir</b> y guárdalo como PDF.
        </li>
      </ul>
      <Nota titulo="Las capturas" tono="cielo">
        Son de la app con los <b>datos de prueba</b> cargados. Lo tuyo se verá igual, con tus nombres.
      </Nota>
    </>,
  ),
  { seccion: "Índice", cuerpo: null },

  // 1 · Conoce la app
  capitulo(
    "1",
    "Conoce la app",
    "Qué es, quién hace qué y cómo moverte.",
    <ConCaptura src="inicio" alt="Inicio de la app con Americanos, Torneos y Árbitros">
      <p>
        La app organiza los <b>americanos</b> y los <b>torneos</b> de pádel del club, y le da a cada <b>árbitro</b> una tablet para
        anotar punto a punto. Funciona en celular, tablet, computador y en las teles del club.
      </p>
      <p>
        El inicio tiene tres puertas: <B>Americanos</B>, <B>Torneos</B> y <B>Árbitros</B>. Arriba están <B>Soy staff</B> y el menú{" "}
        <B>☰</B>.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Conoce la app",
    <>
      <h2>Cinco personas, cinco vistas</h2>
      <div className="ml-tabla-wrap">
        <table className="ml-tabla">
          <thead>
            <tr>
              <th>Quién</th>
              <th>Qué puede hacer</th>
              <th>Cómo entra</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Público</th>
              <td>Ver americanos, cuadro, ranking y TV. No cambia nada.</td>
              <td>Sin cuenta</td>
            </tr>
            <tr>
              <th>Jugador</th>
              <td>Ver su torneo: cuadros, horarios, partidos y estadísticas.</td>
              <td>Clave del torneo</td>
            </tr>
            <tr>
              <th>Árbitro</th>
              <td>Llamar, empezar y anotar partidos de torneo. Nada más.</td>
              <td>Su nombre y su código</td>
            </tr>
            <tr>
              <th>Staff</th>
              <td>Crear y manejar todo: eventos, torneos, inscritos, horarios, ajustes.</td>
              <td>PIN del club</td>
            </tr>
            <tr>
              <th>Dueño</th>
              <td>Lo mismo que el staff, más el resumen del club en Stats.</td>
              <td>PIN del club</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>Instalar la app</h3>
      <ul className="ml-lista">
        <li>
          <b>Android / Chrome:</b> menú ⋮ → <B>Instalar app</B>.
        </li>
        <li>
          <b>iPhone:</b> en Safari, Compartir → <B>Agregar a inicio</B>.
        </li>
        <li>
          <b>Computador:</b> el ícono de instalar en la barra de direcciones.
        </li>
      </ul>
    </>,
  ),
  pagina(
    "Conoce la app",
    <ConCaptura src="menu" alt="Menú lateral con las secciones de la app">
      <h2>El menú ☰</h2>
      <p>Arriba a la derecha, en el inicio y en Ajustes. Tiene todo a un toque:</p>
      <ul className="ml-lista">
        <li>
          <b>La app:</b> Inicio, Americanos, Torneos y Árbitros.
        </li>
        <li>
          <b>Staff:</b> Nuevo americano, Nuevo torneo, Ranking FVP y este manual.
        </li>
        <li>
          <b>Ajustes:</b> Datos de prueba, Mi club, Árbitros del club y Claves de torneos.
        </li>
      </ul>
      <Nota titulo="El candado">
        Lo que tiene candado es del staff. Al tocarlo pide el PIN y después abre la sección.
      </Nota>
    </ConCaptura>,
  ),

  // 2 · Staff
  capitulo(
    "2",
    "Entrar como staff",
    "Un PIN de 4 números para todo el equipo.",
    <ConCaptura src="pin-staff" alt="Teclado para escribir el PIN del staff">
      <Pasos
        items={[
          <>
            Toca <B>Soy staff</B> (o cualquier opción con candado).
          </>,
          <>Escribe el PIN del club. Con 4 números entra solo.</>,
          <>
            Arriba aparece el chip <B>Staff</B>. Para salir, tócalo y confirma.
          </>,
        ]}
      />
      <div className="ml-dato">
        <span className="ml-dato-n">12 h</span>
        <span>dura la sesión en ese aparato. Después pide el PIN otra vez.</span>
      </div>
      <Nota titulo="5 intentos" tono="coral">
        Tras 5 PIN incorrectos seguidos, ese aparato espera 10 minutos.
      </Nota>
    </ConCaptura>,
  ),

  // 3 · Ajustes
  capitulo(
    "3",
    "Ajustes del club",
    "Lo que se configura una vez y usan todos los eventos.",
    <ConCaptura src="aj-pistas" alt="Ajustes con las pistas del club">
      <p>
        Menú <B>☰</B> → <B>Mi club</B>. Arriba hay atajos a Datos de prueba, Árbitros del club y Claves de torneos.
      </p>
      <ul className="ml-lista">
        <li>
          <b>Pistas:</b> nombre, si es techada o exterior, y si está activa. Hoy: 4 techadas (1 a 4) y 1 exterior (5).
        </li>
        <li>
          <b>Horarios:</b> apertura y cierre de cada día.
        </li>
        <li>
          <b>Cambio entre rondas:</b> minutos para rotar de pista en los americanos.
        </li>
        <li>
          <b>Contacto:</b> Instagram, WhatsApp y dirección que salen en la TV.
        </li>
      </ul>
      <p className="ml-chico">
        Toca <B>Guardar cambios</B> al terminar.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Ajustes del club",
    <ConCaptura src="aj-arbitros" alt="PIN de árbitros y plantel del club">
      <h2>Claves y árbitros</h2>
      <h3>Claves de torneos</h3>
      <p>Cada torneo tiene su clave para los jugadores. Aquí la ves, la copias o la cambias. Vence sola al terminar el torneo.</p>
      <h3>Árbitros del club</h3>
      <ul className="ml-lista">
        <li>
          <b>PIN de árbitros:</b> uno solo para el club. Créalo, ve el ojo para mostrarlo y <B>Enviar a los árbitros</B> por WhatsApp.
        </li>
        <li>
          <b>Plantel:</b> los árbitros registrados, cuántos partidos y puntos anotaron. Puedes escribirles, <B>Pausar</B> o borrar.
        </li>
      </ul>
      <p className="ml-chico">Cambiar el PIN cierra las sesiones abiertas; nadie pierde sus turnos ni su código.</p>
    </ConCaptura>,
  ),
  pagina(
    "Ajustes del club",
    <ConCaptura src="aj-demo" alt="Botones para cargar y borrar datos de prueba">
      <h2>Datos de prueba</h2>
      <p>La app arranca vacía. Para enseñarla o practicar:</p>
      <ul className="ml-lista">
        <li>
          <B>Cargar datos de prueba</B>: crea 3 americanos, un torneo de hoy en pleno juego (clave <b>MARINA</b>) y 6 árbitros de
          ejemplo (código <b>1234</b>).
        </li>
        <li>Si no había PIN de árbitros, queda el <b>2468</b>.</li>
        <li>Volver a cargarlos los deja como nuevos.</li>
        <li>
          <B>Borrar datos de prueba</B> los quita sin tocar lo tuyo.
        </li>
      </ul>
      <Nota titulo="Ojo con la hora" tono="coral">
        El torneo de prueba es una foto de las 11:50 de la mañana. Si lo cargas más tarde verás atraso y avisos de W.O.: es normal.
      </Nota>
    </ConCaptura>,
  ),

  // 4 · Americanos
  capitulo(
    "4",
    "Americanos",
    "Del registro al podio en una noche.",
    <ConCaptura src="am-lista" alt="Lista de americanos con Nuevo Americano y Abrir Modo TV">
      <p>
        En el inicio toca <B>Americanos</B>. Ves los <b>eventos activos</b> y el <b>historial</b>.
      </p>
      <ul className="ml-lista">
        <li>
          <B>Nuevo Americano</B> abre un asistente de 5 pasos: categoría, formato, jugadores, pistas y listo. Si se cierra la app, el
          borrador queda guardado.
        </li>
        <li>
          <B>Abrir Modo TV</B> lleva directo a la pantalla de la tele.
        </li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-paso1" alt="Paso 1: rama, tipo de categoría y nivel">
      <p className="ml-eyebrow">Paso 1</p>
      <h2>Categoría</h2>
      <ul className="ml-lista">
        <li>
          <b>Rama:</b> Femenino, Masculino o Mixto.
        </li>
        <li>
          <b>Por nivel:</b> todos del mismo nivel (7ma, 6ta, 5ta, 4ta, 3ra, 2da, Open).
        </li>
        <li>
          <b>Suma:</b> las categorías de la pareja suman un número. Ej. Suma 9 = 4ta + 5ta.
        </li>
        <li>Puedes ponerle nombre propio, como «Copa Aniversario».</li>
      </ul>
      <Nota titulo="2da femenina" tono="cielo">
        No aparece porque no existe en Lechería.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-paso2" alt="Paso 2: formato y método de puntuación">
      <p className="ml-eyebrow">Paso 2</p>
      <h2>Formato y puntuación</h2>
      <ul className="ml-lista">
        <li>
          <b>Individual:</b> el americano clásico, cambias de pareja cada ronda. En Mixto, siempre hombre + mujer.
        </li>
        <li>
          <b>Dupla fija:</b> parejas inscritas, todas contra todas.
        </li>
      </ul>
      <div className="ml-tabla-wrap">
        <table className="ml-tabla">
          <tbody>
            <tr>
              <th>Puntos</th>
              <td>24 en total, a 13 o el número que quieras</td>
            </tr>
            <tr>
              <th>Games</th>
              <td>5 en total, a 6… con tie-break opcional</td>
            </tr>
            <tr>
              <th>Sets</th>
              <td>1, mejor de 3 o de 5, a 4 o 6 games</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ml-chico">Punto de oro o ventaja. Debajo, la app escribe la regla completa para leerla en voz alta.</p>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <>
      <p className="ml-eyebrow">Paso 2 · Ranking</p>
      <h2>¿Cómo suma cada jugador?</h2>
      <div className="ml-pila">
        <div className="ml-tarjeta">
          <b>Todos los puntos</b>
          <span>Cada jugador suma lo que hizo su pareja en cada partido, gane o pierda. El más usado.</span>
        </div>
        <div className="ml-tarjeta">
          <b>Solo rondas ganadas</b>
          <span>Solo cuenta el marcador de los partidos ganados.</span>
        </div>
        <div className="ml-tarjeta">
          <b>Por victorias</b>
          <span>3 puntos por ganar y 1 por empatar, como una liga.</span>
        </div>
      </div>
      <Nota titulo="Empates en la tabla">
        Desempata la diferencia y luego los puntos a favor. En Dupla fija primero cuenta el partido entre ellas. Si todo es igual,
        comparten puesto y la app lo explica.
      </Nota>
    </>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-paso3" alt="Paso 3: lista de mujeres y hombres">
      <p className="ml-eyebrow">Paso 3</p>
      <h2>Jugadores</h2>
      <ul className="ml-lista">
        <li>Escribe un nombre y presiona Enter.</li>
        <li>
          Puedes pegar varios separados por coma: <i>Ana Pérez, Bea Ruiz, Carla Mora</i>.
        </li>
        <li>En Mixto hay una casilla para mujeres y otra para hombres.</li>
        <li>En Dupla fija escribes jugador 1 y 2 y tocas <B>Dupla</B>. En Suma eliges la categoría de cada uno.</li>
      </ul>
      <Nota titulo="Si falta gente" tono="coral">
        Arriba sale en rojo cuántos faltan para el primer partido. <B>Vaciar</B> borra la lista.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-paso4" alt="Paso 4: pistas, rondas y horario">
      <p className="ml-eyebrow">Paso 4</p>
      <h2>Pistas, rondas y horario</h2>
      <ul className="ml-lista">
        <li>Toca las pistas del evento. Las techadas reciben primero los partidos.</li>
        <li>
          <B>¿Llueve?</B> deja solo las techadas. <B>Todas</B> las marca todas.
        </li>
        <li>Las rondas salen solas para que nadie repita pareja. Puedes cambiarlas con − y +.</li>
        <li>
          <b>Cronómetro por ronda:</b> se puede apagar. Si está prendido, eliges los minutos.
        </li>
        <li>
          <b>Fecha, Inicio y Fin:</b> tócalos y elige en el calendario o el reloj. Solo deja horas en que el club está abierto.
        </li>
      </ul>
      <p className="ml-chico">Abajo dice a qué hora termina y si sobran pistas.</p>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-paso5" alt="Paso 5: resumen y vista previa de la ronda 1">
      <p className="ml-eyebrow">Paso 5</p>
      <h2>¡Todo listo!</h2>
      <ul className="ml-lista">
        <li>Revisa el nombre y los chips del resumen: categoría, formato, puntuación, pistas, rondas, horario y jugadores.</li>
        <li>Mira la ronda 1 de prueba. Si no te gusta, <B>Otro sorteo</B>.</li>
        <li>
          Toca <B>Crear y abrir cuadro</B>.
        </li>
      </ul>
      <div className="ml-dato">
        <span className="ml-dato-n">60 s</span>
        <span>toma crear un americano cuando ya conoces el asistente.</span>
      </div>
      <Nota titulo="El sorteo es justo">
        No repite compañero, reparte rivales, equilibra niveles y turna a quién le toca descansar.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-cuadro" alt="Cuadro vivo con cronómetro y pistas">
      <h2>El cuadro vivo</h2>
      <ul className="ml-lista">
        <li>Arriba, las rondas con su hora (R1, R2…). Toca una para verla.</li>
        <li>
          <B>Iniciar ronda</B> arranca el cronómetro y suena al terminar. <B>Pausar</B> lo detiene y <B>Reloj</B> lo vuelve a empezar.
        </li>
        <li>Debajo, una tarjeta por pista: pareja contra pareja.</li>
        <li>
          <b>En espera:</b> quién descansa y en qué ronda vuelve.
        </li>
        <li>
          <b>Lluvia:</b> <B>Suspender</B> en la tarjeta de la pista. El partido queda en espera con cómo iban y se termina primero en la ronda siguiente; el resto del cuadro se acomoda solo en las pistas que quedan, sin repetir cruces. Al escampar, <B>Reactivar</B>.
        </li>
        <li>
          Con todo cargado, <B>Siguiente</B>. En la última, <B>Finalizar</B>.
        </li>
      </ul>
      <p className="ml-chico">Barra de abajo: Cuadro, Ranking, TV y QR.</p>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-marcador" alt="Marcador táctil con más y menos por pareja">
      <h2>Cargar un marcador</h2>
      <Pasos
        items={[
          <>
            Toca <B>Cargar marcador</B> en la pista.
          </>,
          <>
            Suma con <B>+</B> a cada pareja. Con «Autocompletar», la otra se completa sola hasta el total.
          </>,
          <>
            <B>Guardar resultado</B>. Sale «Pista 2: resultado guardado».
          </>,
        ]}
      />
      <ul className="ml-lista">
        <li>No deja guardar un resultado imposible.</li>
        <li>
          ¿Error? <B>Deshacer</B> en el aviso o <B>Editar marcador</B> en la tarjeta.
        </li>
        <li>Dos celulares pueden cargar pistas distintas a la vez sin pisarse.</li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-jugadores" alt="Hoja de jugadores con Retirar y Sumar">
      <h2>Jugadores y fotos</h2>
      <p>
        Botón <B>Jugadores y fotos</B> en el cuadro (<B>Parejas y fotos</B> en Dupla fija).
      </p>
      <ul className="ml-lista">
        <li>
          <b>Retirar:</b> por lesión o porque se fue. Conserva sus puntos.
        </li>
        <li>
          <b>Llegó tarde:</b> escribe el nombre y <B>Sumar</B>.
        </li>
        <li>
          <b>Foto:</b> toca su círculo y sácale una foto. Sale en el ranking y la TV.
        </li>
      </ul>
      <Nota titulo="Lo jugado se respeta">Solo se re-sortean las rondas que faltan, sin repetir compañeros.</Nota>
      <p className="ml-chico">
        La papelera roja borra el evento: pide confirmar y escribir ELIMINAR.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-tabla" alt="Ranking en vivo con podio">
      <h2>Ranking</h2>
      <dl className="ml-glosario">
        <dt>PJ</dt>
        <dd>Partidos jugados</dd>
        <dt>PG / PP</dt>
        <dd>Ganados / perdidos</dd>
        <dt>PF / PC</dt>
        <dd>Puntos a favor / en contra</dd>
        <dt>+/-</dt>
        <dd>Diferencia</dd>
        <dt>PTS</dt>
        <dd>Lo que ordena la tabla</dd>
      </dl>
      <ul className="ml-lista">
        <li>Las flechas muestran quién subió o bajó.</li>
        <li>
          <B>Historial</B>: todos los marcadores ronda por ronda, con filtro por jugador.
        </li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-podio" alt="Podio del americano terminado">
      <h2>Podio y compartir</h2>
      <p>
        Al <B>Finalizar</B>, el ranking muestra el podio con los tres primeros.
      </p>
      <p>
        <B>Compartir</B> manda el resultado por WhatsApp o redes con el enlace a la tabla.
      </p>
      <Nota titulo="Truco" tono="cielo">
        Haz una captura del podio y súbela a las historias del club esa misma noche.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <ConCaptura src="am-qr" alt="QR grande para escanear el ranking">
      <h2>El QR para los jugadores</h2>
      <p>Los jugadores no necesitan cuenta para seguir el evento:</p>
      <ul className="ml-lista">
        <li>
          Botón <B>QR</B> en la barra de abajo: sale grande para escanearlo.
        </li>
        <li>El QR del Modo TV también lleva al ranking.</li>
        <li>O comparte el enlace por WhatsApp.</li>
      </ul>
      <div className="ml-tarjeta ml-tarjeta-destacada">
        <b>Modo espectador</b>
        <span>Ven cuadro, ranking y su pista, pero no pueden cambiar nada.</span>
      </div>
    </ConCaptura>,
  ),
  pagina(
    "Americanos",
    <>
      <h2>Modo TV del americano</h2>
      <Captura src="/manual/tv-americano.webp" alt="Modo TV del americano con cronómetro, pistas y ranking" ancho />
      <Pasos
        items={[
          <>
            En la tele o el computador del bar, abre el evento y toca <B>TV</B>.
          </>,
          <>Pantalla completa con F11 o el botón de la pantalla.</>,
          <>Listo: cronómetro, pistas en juego, ranking que rota y el QR. La pantalla no se apaga.</>,
        ]}
      />
    </>,
  ),

  // 5 · Torneos: preparar
  capitulo(
    "5",
    "Torneos: preparar",
    "Crear, inscribir, verificar con la FVP y sortear.",
    <ConCaptura src="to-lista" alt="Lista de torneos con Nuevo torneo y Ranking FVP">
      <p>
        En el inicio toca <B>Torneos</B>. Ves los torneos activos con su avance y, para el staff, <B>Nuevo torneo</B> y{" "}
        <B>Ranking FVP</B>.
      </p>
      <ol className="ml-ruta">
        <li>
          <b>Crear</b>
          <span>Días, pistas y categorías.</span>
        </li>
        <li>
          <b>Inscribir</b>
          <span>Duplas con cédula.</span>
        </li>
        <li>
          <b>Verificar</b>
          <span>Ranking FVP.</span>
        </li>
        <li>
          <b>Sortear</b>
          <span>Grupos o llave por categoría.</span>
        </li>
        <li>
          <b>Publicar</b>
          <span>Los horarios salen solos.</span>
        </li>
      </ol>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-nuevo" alt="Formulario de nuevo torneo con categorías">
      <h2>Crear el torneo</h2>
      <ul className="ml-lista">
        <li>Nombre, primer y último día, y el horario de cada día.</li>
        <li>Las pistas que se usan. Las finales van a la primera elegida.</li>
        <li>
          Las categorías: 7ma a 1ra en Masculino, Femenino y Mixto, Master +40, +45 y +55, y Junior Sub-12 a Sub-18. <B>Todas</B>{" "}
          marca una fila completa.
        </li>
        <li>
          <B>Crear torneo</B>. Se abre Inscritos.
        </li>
      </ul>
      <Nota titulo="Clave">La clave de los jugadores se crea sola. La ves en menú ☰ → Claves de torneos.</Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-inscribir" alt="Formulario Inscribir dupla con cédulas verificadas">
      <h2>Inscribir una dupla</h2>
      <Pasos
        items={[
          <>
            En <B>Inscritos</B> elige la categoría arriba y toca <B>Inscribir</B>.
          </>,
          <>Nombre, apellido y cédula de los dos jugadores.</>,
          <>La app busca la cédula en el ranking FVP y muestra su categoría al instante.</>,
          <>
            <B>Inscribir</B>, o <B>Inscribir y otra</B> para seguir.
          </>,
        ]}
      />
      <p className="ml-chico">Puntos de ranking (opcional): ordenan quién es cabeza de serie.</p>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-pegar" alt="Pegar lista de duplas">
      <h2>Pegar una lista</h2>
      <p>
        ¿Tienes las inscripciones en WhatsApp o Excel? Toca <B>Pegar lista</B>: una dupla por línea.
      </p>
      <p className="ml-chico">
        Ejemplo: <i>Luis Zea V-12345678 / Juan Pérez V-23456789 850</i>
      </p>
      <ul className="ml-lista">
        <li>Con cédula, se cruza con el ranking FVP.</li>
        <li>Sin cédula, la dupla queda «por verificar» hasta que la revises.</li>
        <li>El número al final son sus puntos de ranking.</li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-fvp" alt="Ranking FVP con 32 atletas cargados">
      <h2>Ranking FVP</h2>
      <p>
        Menú <B>☰</B> → <B>Ranking FVP</B>. Cada día a las 6:00 a. m. la app lee la lista oficial de la Federación Venezolana de
        Pádel.
      </p>
      <ul className="ml-lista">
        <li>Nadie se inscribe por debajo de su categoría.</li>
        <li>
          <B>Sincronizar ahora</B>, <B>Subir CSV</B> o <B>Pegar</B> si la FVP cambia la hoja.
        </li>
        <li>Busca a cualquier atleta por cédula o nombre.</li>
      </ul>
      <Nota titulo="Fuera de la lista" tono="cielo">
        Si un jugador no está en la FVP, toca su aviso → <B>Inscribir igual (excepción del staff)</B> y escribe el motivo. Queda
        con tu nombre y no frena el sorteo.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-inscritos" alt="Inscritos de 4ta Femenino con FVP verificada">
      <h2>La lista de inscritos</h2>
      <ul className="ml-lista">
        <li>
          Cada dupla muestra su estado FVP: <b>verificada</b>, <b>por verificar</b>, <b>bloqueada</b> o <b>excepción del staff</b>.
        </li>
        <li>Toca el aviso para escribir cédulas o autorizar una excepción.</li>
        <li>La cámara saca la foto de la dupla. La corona la marca cabeza de serie. La papelera la quita.</li>
        <li>
          <B>Reglas</B>: sets, games, punto de oro y súper tie-break de la categoría.
        </li>
      </ul>
      <Nota titulo="El sorteo espera" tono="coral">
        Mientras haya duplas por verificar o bloqueadas, el botón Sorteo no se activa.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-sorteo" alt="Sorteo con el formato recomendado">
      <h2>El sorteo</h2>
      <p>
        Toca <B>Sorteo</B>. La app recomienda el formato según los inscritos y explica por qué.
      </p>
      <ul className="ml-lista">
        <li>
          <b>Grupos + llave</b>, <b>Eliminación</b>, <b>Liga + final</b> o <b>Liga</b>.
        </li>
        <li>Tamaño de grupos: dice cuántos grupos salen de verdad.</li>
        <li>Pasan solo el 1ro o 1ro y 2do. 3er puesto y consolación opcionales.</li>
      </ul>
      <p>
        Toca <B>Sortear</B>.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: preparar",
    <ConCaptura src="to-sorteo-hecho" alt="Grupos sorteados listos para publicar">
      <h2>Publicar</h2>
      <ul className="ml-lista">
        <li>Ves los grupos, la llave y a qué hora termina cada día.</li>
        <li>Los mejores sembrados reciben los byes; el 2do de un grupo va al lado opuesto de su 1ro.</li>
        <li>
          ¿No te convence? <B>Repetir sorteo</B>.
        </li>
        <li>
          <B>Publicar y programar</B>: los partidos se ponen solos en los días y pistas del torneo, sin choques.
        </li>
      </ul>
      <p className="ml-chico">Haz lo mismo con cada categoría.</p>
    </ConCaptura>,
  ),

  // 6 · Torneos: día de juego
  capitulo(
    "6",
    "Torneos: día de juego",
    "Llamar, anotar, reprogramar y cerrar.",
    <ConCaptura src="to-envivo" alt="En vivo: partidos jugados, pistas y atraso">
      <p>
        <B>En vivo</B> es la pantalla del director del torneo:
      </p>
      <ul className="ml-lista">
        <li>Arriba: partidos jugados, en juego, duplas y atraso.</li>
        <li>
          Una tarjeta por pista con el marcador en vivo, o el siguiente partido y <B>Llamar a pista</B>.
        </li>
        <li>Abajo: próximos y últimos resultados.</li>
      </ul>
      <Nota titulo="W.O." tono="coral">
        A los 10 minutos de la hora prevista sin una dupla, la pista lo avisa en rojo y puedes dar W.O. (reglamento FIP).
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: día de juego",
    <>
      <h2>Un partido, de punta a punta</h2>
      <Pasos
        items={[
          <>
            <B>Llamar a pista</B>: el partido queda «Llamado» y sale en la TV.
          </>,
          <>El árbitro de esa pista lo empieza y lo anota en su tablet (capítulo 7).</>,
          <>Si no hay árbitro, el staff toca el partido → «Anotar punto a punto», o carga el resultado final con sets.</>,
          <>Al terminar, el ganador avanza solo en el cuadro y la pista llama al siguiente.</>,
        ]}
      />
      <Nota titulo="Corregir un resultado">
        Toca el partido en Cuadros o Horarios y vuelve a guardar el resultado. Queda en el historial.
      </Nota>
      <Nota titulo="El modo TV de cada pista" tono="cielo">
        El ícono de pantalla en la tarjeta abre la TV de esa pista (capítulo 8).
      </Nota>
    </>,
  ),
  pagina(
    "Torneos: día de juego",
    <ConCaptura src="to-cuadros" alt="Cuadros: tabla del grupo A">
      <h2>Cuadros</h2>
      <ul className="ml-lista">
        <li>Arriba, las categorías. Debajo, cada grupo con su tabla (PJ, PG, sets y games) y sus partidos.</li>
        <li>Después, la llave: semifinales, final, 3er puesto y consolación.</li>
        <li>
          <B>¿Por qué este orden?</B> explica cada desempate.
        </li>
      </ul>
      <Nota titulo="Desempates">
        2 empatadas: gana la que ganó el partido entre ellas. 3 o más: sets y games entre ellas, luego en todo el grupo y al final un
        sorteo que queda registrado.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: día de juego",
    <ConCaptura src="to-horarios" alt="Horarios por día y pista">
      <h2>Horarios</h2>
      <ul className="ml-lista">
        <li>Un botón por día con sus partidos; debajo, la hora y la pista de cada uno.</li>
        <li>
          <B>¿Cuándo juego?</B> busca por nombre y te dice qué días juega.
        </li>
        <li>
          <B>Programar</B> vuelve a armar lo que no está jugado.
        </li>
        <li>
          <B>Desde ahora</B> reacomoda lo que falta a partir de este momento (útil si se atrasó todo).
        </li>
      </ul>
      <p className="ml-chico">
        La app respeta el descanso mínimo de cada dupla, las finales el último día y la pista principal.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: día de juego",
    <ConCaptura src="to-imprevistos" alt="Imprevistos: suspender pistas, sedes y días">
      <h2>Imprevistos</h2>
      <p>
        <B>Imprevistos</B> en En vivo o en Horarios:
      </p>
      <ul className="ml-lista">
        <li>
          <b>Lluvia o falla:</b> elige las pistas (o «Solo exteriores»), el motivo y por cuánto tiempo. <B>Suspender y reprogramar</B>.
          El partido en juego guarda su marcador y sigue después.
        </li>
        <li>
          <b>Sede de apoyo:</b> suma otro club con sus pistas, horario y tiempo de traslado.
        </li>
        <li>
          <b>Día extra:</b> <B>Agregar un día</B> si no alcanza.
        </li>
      </ul>
      <p className="ml-chico">Todo se reprograma solo.</p>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: día de juego",
    <ConCaptura src="to-arbitros" alt="Árbitros del torneo y plantel">
      <h2>Árbitros del torneo</h2>
      <p>
        Bandera <B>⚑</B> arriba en el torneo.
      </p>
      <ul className="ml-lista">
        <li>El plantel del club, con cuántos turnos, partidos y puntos lleva cada uno en este torneo.</li>
        <li>
          <b>Turnos:</b> asigna árbitro por día, franja y pista, o deja que la app los reparta sola.
        </li>
        <li>Pausar o borrar a un árbitro.</li>
      </ul>
      <Nota titulo="Sin turno">Un árbitro sin turno igual puede elegir una pista libre desde su tablet.</Nota>
    </ConCaptura>,
  ),
  pagina(
    "Torneos: día de juego",
    <ConCaptura src="to-ajustes" alt="Ajustes del torneo">
      <h2>Ajustes del torneo</h2>
      <p>
        Engranaje <B>⚙</B> arriba en el torneo.
      </p>
      <ul className="ml-lista">
        <li>Nombre, descanso mínimo entre partidos y tolerancia para W.O.</li>
        <li>Semis y finales el último día en la pista principal.</li>
        <li>Días y horarios, pistas, orden de desempates.</li>
        <li>
          <b>Patrocinadores:</b> salen en la TV y en la página del torneo.
        </li>
        <li>
          <b>Historial</b> de cambios y <b>eliminar</b> el torneo. La clave está en menú ☰ → Claves de torneos.
        </li>
      </ul>
      <p className="ml-chico">
        Al guardar, los horarios se reacomodan solos.
      </p>
    </ConCaptura>,
  ),

  // 7 · Árbitros
  capitulo(
    "7",
    "Árbitros",
    "La tablet de cada pista: un toque por punto.",
    <ConCaptura src="arb-quien" alt="Pantalla ¿Quién eres? con los árbitros del club">
      <p>
        En la tablet de la pista, toca <B>Árbitros</B> en el inicio.
      </p>
      <ul className="ml-lista">
        <li>El árbitro solo puede llamar, empezar y anotar. No ve cuadros, horarios ni ajustes.</li>
        <li>Cada punto queda firmado con su nombre.</li>
      </ul>
      <h3>Entrar</h3>
      <Pasos
        items={[
          <>Toca tu nombre en «¿Quién eres?».</>,
          <>Escribe tu código de 4 números.</>,
          <>Elige el torneo.</>,
        ]}
      />
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-registro" alt="Registro del árbitro con PIN de árbitros">
      <h2>Registrarse (una sola vez)</h2>
      <Pasos
        items={[
          <>
            <B>Soy nuevo: registrarme</B>.
          </>,
          <>Nombre, apellido y teléfono.</>,
          <>El PIN de árbitros que te dio el staff.</>,
          <>
            <B>Seguir</B> y crea tu código de 4 números. Repítelo para confirmar.
          </>,
        ]}
      />
      <p>Sirve para todos los torneos del club. No compartas tu código.</p>
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-pista" alt="Pista 3 con partido llamado y Empezar partido">
      <h2>Tu pista</h2>
      <ul className="ml-lista">
        <li>Arriba, tu turno. Si no tienes, elige la pista. La tablet la recuerda.</li>
        <li>Ves el partido llamado y los que siguen en esa pista.</li>
        <li>
          <B>Empezar partido</B> cuando estén las dos duplas.
        </li>
        <li>
          <B>No vino…</B> si falta una dupla y pasó la tolerancia (W.O.).
        </li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-sorteo" alt="Sorteo con la pelota">
      <h2>Antes del primer punto</h2>
      <Pasos
        items={[
          <>
            <b>Foto:</b> las dos duplas juntas en la red. <B>Tomar</B> o <B>Seguir sin foto</B>.
          </>,
          <>
            <b>Sorteo:</b> toca la pelota o marca quién ganó la moneda.
          </>,
          <>
            <b>El ganador elige:</b> sacar, restar o lado.
          </>,
          <>
            <b>Lado:</b> toca en la cancha de qué lado empieza cada dupla, visto desde tu silla.
          </>,
          <>
            <b>Saque:</b> quién saca en cada dupla.
          </>,
        ]}
      />
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-anotador" alt="Anotador con una dupla arriba y otra abajo">
      <h2>Anotar</h2>
      <ul className="ml-lista">
        <li>
          La pantalla está partida en dos, igual que la cancha. <b>Toca la mitad de la dupla que ganó el punto.</b>
        </li>
        <li>El punto verde marca quién saca.</li>
        <li>
          <B>Falta</B> anota la falta de saque (dos = doble falta). <B>Ace</B>, el ace.
        </li>
        <li>
          <B>Deshacer</B> borra el último punto.
        </li>
      </ul>
      <p className="ml-chico">
        Punto de oro, tie-break y súper tie-break salen solos según las reglas de la categoría.
      </p>
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-detalle" alt="Detalle opcional: winner o error de cada jugador">
      <h2>El detalle (opcional)</h2>
      <p>Después de cada punto aparece abajo:</p>
      <ul className="ml-lista">
        <li>
          <b>Winner de:</b> quién lo ganó con un golpe.
        </li>
        <li>
          <b>Error de:</b> quién falló, y si fue forzado.
        </li>
      </ul>
      <p>Con eso salen las estadísticas de cada atleta. Si no hay tiempo, ignóralo: no hace falta cerrarlo.</p>
      <Nota titulo="⋯ Más opciones">
        Corregir el sacador, sanciones FIP (advertencia, pérdida de punto, descalificación), atención médica de 3 min, accidente de
        hasta 15 min y retiro por lesión.
      </Nota>
    </ConCaptura>,
  ),
  pagina(
    "Árbitros",
    <ConCaptura src="arb-cambio-lado" alt="Aviso Cambien de lado ya">
      <h2>Cambio de lado</h2>
      <p>La app avisa cuándo cambiar y cuenta el descanso FIP:</p>
      <ul className="ml-lista">
        <li>Tras el primer game: cambio directo, sin descanso.</li>
        <li>En los games impares: 1:30.</li>
        <li>Entre sets: 2:00.</li>
        <li>En el tie-break, cada 6 puntos.</li>
      </ul>
      <p>Las duplas se cambian solas de mitad en la pantalla, y el aviso también sale en la TV de la pista.</p>
    </ConCaptura>,
  ),

  // 8 · Pantallas
  capitulo(
    "8",
    "Las pantallas del club",
    "La tele del bar y la pantalla de cada pista.",
    <>
      <h3>TV del torneo</h3>
      <Captura src="/manual/tv-torneo.webp" alt="TV del torneo con todas las pistas, próximos y resultados" ancho />
      <p className="ml-chico">
        En vivo → <B>Modo TV</B>. Todas las pistas, los próximos partidos, los resultados, los patrocinadores y un QR. La primera vez
        pide la clave del torneo.
      </p>
    </>,
  ),
  pagina(
    "Las pantallas del club",
    <>
      <h3>TV de cada pista</h3>
      <Captura src="/manual/tv-pista.webp" alt="TV de la pista 1 con marcador y punto por punto" ancho />
      <ul className="ml-lista">
        <li>Marcador grande, quién saca, break point y punto de oro.</li>
        <li>Punto por punto en vivo, datos de la dupla y el QR del partido.</li>
        <li>No muestra estadísticas individuales: esas son para los atletas.</li>
      </ul>
      <Nota titulo="Ponerla" tono="cielo">
        En la tarjeta de la pista, el ícono de pantalla. Luego F11. Se adapta a cualquier tele (720p, 1080p, 4K o vertical).
      </Nota>
    </>,
  ),

  // 9 · Jugadores y público
  capitulo(
    "9",
    "Para jugadores y público",
    "Lo que ve quien no es del staff.",
    <ConCaptura src="pub-evento" alt="Cuadro del americano en modo espectador">
      <h3>Americanos</h3>
      <p>Cualquiera ve el cuadro, el ranking y la TV, sin cuenta. Dice «Modo espectador» y no deja cambiar nada.</p>
      <h3>Torneos</h3>
      <p>Para ver un torneo hace falta su clave. El staff la da en la recepción o por WhatsApp.</p>
      <ul className="ml-lista">
        <li>Vale durante los días del torneo y vence sola.</li>
        <li>Si el staff la cambia, hay que escribir la nueva.</li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Para jugadores y público",
    <ConCaptura src="pub-clave" alt="Pantalla para escribir la clave del torneo">
      <h2>Entrar a un torneo</h2>
      <Pasos
        items={[
          <>
            Inicio → <B>Torneos</B> → el torneo.
          </>,
          <>Escribe la clave y toca Entrar.</>,
          <>
            Abajo: <B>En vivo</B>, <B>Cuadros</B>, <B>Horarios</B> y <B>Stats</B>.
          </>,
        ]}
      />
    </ConCaptura>,
  ),
  pagina(
    "Para jugadores y público",
    <ConCaptura src="pub-cuando-juego" alt="Búsqueda ¿Cuándo juego? en Horarios">
      <h2>¿Cuándo juego?</h2>
      <p>
        En <B>Horarios</B>, escribe tu nombre en «¿Cuándo juego?».
      </p>
      <ul className="ml-lista">
        <li>Ves tus partidos del día con hora y pista.</li>
        <li>Si juegas otros días, aparecen botones con esos días.</li>
      </ul>
      <Nota titulo="Truco">Agrega la app al inicio del celular: la próxima vez entras directo.</Nota>
    </ConCaptura>,
  ),
  pagina(
    "Para jugadores y público",
    <ConCaptura src="pub-partido" alt="Página del partido con estadísticas comparadas">
      <h2>Tu partido y tus estadísticas</h2>
      <p>Toca un partido (o escanea el QR de la TV de la pista):</p>
      <ul className="ml-lista">
        <li>Marcador en vivo y punto por punto.</li>
        <li>Comparación de las duplas: puntos ganados al saque y al resto, primer saque, winners, errores y breaks.</li>
        <li>Tabla por jugador.</li>
      </ul>
      <p>
        En <B>Stats</B> están los rankings del torneo y la ficha de cada jugador.
      </p>
    </ConCaptura>,
  ),

  // 10 · Dueño
  capitulo(
    "10",
    "Para el dueño",
    "Cómo va el club, en una pantalla.",
    <ConCaptura src="to-resumen" alt="Resumen para el club en Stats">
      <p>
        En cualquier torneo, con sesión de staff, <B>Stats</B> abre con el <b>resumen para el club</b>:
      </p>
      <ul className="ml-lista">
        <li>Jugadores inscritos y partidos jugados.</li>
        <li>Horas de pista jugadas.</li>
        <li>Porcentaje de partidos que empezaron en hora.</li>
        <li>Puntos anotados en vivo, W.O. y retiros, suspensiones por clima y sedes.</li>
        <li>Más winners, mejores porcentajes y menos errores.</li>
      </ul>
    </ConCaptura>,
  ),
  pagina(
    "Para el dueño",
    <>
      <h2>Lo que conviene revisar</h2>
      <ul className="ml-check">
        <li>
          <b>Puntualidad:</b> si «empezaron en hora» baja, sumar tiempo entre partidos en Ajustes del torneo.
        </li>
        <li>
          <b>Árbitros:</b> en el plantel, cuántos partidos anotó cada uno.
        </li>
        <li>
          <b>Historial:</b> cada cambio del torneo queda con fecha, hora y quién lo hizo (Ajustes del torneo).
        </li>
        <li>
          <b>Excepciones FVP:</b> cada una lleva el nombre de quien la autorizó y el motivo.
        </li>
        <li>
          <b>PIN:</b> cámbialo cuando alguien deja el equipo (staff con Juan; árbitros en Ajustes).
        </li>
      </ul>
      <Nota titulo="Patrocinadores" tono="cielo">
        Se cargan por torneo y salen en la TV y en la página del torneo: un buen argumento para venderlos.
      </Nota>
    </>,
  ),

  // 11 · Sin señal
  capitulo(
    "11",
    "Sin señal y otros imprevistos",
    "La app sigue funcionando aunque se corte internet.",
    <>
      <ul className="ml-lista">
        <li>
          <b>Sin señal:</b> sigue cargando. Todo queda guardado en el aparato y se sube solo al volver la conexión.
        </li>
        <li>
          <b>«Sin conexión · N por subir»</b> en el chip de arriba: cambios esperando señal. Con conexión dice «En línea».
        </li>
        <li>
          <b>Dos o más celulares:</b> cada marcador se junta por partido; nadie pisa lo que cargó otro.
        </li>
        <li>
          <b>Se cerró la app o se fue la luz:</b> al abrir, todo sigue donde quedó. El cronómetro también.
        </li>
        <li>
          <b>Doble toque:</b> se ignora. Siempre hay <B>Deshacer</B>.
        </li>
      </ul>
      <Nota titulo="Borrar" tono="coral">
        Borrar un evento o un torneo pide confirmar dos veces. Úsalo solo con pruebas o duplicados.
      </Nota>
    </>,
  ),
  pagina(
    "Sin señal y otros imprevistos",
    <>
      <p className="ml-eyebrow">Para pegar en la recepción</p>
      <h2>El día del evento</h2>
      <h3>Antes</h3>
      <ul className="ml-check">
        <li>Celulares y tablets cargados, con sesión de staff.</li>
        <li>Mirar el cielo: ¿Llueve? en americanos, Imprevistos en torneos.</li>
        <li>Tele del bar en Modo TV y teles de pista encendidas.</li>
        <li>Clave del torneo a mano para los jugadores.</li>
      </ul>
      <h3>Durante</h3>
      <ul className="ml-check">
        <li>Leer la regla de puntuación en voz alta.</li>
        <li>Llamar a pista a tiempo y vigilar el atraso.</li>
        <li>Cargar cada resultado apenas termina.</li>
      </ul>
      <h3>Al cerrar</h3>
      <ul className="ml-check">
        <li>Finalizar, mostrar el podio y compartirlo.</li>
        <li>Revisar Stats con el dueño.</li>
      </ul>
    </>,
  ),

  // 12 · FAQ
  capitulo(
    "12",
    "Preguntas frecuentes",
    "Lo que más se pregunta en la pista.",
    <dl className="ml-faq">
      <dt>No me acepta el PIN.</dt>
      <dd>Revisa que sea el vigente. Tras 5 intentos hay que esperar 10 minutos.</dd>
      <dt>Llegó alguien tarde o se lesionó.</dt>
      <dd>Americano: Jugadores y fotos. Torneo: el árbitro marca retiro por lesión en ⋯.</dd>
      <dt>Cargué mal un resultado.</dt>
      <dd>Deshacer en el aviso, o abre la pista o el partido y corrígelo.</dd>
      <dt>No se activa el Sorteo.</dt>
      <dd>Hay duplas por verificar o bloqueadas en la FVP. Toca su aviso.</dd>
    </dl>,
  ),
  pagina(
    "Preguntas frecuentes",
    <dl className="ml-faq">
      <dt>Un jugador no está en la lista FVP.</dt>
      <dd>Toca su aviso → Inscribir igual (excepción del staff), con el motivo.</dd>
      <dt>Un jugador no puede ver el torneo.</dt>
      <dd>Necesita la clave del torneo: menú ☰ → Claves de torneos.</dd>
      <dt>Un árbitro olvidó su código.</dt>
      <dd>Bórralo del plantel en Ajustes y que se registre de nuevo con el PIN de árbitros.</dd>
      <dt>La tele se ve cortada.</dt>
      <dd>Pantalla completa con F11. Se adapta a cualquier tamaño.</dd>
      <dt>El chip dice «Sin conexión».</dt>
      <dd>Sigue trabajando: todo se guarda en el aparato y se sube solo cuando vuelve la señal.</dd>
    </dl>,
  ),

  // 13 · Lo que viene
  capitulo(
    "13",
    "Lo que viene",
    "Lo que todavía no hace la app.",
    <>
      <ul className="ml-lista">
        <li>
          <b>Inscripción online:</b> hoy inscribe el staff. Está en camino una página para que cada jugador se inscriba solo.
        </li>
        <li>
          <b>Base de datos del club:</b> Juan conecta la app con PadelReserve (Supabase). Mientras tanto corre en modo de prueba, en la memoria del servidor.
        </li>
        <li>
          <b>Ranking FVP automático:</b> se descarga solo cada mañana cuando la app está publicada.
        </li>
      </ul>
      <Nota titulo="¿Falta algo?" tono="cielo">
        Si algo de este libro no coincide con la app o te falta una respuesta, avísale al administrador para la próxima edición.
      </Nota>
    </>,
  ),
  pagina(
    "Fin del partido",
    <div className="ml-cierre">
      <p className="ml-eyebrow">Fin del partido</p>
      <h2>Gracias por hacer de cada torneo una buena noche.</h2>
      <p>La app crece con lo que pasa en la pista. Cada idea del equipo la mejora.</p>
      <p className="ml-chico">lamarinasportclub.vercel.app</p>
    </div>,
  ),
];

const CONTRATAPA: Pagina = {
  tipo: "contratapa",
  cuerpo: (
    <div className="ml-contratapa">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/isotipo-256.png" alt="" draggable={false} />
      <p>La Marina Sport Club</p>
      <p className="ml-chico">lamarinasportclub.vercel.app</p>
    </div>
  ),
};

/** El libro abierto necesita un número par de páginas: si hace falta, una en blanco antes de la contratapa. */
export const PAGINAS: Pagina[] = [
  ...CONTENIDO,
  ...((CONTENIDO.length + 1) % 2 ? [{ seccion: "Notas", cuerpo: <p className="ml-chico">Notas</p> }] : []),
  CONTRATAPA,
];

/** Capítulos para el índice: página donde empieza cada uno. */
export const INDICE: { n: string; titulo: string; pagina: number }[] = PAGINAS.flatMap((p, i) =>
  p.capitulo ? [{ ...p.capitulo, pagina: i }] : [],
);
