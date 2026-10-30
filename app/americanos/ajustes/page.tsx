"use client";

import { AjustesClub } from "@/components/AjustesClub";

/** Ajustes de Americanos: publicidad del Modo TV, pistas, cambio entre rondas y contacto. */
export default function AjustesAmericanosPage() {
  return (
    <AjustesClub
      titulo="Ajustes de Americanos"
      descripcion="Solo staff. Las marcas que ruedan en el Modo TV, las pistas que se pueden usar, el tiempo para cambiar de pista y el contacto que sale en la TV."
      secciones={["publicidad", "pistas", "rondas", "contacto"]}
      volver="/americanos"
    />
  );
}
