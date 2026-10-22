"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Código QR en SVG (se genera en el cliente, sin servicios externos). */
export function QR({ texto, size = 96, className }: { texto: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(texto, { type: "svg", margin: 1, color: { dark: "#0B0F19", light: "#FFFFFF" }, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [texto]);
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Código QR"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
