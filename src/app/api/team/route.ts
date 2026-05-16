import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getTeam, createTeamMember } from "@/lib/content";

const PROD_DISABLED = { error: "Team can only be edited locally. Edit JSON in repo and commit." };

export async function GET() {
  const team = await getTeam();
  return NextResponse.json(team);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json(PROD_DISABLED, { status: 403 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, role, bio, quote, image, heroBg, instagram, website, order } = body;

  if (!name || !slug || !role) {
    return NextResponse.json({ error: "name, slug, and role are required." }, { status: 400 });
  }

  const member = await createTeamMember({
    name,
    slug,
    role,
    bio: bio ?? "",
    quote: quote ?? "",
    image: image ?? "",
    heroBg: heroBg ?? "",
    instagram: instagram ?? "",
    website: website ?? "",
    order: order ?? 99,
  });
  return NextResponse.json({ id: member.id });
}
