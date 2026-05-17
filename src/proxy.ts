import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/auth/sessionSecret";

const ADMIN_EMAILS = ["igor.dolovski@gmail.com", "nikodola@gmail.com"];

// The entire admin and content-editing surface is local-only.
// In production every one of these paths returns 404 so the admin doesn't
// exist for anyone — not even with a stolen session cookie.
const LOCAL_ONLY_PREFIXES = [
  "/admin",
  "/api/admin-auth",
  "/api/admin-check",
  "/api/posts",
  "/api/seo",
  "/api/upload",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && LOCAL_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/admin/login", req.url));

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    const email = payload.email as string;
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: [
    // Match everything except Next.js internals, the Stripe webhook, and static assets.
    "/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|ico|woff|woff2|ttf|eot|css|js|map|txt|xml|html)$).*)",
  ],
};
