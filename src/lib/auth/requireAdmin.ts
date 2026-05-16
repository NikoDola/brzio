import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionSecret } from "./sessionSecret";

const ADMIN_EMAILS = ["igor.dolovski@gmail.com", "nikodola@gmail.com"];

export async function requireAdmin(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    const email = payload.email as string;
    if (!ADMIN_EMAILS.includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}
