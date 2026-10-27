import type { Metadata } from "next";
import { Impreso } from "@/components/manual/Impreso";
import "../manual.css";

export const metadata: Metadata = {
  title: "Manual La Marina · para imprimir",
  description: "El manual de la app, página por página, listo para imprimir o guardar como PDF (A5).",
};

export default function ManualImprimirPage() {
  return <Impreso />;
}
