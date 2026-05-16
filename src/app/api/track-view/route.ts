import { NextRequest, NextResponse } from "next/server";
import { recordView, isValidViewType } from "@/lib/views";

export async function POST(req: NextRequest) {
  try {
    const { type, slug } = await req.json();
    if (!isValidViewType(type)) return NextResponse.json({ ok: true });
    if (typeof slug !== "string" || !slug) return NextResponse.json({ ok: true });
    await recordView(type, slug);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}
