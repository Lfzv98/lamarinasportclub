import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" vigencia="30 de octubre de 2026">
      <p>
        Esta política explica qué datos personales trata <b>La Marina Sport Club</b> (“el Club”) en esta plataforma de americanos, torneos y
        ranking de pádel (la “Plataforma”), operada con tecnología de PadelReserve, para qué los usa y qué derechos tienes. Al inscribirte o
        participar en un evento del Club aceptas esta política.
      </p>

      <h2>1. Responsable</h2>
      <p>
        El responsable de los datos es La Marina Sport Club. Puedes escribirnos por WhatsApp al +58 424 596 8373 o por Instagram
        (@lamarinasportclub) para cualquier consulta sobre tus datos. PadelReserve actúa como proveedor tecnológico y trata los datos solo
        por cuenta y bajo instrucciones del Club.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><b>Datos de participación:</b> nombre y apellido, género y categoría o nivel de juego, pareja o dupla.</li>
        <li><b>Resultados deportivos:</b> marcadores, posiciones, estadísticas y rankings de cada evento.</li>
        <li><b>Fotos:</b> la foto del jugador o de la dupla que el staff toma al inscribirte, solo con tu permiso.</li>
        <li><b>Inscripciones a torneos:</b> los datos que completes en el formulario (por ejemplo teléfono, correo, documento o comprobante de pago).</li>
        <li><b>Datos del staff:</b> correo y sesión de los miembros del equipo del Club que administran la Plataforma.</li>
        <li><b>Datos técnicos:</b> datos mínimos del navegador y del dispositivo necesarios para que la Plataforma funcione y sea segura.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Organizar los eventos: armar las rondas, las pistas, los cuadros y los horarios.</li>
        <li>Mostrar en vivo el cuadro, los marcadores y el ranking en las pantallas del Club, en la vista pública del código QR y en la imagen del podio.</li>
        <li>Gestionar inscripciones, pagos y comunicaciones sobre los eventos.</li>
        <li>Mantener el historial de resultados y las estadísticas deportivas del Club.</li>
        <li>Proteger la Plataforma, prevenir el uso indebido y cumplir obligaciones legales.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>

      <h2 id="fotos">4. Fotos e imágenes</h2>
      <p>
        El staff solo toma tu foto si das tu permiso en el momento. La foto se usa para identificarte en el cuadro, en el ranking, en las
        pantallas del Club y en la imagen del podio que tú mismo puedes descargar y compartir. Puedes pedir en cualquier momento que se
        borre o se cambie. Si publicas la imagen del podio en tus redes, esa publicación queda bajo tu control.
      </p>

      <h2>5. Quién puede ver tus datos</h2>
      <p>
        El nombre, la foto y los resultados de un evento son visibles para el público del evento (pantallas del Club y vista del código QR).
        El resto de los datos, como los de inscripción y pago, solo los ve el staff autorizado del Club. Los proveedores tecnológicos que
        alojan la Plataforma acceden a los datos solo para prestar el servicio y con medidas de seguridad adecuadas.
      </p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <p>
        Los resultados y rankings se guardan como historial deportivo del Club. Las fotos se guardan mientras sigas participando o hasta que
        pidas su borrado. Los datos de inscripción y pago se guardan el tiempo necesario para gestionar el evento y cumplir obligaciones legales.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Usamos conexión cifrada (HTTPS), acceso restringido al staff con credenciales personales y registros de los cambios. Ningún sistema es
        100 % infalible, pero aplicamos medidas razonables para proteger tus datos.
      </p>

      <h2 id="derechos">8. Tus derechos</h2>
      <p>
        Puedes pedir acceder a tus datos, corregirlos, borrarlos (incluida tu foto), oponerte a su uso o retirar tu permiso, escribiéndonos por
        WhatsApp o Instagram. Responderemos en un plazo razonable. Borrar tus datos no cambia los resultados ya jugados por los demás
        participantes; en ese caso se anonimiza tu nombre.
      </p>

      <h2>9. Menores de edad</h2>
      <p>Los menores de 18 años solo pueden participar con la autorización de su madre, padre o representante, quien ejerce estos derechos.</p>

      <h2>10. Almacenamiento en tu dispositivo</h2>
      <p>
        La Plataforma guarda datos en tu navegador (almacenamiento local) para funcionar sin conexión y recordar tu sesión. No usamos cookies
        de publicidad ni de seguimiento de terceros.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Podemos actualizar esta política. Publicaremos la nueva versión en esta misma página con su fecha de vigencia. Esta política se rige por
        la legislación de la República Bolivariana de Venezuela, incluido el artículo 60 de la Constitución sobre la protección de la honra, la
        vida privada, la propia imagen y la limitación del uso de la informática.
      </p>
    </PaginaLegal>
  );
}
