"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

const TINTA = "#0B0F19";

/**
 * Código QR de La Marina en SVG (se genera en el cliente, sin servicios externos).
 * Usa corrección de errores alta (H, hasta 30 %) para poder llevar la marca PR
 * de PadelReserve al centro, que tapa menos del 6 % del código. Los ojos van redondeados.
 */
export function QR({ texto, size = 96, className, logo = true }: { texto: string; size?: number | string; className?: string; logo?: boolean }) {
  const qr = useMemo(() => {
    try {
      return QRCode.create(texto, { errorCorrectionLevel: "H" });
    } catch {
      return null;
    }
  }, [texto]);
  if (!qr) return null;

  const n = qr.modules.size;
  const borde = 2;
  // Zona del logo: cuadrado centrado de ~22 % del lado, con la misma paridad que n para quedar centrado.
  let lado = logo ? Math.round(n * 0.22) : 0;
  if (lado && (n - lado) % 2) lado++;
  const ini = (n - lado) / 2;
  const enLogo = (f: number, c: number) => lado > 0 && f >= ini && f < ini + lado && c >= ini && c < ini + lado;
  const enOjo = (f: number, c: number) => (f < 7 && c < 7) || (f < 7 && c >= n - 7) || (f >= n - 7 && c < 7);

  let d = "";
  for (let f = 0; f < n; f++)
    for (let c = 0; c < n; c++) if (qr.modules.get(f, c) && !enOjo(f, c) && !enLogo(f, c)) d += `M${c + borde} ${f + borde}h1v1h-1z`;

  const ojo = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + borde + 0.5} y={y + borde + 0.5} width={6} height={6} rx={1.6} fill="none" stroke={TINTA} strokeWidth={1} />
      <rect x={x + borde + 2} y={y + borde + 2} width={3} height={3} rx={0.9} fill={TINTA} />
    </g>
  );
  const total = n + borde * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      style={{ width: size, height: size }}
      className={className}
      role="img"
      aria-label="Código QR para ver el ranking"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#FFFFFF" />
      <path d={d} fill={TINTA} />
      <g shapeRendering="geometricPrecision">
        {ojo(0, 0)}
        {ojo(n - 7, 0)}
        {ojo(0, n - 7)}
        {lado > 0 && (
          <>
            <rect x={ini + borde} y={ini + borde} width={lado} height={lado} rx={lado * 0.22} fill="#FFFFFF" />
            <MarcaPR x={ini + borde + 0.6} y={ini + borde + 0.6} lado={lado - 1.2} />
          </>
        )}
      </g>
    </svg>
  );
}

/** Marca de PadelReserve: "PR" en Space Grotesk, la R en verde, con el punto de la marca. */
export function MarcaPR({ x = 0, y = 0, lado }: { x?: number; y?: number; lado: number }) {
  const f = lado * 0.5;
  return (
    <g>
      <rect x={x} y={y} width={lado} height={lado} rx={lado * 0.24} fill={TINTA} />
      <text
        x={x + lado * 0.47}
        y={y + lado * 0.5 + f * 0.36}
        textAnchor="middle"
        fontFamily="var(--font-display), 'Space Grotesk', system-ui, sans-serif"
        fontWeight={700}
        fontSize={f}
        letterSpacing={-f * 0.06}
      >
        <tspan fill="#FFFFFF">P</tspan>
        <tspan fill="#7FE302">R</tspan>
      </text>
      <circle cx={x + lado * 0.83} cy={y + lado * 0.5 + f * 0.3} r={lado * 0.055} fill="#7FE302" />
    </g>
  );
}
