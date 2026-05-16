import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortfolioItemPage from "@/featured/PortfolioItemPage";
import ViewTracker from "@/components/ui/ViewTracker";
import { getPost, getPosts, getTeam } from "@/lib/content";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd, creativeWorkJsonLd, jsonLdScript } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug, "portfolio");
  if (!post || !post.published) return {};

  const title = post.title;
  const description = post.excerpt || post.title;
  const url = `${SITE_URL}/portfolio/${post.slug}`;
  const ogImage = post.thumbnail
    ? (post.thumbnail.startsWith("http") ? post.thumbnail : `${SITE_URL}${post.thumbnail}`)
    : null;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: post.title }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug, "portfolio");
  if (!post || !post.published) notFound();

  const [team, allPortfolio] = await Promise.all([
    getTeam(),
    getPosts({ type: "portfolio", publishedOnly: true }),
  ]);

  const member = team.find((m) => m.slug === post.teamMember) ?? null;

  const related = allPortfolio
    .filter((p) => p.slug !== post.slug && p.teamMember && p.teamMember === post.teamMember)
    .slice(0, 3)
    .map((p) => ({ title: p.title, slug: p.slug, image: p.thumbnail }));

  const work = creativeWorkJsonLd({
    title: post.title,
    slug: post.slug,
    description: post.excerpt || post.title,
    image: post.thumbnail || null,
    authorName: member?.name ?? null,
    createdAt: post.createdAt,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Our Work", path: "/our-work" },
    { name: post.title, path: `/portfolio/${post.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(work) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }} />
      <ViewTracker type="portfolio" slug={post.slug} />
      <PortfolioItemPage
        item={{
          title: post.title,
          slug: post.slug,
          description: post.excerpt,
          image: post.thumbnail,
          images: post.gallery,
          blocks: post.blocks,
        }}
        teamMember={member ? { name: member.name, slug: member.slug, image: member.image } : null}
        related={related}
      />
    </>
  );
}
