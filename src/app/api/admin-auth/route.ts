import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { adminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getSessionSecret } from "@/lib/auth/sessionSecret";

const ADMIN_EMAILS = ["igor.dolovski@gmail.com", "nikodola@gmail.com"];
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (!ADMIN_EMAILS.includes(decoded.email ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const token = await new SignJWT({ email: decoded.email, uid: decoded.uid })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(getSessionSecret());

    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SEVEN_DAYS,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin auth error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  return NextResponse.json({ ok: true });
}
