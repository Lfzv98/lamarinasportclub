import { NextResponse } from "next/server";
import { getRepository } from "@/lib/server/repository";
import type { ConfigClub } from "@/types/americano";

export const dynamic = "force-dynamic";

/** GET /api/club → horarios del club */
export async function GET() {
  const repo = getRepository();
  return NextResponse.json({ modo: repo.modo, club: await repo.obtenerClub() });
}

/** POST /api/club  body: { club: ConfigClub } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { club?: ConfigClub } | null;
  const club = body?.club;
  const horaOk = (h: unknown) => typeof h === "string" && /^\d{2}:\d{2}$/.test(h);
  if (!club || !Array.isArray(club.dias) || club.dias.length !== 7 || !club.dias.every((d) => horaOk(d.apertura) && horaOk(d.cierre)))
    return NextResponse.json({ error: "Payload inválido: se espera { club: ConfigClub } con 7 días" }, { status: 422 });
  const repo = getRepository();
  return NextResponse.json({ modo: repo.modo, club: await repo.guardarClub(club) });
}
