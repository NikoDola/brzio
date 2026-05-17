import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getPosts, createPost, type PostType } from "@/lib/content";

const PROD_DISABLED = { error: "Posts can only be edited locally. Edit JSON in repo and commit." };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as PostType | null;

  // Drafts are admin-only.
  const admin = await requireAdmin();
  const includeDrafts = admin !== null && searchParams.get("published") !== "true";

  const posts = await getPosts({
    type: type ?? undefined,
    publishedOnly: !includeDrafts,
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json(PROD_DISABLED, { status: 403 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, slug, excerpt, content, blocks, thumbnail, gallery, type, tags, published, gameSlug } = body;

  if (!title || !slug || !type) {
    return NextResponse.json({ error: "title, slug, and type are required." }, { status: 400 });
  }
  if (type !== "blog" && type !== "game") {
    return NextResponse.json({ error: "type must be 'blog' or 'game'." }, { status: 400 });
  }
  if (type === "game" && !gameSlug) {
    return NextResponse.json({ error: "gameSlug is required for game posts." }, { status: 400 });
  }

  const post = await createPost({
    title,
    slug,
    excerpt: excerpt ?? "",
    content: content ?? "",
    blocks: blocks ?? [],
    thumbnail: thumbnail ?? "",
    gallery: gallery ?? [],
    type,
    tags: tags ?? [],
    published: published ?? false,
    gameSlug: type === "game" ? gameSlug : undefined,
  });
  return NextResponse.json({ id: post.id });
}
