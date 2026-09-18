import { NextResponse } from "next/server";
import { koneDemoPayload } from "@/lib/koneDemo";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(koneDemoPayload());
}
