import type { Metadata } from "next";
import { Libro } from "@/components/manual/Libro";
import "./manual.css";

export const metadata: Metadata = {
  title: "Manual La Marina",
  description: "El manual de la app de La Marina de la A a la Z: americanos, torneos, árbitros, pantallas de TV y lo que ve cada jugador.",
};

export default function ManualPage() {
  return <Libro />;
}
