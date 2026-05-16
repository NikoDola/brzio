import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getPosts, createPost } from "@/lib/content";

const PROD_DISABLED = { error: "Posts can only be edited locally. Edit JSON in repo and commit." };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "blog" | "portfolio" | null;
  const teamMember = searchParams.get("teamMember");

  // Drafts are admin-only. Without a valid admin session, callers always get
  // published posts regardless of what ?published= they pass.
  const admin = await requireAdmin();
  const includeDrafts = admin !== null && searchParams.get("published") !== "true";

  const posts = await getPosts({
    type: type ?? undefined,
    teamMember: teamMember ?? undefined,
    publishedOnly: !includeDrafts,
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json(PROD_DISABLED, { status: 403 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, slug, excerpt, content, thumbnail, gallery, type, teamMember, tags, published } = body;

  if (!title || !slug || !type) {
    return NextResponse.json({ error: "title, slug, and type are required." }, { status: 400 });
  }

  const post = await createPost({
    title,
    slug,
    excerpt: excerpt ?? "",
    content: content ?? "",
    thumbnail: thumbnail ?? "",
    gallery: gallery ?? [],
    type,
    teamMember: teamMember ?? null,
    tags: tags ?? [],
    published: published ?? false,
  });
  return NextResponse.json({ id: post.id });
}
