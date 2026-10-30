import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Términos y condiciones de uso" };

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      vigencia="30 de octubre de 2026"
      resumen={[
        "Cualquiera puede ver cuadros, rankings y resultados; solo el staff del Club los gestiona.",
        "El ranking se calcula automáticamente y el Club puede corregir errores.",
        "La plataforma es de uso exclusivo de La Marina Sport Club.",
      ]}
      secciones={[
        {
          id: "servicio",
          titulo: "El servicio",
          contenido: (
            <p>
              Plataforma de americanos, torneos y ranking de pádel de <b>La Marina Sport Club</b> (“el Club”), con tecnología de PadelReserve. Al
              usarla o participar en un evento aceptas estos términos.
            </p>
          ),
        },
        {
          id: "staff",
          titulo: "Cuentas del staff",
          contenido: (
            <p>
              Crear eventos, cargar marcadores, tomar fotos y cambiar ajustes es exclusivo del staff autorizado. Cada acceso es personal e
              intransferible y queda registrado. El Club puede retirar un acceso en cualquier momento.
            </p>
          ),
        },
        {
          id: "uso",
          titulo: "Uso permitido",
          contenido: (
            <p>
              No está permitido acceder sin autorización, compartir credenciales, alterar resultados ni usar la plataforma fuera del Club sin
              permiso escrito.
            </p>
          ),
        },
        {
          id: "resultados",
          titulo: "Resultados y rankings",
          contenido: (
            <p>
              Los marcadores los cargan el staff o los árbitros, y el ranking se calcula con las reglas publicadas en cada evento. El Club puede
              corregir errores y su decisión es final.
            </p>
          ),
        },
        {
          id: "eventos",
          titulo: "Inscripciones y cambios",
          contenido: (
            <p>
              Cada evento tiene sus propias condiciones de costo, cupos y fechas. Por causas de fuerza mayor, como la lluvia, el Club puede cambiar
              pistas, horarios o el formato.
            </p>
          ),
        },
        {
          id: "propiedad",
          titulo: "Propiedad intelectual",
          contenido: (
            <p>
              La marca y los contenidos son del Club, el software es de PadelReserve y los logos de los patrocinadores son de sus marcas. Nada
              de esto puede copiarse ni revenderse.
            </p>
          ),
        },
        {
          id: "responsabilidad",
          titulo: "Responsabilidad",
          contenido: (
            <p>
              Puede haber interrupciones por mantenimiento o conexión. El Club no responde por daños indirectos derivados de ellas, y la práctica
              deportiva es responsabilidad de cada jugador.
            </p>
          ),
        },
        {
          id: "ley",
          titulo: "Ley aplicable",
          contenido: <p>Estos términos se rigen por las leyes de la República Bolivariana de Venezuela.</p>,
        },
      ]}
    />
  );
}
