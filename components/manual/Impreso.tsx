"use client";

import { useEffect, type CSSProperties } from "react";
import { Cara } from "./Libro";
import { PAGINAS } from "./paginas";

/** El manual hoja por hoja en A5 (148 × 210 mm): para imprimir o "Guardar como PDF". */
export function Impreso() {
  // Al imprimir no hay scroll: las capturas se cargan todas desde el principio.
  useEffect(() => {
    document.querySelectorAll<HTMLImageElement>(".ml-impreso img").forEach((img) => (img.loading = "eager"));
  }, []);
  return (
    <div className="ml-app ml-impreso">
      {PAGINAS.map((p, i) => (
        <div key={i} className="ml-hoja-impresa" style={{ "--pw": "148mm", "--fs": 1 } as CSSProperties}>
          <Cara pagina={p} numero={i} lado={i % 2 ? "der" : "izq"} onIr={() => {}} />
        </div>
      ))}
    </div>
  );
}
