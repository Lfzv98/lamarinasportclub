/**
 * Interruptor de Tenis. Apagado por defecto: La Marina no tiene canchas de tenis.
 * Para un club con tenis (Caracas) se enciende con NEXT_PUBLIC_TENIS=1 en su despliegue.
 * Apagado: no sale en el inicio ni en el menú, /tenis da 404, /api/tenis no responde
 * y los datos de prueba no cargan tenis.
 */
export const TENIS_ACTIVO = process.env.NEXT_PUBLIC_TENIS === "1";
