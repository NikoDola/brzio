import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getPartners, createPartner } from "@/lib/content";

const PROD_DISABLED = { error: "Partners can only be edited locally. Edit JSON in repo and commit." };

export async function GET() {
  const partners = await getPartners();
  return NextResponse.json(partners);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json(PROD_DISABLED, { status: 403 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientName, company, image, url, review, country } = body;

  if (!company || typeof company !== "string" || !company.trim()) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const partner = await createPartner({
    clientName: typeof clientName === "string" ? clientName.trim() : "",
    company: company.trim(),
    image: image ?? "",
    url: url ?? "",
    review: typeof review === "string" ? review.trim() : "",
    country: typeof country === "string" ? country.trim().toUpperCase().slice(0, 2) : "",
  });
  return NextResponse.json({ id: partner.id });
}
