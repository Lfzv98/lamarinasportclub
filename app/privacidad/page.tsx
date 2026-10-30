import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      vigencia="30 de octubre de 2026"
      resumen={[
        "Solo usamos los datos necesarios para organizar tus partidos y mostrar resultados.",
        "Tu foto se toma solo con tu permiso y la puedes borrar cuando quieras.",
        "No vendemos tus datos ni los usamos para publicidad de terceros.",
        "Puedes pedir ver, corregir o borrar tus datos por WhatsApp.",
      ]}
      secciones={[
        {
          id: "responsable",
          titulo: "Responsable",
          contenido: (
            <p>
              <b>La Marina Sport Club</b> (“el Club”) es responsable de los datos tratados en esta plataforma. PadelReserve es el proveedor
              tecnológico y trata los datos solo por cuenta del Club.
            </p>
          ),
        },
        {
          id: "datos",
          titulo: "Datos que usamos",
          contenido: (
            <ul>
              <li><b>Participación:</b> nombre, género, nivel y pareja.</li>
              <li><b>Resultados:</b> marcadores, posiciones y estadísticas.</li>
              <li><b>Foto:</b> solo si la autorizas.</li>
              <li><b>Inscripción a torneos:</b> contacto y comprobante de pago.</li>
              <li><b>Staff:</b> correo y registro de ingresos.</li>
            </ul>
          ),
        },
        {
          id: "uso",
          titulo: "Para qué",
          contenido: (
            <p>
              Para armar rondas y cuadros, mostrar marcadores y rankings en vivo (pantallas del Club, código QR e imagen del podio), gestionar
              inscripciones y mantener el historial deportivo del Club. También para proteger la plataforma contra usos indebidos.
            </p>
          ),
        },
        {
          id: "fotos",
          titulo: "Fotos e imágenes",
          contenido: (
            <p>
              El staff toma tu foto solo si lo autorizas en ese momento. Se usa para identificarte en el cuadro, el ranking, las pantallas del
              Club y la imagen del podio. Puedes pedir que se cambie o se borre cuando quieras.
            </p>
          ),
        },
        {
          id: "acceso",
          titulo: "Quién los ve",
          contenido: (
            <p>
              Tu nombre, foto y resultados son visibles para el público del evento. Los datos de inscripción y pago solo los ve el staff
              autorizado del Club.
            </p>
          ),
        },
        {
          id: "conservacion",
          titulo: "Cuánto tiempo",
          contenido: (
            <p>
              Los resultados forman parte del historial deportivo del Club. Las fotos se guardan hasta que pidas su borrado. Los datos de
              inscripción, el tiempo que exija la gestión del evento y la ley.
            </p>
          ),
        },
        {
          id: "seguridad",
          titulo: "Seguridad",
          contenido: (
            <p>
              Conexión cifrada, acceso del staff con usuario personal y registro de cada ingreso. Sin cookies de publicidad ni de seguimiento:
              solo guardamos en tu navegador lo necesario para que la app funcione.
            </p>
          ),
        },
        {
          id: "derechos",
          titulo: "Tus derechos",
          contenido: (
            <p>
              Puedes pedir acceder, corregir o borrar tus datos (incluida tu foto) y retirar tu permiso en cualquier momento. Si borras tus datos,
              los resultados ya jugados se conservan con tu nombre anonimizado.
            </p>
          ),
        },
        {
          id: "menores",
          titulo: "Menores de edad",
          contenido: <p>Los menores de 18 años participan con autorización de su representante, quien ejerce estos derechos.</p>,
        },
        {
          id: "cambios",
          titulo: "Cambios y ley aplicable",
          contenido: (
            <p>
              Publicaremos cualquier cambio en esta página con su fecha. Se aplica la legislación venezolana, incluido el artículo 60 de la
              Constitución (honra, vida privada e imagen).
            </p>
          ),
        },
      ]}
    />
  );
}
