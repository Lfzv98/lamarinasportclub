"use client";

import { AjustesClub } from "@/components/AjustesClub";

/** Ajustes generales de Torneos (los de cada torneo están dentro del torneo). */
export default function AjustesTorneosPage() {
  return (
    <AjustesClub
      titulo="Ajustes de Torneos"
      descripcion="Solo staff. Claves de los torneos, pistas y horarios del club para programar partidos, y el contacto que sale en la TV. Los ajustes de cada torneo (días, desempates, patrocinadores) están dentro de cada torneo."
      secciones={["claves", "pistas", "horarios", "contacto"]}
      volver="/torneos"
    />
  );
}
