import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** POST /api/staff/logout → borra la sesión. */
export async function POST() {
  const res = NextResponse.json({ staff: null });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
