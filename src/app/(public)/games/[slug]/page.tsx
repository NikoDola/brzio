import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/content";
import { getGameComponent } from "@/featured-games/registry";
import BlogPostBody from "@/components/ui/BlogPostBody";
import { SITE_URL, SITE_NAME, gameJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import "./game-page.css";

type PageStar = {
  xA: number;
  yA: number;
  xB: number;
  yB: number;
  size: number;
  color: string;
  speed: number;
  delay: number;
};

const PAGE_STAR_GROUPS = [
  { count: 30, blinks: 1 },
  { count: 30, blinks: 2 },
  { count: 30, blinks: 3 },
  { count: 10, blinks: 5 },
];
const PAGE_STAR_BASE_SECONDS = 2.6;
const PAGE_STAR_COLORS = [
  "rgba(255,255,255,0.95)",
  "rgba(125,223,255,0.9)",
  "rgba(254,202,87,0.82)",
];

function createPageStars(): PageStar[] {
  let seed = 49381;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  return PAGE_STAR_GROUPS.flatMap((group) =>
    Array.from({ length: group.count }, (_, i) => ({
      xA: Math.round(rand() * 10000) / 100,
      yA: Math.round(rand() * 10000) / 100,
      xB: Math.round(rand() * 10000) / 100,
      yB: Math.round(rand() * 10000) / 100,
      size: rand() < 0.12 ? 4 : rand() < 0.42 ? 3 : 2,
      color: PAGE_STAR_COLORS[i % PAGE_STAR_COLORS.length],
      speed: PAGE_STAR_BASE_SECONDS * group.blinks,
      delay: -rand() * PAGE_STAR_BASE_SECONDS * group.blinks,
    })),
  );
}

const PAGE_STARS = createPageStars();

function pageStarStyle(star: PageStar): CSSProperties {
  return {
    "--star-x-a": `${star.xA}vw`,
    "--star-y-a": `${star.yA}vh`,
    "--star-x-b": `${star.xB}vw`,
    "--star-y-b": `${star.yB}vh`,
    "--star-size": `${star.size}px`,
    "--star-color": star.color,
    "--star-speed": `${star.speed}s`,
    "--star-delay": `${star.delay}s`,
  } as CSSProperties;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug, "game");
  if (!post || !post.published) return {};

  const title = post.title;
  const description = post.excerpt || post.title;
  const url = `${SITE_URL}/games/${post.slug}`;
  const ogImage = post.thumbnail
    ? (post.thumbnail.startsWith("http") ? post.thumbnail : `${SITE_URL}${post.thumbnail}`)
    : null;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
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

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug, "game");
  if (!post || !post.published) notFound();

  const folder = post.gameSlug || post.slug;
  const GameComponent = getGameComponent(post.slug);

  const ld = gameJsonLd({
    title: post.title,
    slug: post.slug,
    description: post.excerpt || post.title,
    image: post.thumbnail || null,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Games", path: "/" },
    { name: post.title, path: `/games/${post.slug}` },
  ]);

  return (
    <div className="game-page">
      <div className="planet-page-starfield" aria-hidden="true">
        {PAGE_STARS.map((star, i) => (
          <span key={i} className="planet-page-star" style={pageStarStyle(star)} />
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }} />

      <div className="game-page-frame">
        <GameComponent gameSlug={folder} />
      </div>

      <div className="game-page-header">
        <Link href="/" className="game-back-link">← All Games</Link>
        <div className="game-page-heading">
          {post.tags.length > 0 && (
            <div className="game-page-tags">
              {post.tags.slice(0, 4).map((t) => (
                <span key={t} className="game-tag">{t}</span>
              ))}
            </div>
          )}
          <h1 className="game-page-title">{post.title}</h1>
          {post.excerpt && <p className="game-page-excerpt">{post.excerpt}</p>}
        </div>
      </div>

      {(post.blocks && post.blocks.length > 0) || post.content ? (
        <div className="game-page-body">
          <BlogPostBody html={post.content} blocks={post.blocks} />
        </div>
      ) : null}
    </div>
  );
}
