import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTeam, getPosts } from "@/lib/content";
import TeamMemberPage from "@/featured/TeamMemberPage";
import ViewTracker from "@/components/ui/ViewTracker";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd, personJsonLd, jsonLdScript } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeam();
  const member = team.find((m) => m.slug === slug);
  if (!member) return {};

  const title = `${member.name} — ${member.role}`;
  const description = member.bio?.slice(0, 160) ?? "";
  const url = `${SITE_URL}/about-us/${member.slug}`;
  const ogImage = member.image
    ? (member.image.startsWith("http") ? member.image : `${SITE_URL}${member.image}`)
    : null;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: member.name }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function TeamMemberRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [team, memberWork] = await Promise.all([
    getTeam(),
    getPosts({ type: "portfolio", teamMember: slug, publishedOnly: true }),
  ]);

  const member = team.find((m) => m.slug === slug);
  if (!member) notFound();

  const portfolio = memberWork.map((p) => ({ title: p.title, slug: p.slug, image: p.thumbnail }));
  const others = team.filter((m) => m.slug !== slug);

  const sameAs = [member.instagram, member.website].filter(Boolean);
  const person = personJsonLd({
    name: member.name,
    slug: member.slug,
    role: member.role,
    image: member.image,
    bio: member.bio,
    sameAs,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "About Us", path: "/about-us" },
    { name: member.name, path: `/about-us/${member.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(person) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }} />
      <ViewTracker type="team" slug={member.slug} />
      <TeamMemberPage member={member} portfolio={portfolio} others={others} />
    </>
  );
}
