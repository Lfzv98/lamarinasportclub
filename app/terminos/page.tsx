import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones de uso" vigencia="30 de octubre de 2026">
      <p>
        Estos términos regulan el uso de la plataforma de americanos, torneos y ranking de pádel de <b>La Marina Sport Club</b> (“el Club”),
        operada con tecnología de PadelReserve (la “Plataforma”). Al usarla o participar en un evento aceptas estos términos.
      </p>

      <h2>1. Uso de la Plataforma</h2>
      <ul>
        <li>El público puede ver el cuadro, el ranking y los resultados de los eventos, y descargar o compartir su imagen del podio.</li>
        <li>Crear, editar o borrar eventos, cargar marcadores, tomar fotos y cambiar ajustes es exclusivo del staff autorizado del Club.</li>
        <li>Está prohibido intentar acceder sin autorización, compartir credenciales del staff, alterar resultados o usar la Plataforma fuera del Club sin permiso escrito.</li>
      </ul>

      <h2>2. Cuentas del staff</h2>
      <p>
        Cada miembro del staff es responsable de mantener en secreto sus credenciales y de cerrar sesión en equipos compartidos. Las acciones
        quedan registradas. El Club puede suspender un acceso ante cualquier uso indebido.
      </p>

      <h2>3. Resultados y rankings</h2>
      <p>
        Los marcadores los carga el staff o los árbitros del Club. El ranking se calcula de forma automática con las reglas que se muestran
        en cada evento. Ante cualquier error, el Club puede corregir los resultados; la decisión del staff del Club es final.
      </p>

      <h2>4. Inscripciones, pagos y cambios</h2>
      <p>
        Las condiciones de cada evento (costo, cupos, fechas, reembolsos) son las que publica el Club para ese evento. El Club puede cambiar
        horarios, pistas o el formato por causas de fuerza mayor, como lluvia, y reorganizar las rondas para que todos jueguen.
      </p>

      <h2>5. Fotos e imágenes</h2>
      <p>
        Al aceptar que el staff te tome una foto, autorizas su uso dentro de la Plataforma y en las pantallas del Club para el evento. Los
        detalles están en la <a href="/privacidad#fotos">política de privacidad</a>. Puedes pedir su borrado en cualquier momento.
      </p>

      <h2>6. Publicidad</h2>
      <p>
        Las marcas que aparecen en las pantallas del Club son patrocinadores. Sus logos son propiedad de cada marca y se muestran con su autorización.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        La marca, el logo y los contenidos de La Marina Sport Club son del Club. El software de la Plataforma es de PadelReserve. No se pueden
        copiar, revender ni usar para otros clubes sin autorización escrita.
      </p>

      <h2>8. Disponibilidad y responsabilidad</h2>
      <p>
        Trabajamos para que la Plataforma esté siempre disponible, pero puede haber interrupciones por mantenimiento o fallas de conexión. El
        Club no responde por daños indirectos derivados de esas interrupciones. La práctica deportiva es bajo la responsabilidad de cada jugador.
      </p>

      <h2>9. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Para cualquier consulta escríbenos por WhatsApp al
        +58 424 596 8373 o por Instagram (@lamarinasportclub).
      </p>
    </PaginaLegal>
  );
}
