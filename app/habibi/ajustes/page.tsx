"use client";

import { AjustesClub } from "@/components/AjustesClub";

/** Ajustes del Americano Torneo: publicidad del Modo TV, pistas, cambio entre rondas y contacto. */
export default function AjustesAmericanoTorneoPage() {
  return (
    <AjustesClub
      titulo="Ajustes del Americano Torneo"
      descripcion="Solo staff. Las marcas que ruedan en el Modo TV de los grupos y la llave, las pistas que se pueden usar, el tiempo para cambiar de pista y el contacto que sale en la TV."
      secciones={["publicidad", "pistas", "rondas", "contacto"]}
      volver="/habibi"
    />
  );
}
