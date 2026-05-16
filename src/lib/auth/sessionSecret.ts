let cached: Uint8Array | null = null;

export function getSessionSecret(): Uint8Array {
  if (cached) return cached;
  const raw = process.env.ADMIN_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing or too short (min 32 chars). " +
      "Set it in .env.local (dev) and your hosting env (prod) before starting the app.",
    );
  }
  cached = new TextEncoder().encode(raw);
  return cached;
}
