import { SalidaAlInicio } from "@/components/SalidaAlInicio";

export const metadata = { title: "Inicio" };

/** Cualquier enlace viejo o mal escrito vuelve a la página principal de módulos en vez de mostrar un 404. */
export default function NoEncontrado() {
  return <SalidaAlInicio />;
}
