import { adminDb } from "@/lib/firebase/admin";

/**
 * Layered, free abuse protection for the public stats ingest endpoint.
 *
 * The endpoint accepts data from the browser, so it can never be fully
 * trusted. The goal here is to make scripted spam pointless and to auto-block
 * the few who try anyway, while protecting the Firebase free quota from being
 * burned by a flood.
 *
 * Order of defence (cheapest first):
 *   1. In-memory block cache  -> 0 Firestore ops for a known bad IP.
 *   2. In-memory rate limit   -> 0 Firestore ops, catches bursts on a warm
 *      instance (min gap between requests + max per rolling window).
 *   3. Firestore block list   -> 1 read, covers cold starts / other instances
 *      where the in-memory caches are empty.
 *
 * When the in-memory limit is tripped we record a durable "strike". After a
 * few strikes the IP is auto-blocked (the block expires itself after a day, so
 * shared/NAT IPs are never permanently banned by accident).
 */

// Tunables. Generous for real players, tight enough that spam is not worth it.
const WINDOW_MS = 60_000; // rolling window for the per-IP rate limit
const MAX_PER_WINDOW = 25; // a human cannot generate this many events a minute
const MIN_GAP_MS = 800; // reject two requests closer than this
const STRIKE_LIMIT = 3; // tripping the limit this many times -> auto-block
const BLOCK_MS = 24 * 60 * 60 * 1000; // auto-block duration (self-expiring)
const STRIKE_THROTTLE_MS = 5_000; // at most one Firestore strike write / IP / this

// Per-instance memory. Serverless instances are short-lived, so these are only
// a fast FIRST gate with zero Firestore cost. The Firestore layer is the
// durable, cross-instance source of truth.
const recentHits = new Map<string, number[]>(); // ip -> request timestamps
const blockedUntilCache = new Map<string, number>(); // ip -> epoch ms
const lastStrikeAt = new Map<string, number>(); // ip -> epoch ms

export type GuardResult =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/** Best-effort client IP from the proxy headers Vercel sets. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// Firestore doc ids cannot contain "/". Keep ids safe and bounded.
function ipDocId(ip: string): string {
  return ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 200) || "unknown";
}

export async function guard(ip: string): Promise<GuardResult> {
  const now = Date.now();

  // 1. Known-blocked in memory -> reject instantly, no Firestore ops.
  const cachedBlock = blockedUntilCache.get(ip);
  if (cachedBlock && cachedBlock > now) {
    return { ok: false, status: 403, reason: "blocked" };
  }

  // 2. In-memory rate limit -> no Firestore ops. Catches floods on a warm
  //    instance before they can cost us anything.
  const hits = (recentHits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  const tooSoon = hits.length > 0 && now - hits[hits.length - 1] < MIN_GAP_MS;
  const tooMany = hits.length >= MAX_PER_WINDOW;
  if (tooSoon || tooMany) {
    // Throttle the durable strike write so a flood cannot burn the quota.
    if (now - (lastStrikeAt.get(ip) || 0) > STRIKE_THROTTLE_MS) {
      lastStrikeAt.set(ip, now);
      await recordStrike(ip, now);
    }
    return { ok: false, status: 429, reason: "rate_limited" };
  }

  // 3. Durable block check (1 read) for cold starts / other instances.
  try {
    const snap = await adminDb.collection("blocked_ips").doc(ipDocId(ip)).get();
    if (snap.exists) {
      const until = (snap.get("until") as number) || 0;
      if (until > now) {
        blockedUntilCache.set(ip, until);
        return { ok: false, status: 403, reason: "blocked" };
      }
    }
  } catch {
    // If Firestore is unreachable, fall through. The in-memory gate above
    // still protects us and we would rather drop a stat than 500 a player.
  }

  // 4. Accept and remember the hit.
  hits.push(now);
  recentHits.set(ip, hits);
  return { ok: true };
}

/** Record a strike; auto-block once the limit is reached. Best-effort. */
async function recordStrike(ip: string, now: number): Promise<void> {
  const id = ipDocId(ip);
  try {
    const ref = adminDb.collection("rate_strikes").doc(id);
    const count = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const prev = doc.exists ? (doc.get("count") as number) || 0 : 0;
      const next = prev + 1;
      tx.set(ref, { count: next, ip, lastAt: now }, { merge: true });
      return next;
    });
    if (count >= STRIKE_LIMIT) {
      const until = now + BLOCK_MS;
      await adminDb.collection("blocked_ips").doc(id).set({
        ip,
        until,
        blockedAt: now,
        reason: "auto: repeated rate-limit",
      });
      blockedUntilCache.set(ip, until);
    }
  } catch {
    // Best-effort. The in-memory limiter is already rejecting this IP.
  }
}
