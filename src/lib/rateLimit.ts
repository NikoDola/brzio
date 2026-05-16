import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Per-bucket limits. We rate-limit by IP AND by email so a single attacker
// can't bypass by rotating one or the other.
const LIMITS = {
  ip:    { max: 5, windowMs: 15 * 60 * 1000 },
  email: { max: 3, windowMs: 15 * 60 * 1000 },
};

// We hash keys before using them as Firestore doc IDs so we don't store
// raw IPs / emails in the rate-limit collection.
function keyHash(prefix: "ip" | "email", value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

async function check(bucket: "ip" | "email", value: string): Promise<RateLimitResult> {
  const { max, windowMs } = LIMITS[bucket];
  const docRef = adminDb.collection("rateLimits").doc(keyHash(bucket, value));
  const now = Date.now();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? (snap.data() as { windowStart: number; count: number } | undefined) : undefined;

    const inWindow = data && data.windowStart > now - windowMs;

    if (!inWindow) {
      tx.set(docRef, {
        windowStart: now,
        count: 1,
        expireAt: Timestamp.fromMillis(now + windowMs),
      });
      return { ok: true, remaining: max - 1 };
    }

    if (data!.count >= max) {
      const retryAfterSec = Math.ceil((data!.windowStart + windowMs - now) / 1000);
      return { ok: false, retryAfterSec };
    }

    tx.update(docRef, { count: data!.count + 1 });
    return { ok: true, remaining: max - data!.count - 1 };
  });
}

export async function checkCheckoutRateLimit(ip: string, email: string): Promise<RateLimitResult> {
  try {
    const ipResult = await check("ip", ip);
    if (!ipResult.ok) return ipResult;
    const emailResult = await check("email", email);
    if (!emailResult.ok) return emailResult;
    return { ok: true, remaining: Math.min(ipResult.remaining, emailResult.remaining) };
  } catch (err) {
    // Fail-open: if Firestore is unreachable, let the request through
    // rather than blocking real customers. The error is logged for review.
    console.error("Rate-limit check failed (fail-open):", err);
    return { ok: true, remaining: 0 };
  }
}
