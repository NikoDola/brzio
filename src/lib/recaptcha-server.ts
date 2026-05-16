// Server-side reCAPTCHA v3 verification.
// The client gets a token from grecaptcha.execute() and sends it with the
// checkout request. This module POSTs that token to Google's siteverify
// endpoint with our secret key, and returns whether the request looks human.

const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const MIN_SCORE = 0.5;       // Google's recommended threshold for v3
const EXPECTED_ACTION = "checkout";

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
  hostname?: string;
  challenge_ts?: string;
}

export type VerifyResult =
  | { ok: true; score: number }
  | { ok: false; reason: string };

export async function verifyRecaptchaToken(token: unknown): Promise<VerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // Fail-open if the secret isn't configured — lets the wizard work in dev
  // before reCAPTCHA is wired up. Logged so it's visible.
  if (!secret) {
    console.warn("RECAPTCHA_SECRET_KEY not set — skipping reCAPTCHA verification.");
    return { ok: true, score: 1 };
  }

  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "Missing reCAPTCHA token." };
  }

  let data: SiteVerifyResponse;
  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    data = (await res.json()) as SiteVerifyResponse;
  } catch (err) {
    console.error("reCAPTCHA siteverify network error:", err);
    return { ok: false, reason: "reCAPTCHA verification failed." };
  }

  if (!data.success) {
    return { ok: false, reason: `reCAPTCHA rejected: ${data["error-codes"]?.join(", ") ?? "unknown"}` };
  }

  if (data.action && data.action !== EXPECTED_ACTION) {
    return { ok: false, reason: `Unexpected reCAPTCHA action: ${data.action}` };
  }

  const score = data.score ?? 0;
  if (score < MIN_SCORE) {
    return { ok: false, reason: `Bot-like activity detected (score ${score}).` };
  }

  return { ok: true, score };
}
