import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSessionSecret } from "@/lib/auth/sessionSecret";

const ADMIN_EMAILS = ["nikodola@gmail.com"];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;

    if (!token) {
      return NextResponse.json({ isAdmin: false });
    }

    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    const email = payload.email as string;
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ isAdmin: false });
    }
    return NextResponse.json({ isAdmin: true });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
