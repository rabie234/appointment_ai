import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { expirePendingAppointments } from "@/lib/pending-appointment-expiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!secret || !supplied) return false;

  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await expirePendingAppointments();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Expire pending appointments failed:", error);
    return NextResponse.json(
      { error: "Could not process pending appointments." },
      { status: 500 },
    );
  }
}
