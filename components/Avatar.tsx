import clsx from "clsx";

const GRADIENTES = [
  "from-neon to-emerald-400",
  "from-cielo to-indigo-500",
  "from-fuchsia-400 to-coral",
  "from-amber-300 to-orange-500",
  "from-teal-300 to-cyan-500",
  "from-violet-400 to-purple-600",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function iniciales(nombre: string) {
  return nombre
    .replace(/[^\p{L}\s/]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ nombre, fotoUrl, size = 40, className }: { nombre: string; fotoUrl?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (fotoUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nombre} style={style} className={clsx("shrink-0 rounded-full object-cover ring-2 ring-fondo", className)} />;
  return (
    <span
      style={style}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-noche ring-2 ring-fondo",
        GRADIENTES[hash(nombre) % GRADIENTES.length],
        className,
      )}
      aria-hidden
    >
      {iniciales(nombre) || "?"}
    </span>
  );
}

/** Avatares de una pareja; con `dupla` (foto de los dos juntos) va una sola foto, un poco más grande. */
export function AvatarPareja({ nombres, fotos, dupla, size = 36 }: { nombres: string[]; fotos?: (string | null | undefined)[]; dupla?: string | null; size?: number }) {
  if (dupla) return <Avatar nombre={nombres.join(" y ")} fotoUrl={dupla} size={nombres.length > 1 ? Math.round(size * 1.35) : size} />;
  return (
    <span className="flex -space-x-2">
      {nombres.map((n, i) => (
        <Avatar key={i} nombre={n} fotoUrl={fotos?.[i]} size={size} />
      ))}
    </span>
  );
}
