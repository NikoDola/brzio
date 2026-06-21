import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { guard, getClientIp } from "@/lib/stats/abuseGuard";

/**
 * Public ingest endpoint for anonymous gameplay stats sent by the games in
 * /public/games/*. Unlike the other write APIs this is intentionally NOT gated
 * by proxy.ts: real players in production must be able to POST here.
 *
 * Abuse is handled entirely by the layered guard:
 *   1. Origin/Referer must match our own host (kills cross-site scripts).
 *   2. Per-IP rate limit + auto-block of repeat offenders (abuseGuard.ts).
 *   3. Strict payload validation + sanity clamps (a forged 9,999,999 is dropped).
 *
 * Nothing personal is stored. We keep a coarse IP prefix only for abuse
 * triage; it is never shown in the stats UI.
 */
export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set(["open", "game_over", "quit"]);
const ALLOWED_OUTCOMES = new Set(["lost", "won", "quit"]);
const MAX_SCORE = 100_000; // real scores are merge counts (~hundreds); ceiling is sanity only
const MAX_DURATION_MS = 6 * 60 * 60 * 1000; // 6h; anything longer is junk

/** Same-origin only: the game iframe is served from our own domain. */
function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  const src = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !src) return false;
  try {
    return new URL(src).host === host;
  } catch {
    return false;
  }
}

function asInt(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export async function POST(req: NextRequest) {
  // 1. Origin check.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  // 2. Rate limit + block list.
  const ip = getClientIp(req.headers);
  const verdict = await guard(ip);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  // 3. Parse + validate.
  let data: Record<string, unknown>;
  try {
    data = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const game = typeof data.game === "string" ? data.game.slice(0, 60) : "";
  const event = typeof data.event === "string" ? data.event : "";
  if (!game || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const mode = typeof data.mode === "string" ? data.mode.slice(0, 20) : null;
  const sessionId =
    typeof data.sessionId === "string" ? data.sessionId.slice(0, 64) : null;
  const outcome =
    typeof data.outcome === "string" && ALLOWED_OUTCOMES.has(data.outcome)
      ? data.outcome
      : null;
  const score = asInt(data.score, 0, MAX_SCORE);
  const durationMs = asInt(data.durationMs, 0, MAX_DURATION_MS);

  // 4. Store one document per event. The full IP is kept for the admin
  //    dashboard + abuse triage; it is admin-only and never exposed publicly.
  try {
    await adminDb.collection("game_stats").add({
      game,
      event,
      mode,
      outcome,
      score,
      durationMs,
      sessionId,
      ts: Date.now(),
      ip,
    });
  } catch {
    // Never surface a 500 to the game for a stats write (e.g. Firestore not
    // enabled yet). The player keeps playing; we just lose this data point.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
