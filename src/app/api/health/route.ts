import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ status: "degraded", db: "down", error: String(e) }, { status: 503 });
  }
}
