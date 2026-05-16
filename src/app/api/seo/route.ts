import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSeoMap, setSeo, SEO_ROUTES, type SeoEntry } from "@/lib/content";

const PROD_DISABLED = { error: "SEO can only be edited locally. Edit JSON in repo and commit." };

const VALID_PATHS = new Set(SEO_ROUTES.map((r) => r.path));

const MAX_TITLE = 200;
const MAX_DESC = 400;
const MAX_OG = 500;

function sanitizeEntry(input: unknown): SeoEntry | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim().slice(0, MAX_TITLE) : "";
  const description = typeof obj.description === "string" ? obj.description.trim().slice(0, MAX_DESC) : "";
  const ogImage = typeof obj.ogImage === "string" ? obj.ogImage.trim().slice(0, MAX_OG) : "";
  return { title, description, ogImage };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const map = await getSeoMap();
  return NextResponse.json(map);
}

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json(PROD_DISABLED, { status: 403 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const routePath = typeof body?.path === "string" ? body.path : "";
  if (!VALID_PATHS.has(routePath)) {
    return NextResponse.json({ error: "Unknown route." }, { status: 400 });
  }

  const entry = sanitizeEntry(body?.entry);
  if (!entry) return NextResponse.json({ error: "Invalid entry." }, { status: 400 });

  await setSeo(routePath, entry);
  return NextResponse.json({ ok: true });
}
