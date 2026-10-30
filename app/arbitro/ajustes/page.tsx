"use client";

import { AjustesClub } from "@/components/AjustesClub";

/** Ajustes de Árbitros: los árbitros del club y su PIN. */
export default function AjustesArbitrosPage() {
  return (
    <AjustesClub
      titulo="Ajustes de Árbitros"
      descripcion="Solo staff. Los árbitros del club, su código personal y el PIN general de árbitros."
      secciones={["arbitros"]}
      volver="/arbitro"
    />
  );
}
