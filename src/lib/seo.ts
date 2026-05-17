import type { Metadata } from "next";
import { getSeo } from "./content";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brzio.com";
export const SITE_NAME = "Brzio";

const FALLBACK_TITLE = "Brzio | Mini Games";
const FALLBACK_DESCRIPTION =
  "Brzio is a collection of free browser mini-games. Quick, casual, and playable straight from your browser — no download, no sign-up.";

function absoluteUrl(routePath: string): string {
  if (routePath === "/") return SITE_URL;
  return `${SITE_URL}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function ogImageAbsolute(src: string): string | null {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${SITE_URL}${src.startsWith("/") ? src : `/${src}`}`;
}

export async function metadataForRoute(routePath: string): Promise<Metadata> {
  const seo = await getSeo(routePath);
  const title = seo.title || FALLBACK_TITLE;
  const description = seo.description || FALLBACK_DESCRIPTION;
  const canonical = absoluteUrl(routePath);
  const ogAbs = ogImageAbsolute(seo.ogImage);

  const images = ogAbs ? [{ url: ogAbs, width: 1200, height: 630, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images,
    },
    twitter: {
      card: ogAbs ? "summary_large_image" : "summary",
      title,
      description,
      images: ogAbs ? [ogAbs] : undefined,
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: FALLBACK_DESCRIPTION,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

interface Crumb { name: string; path: string }

export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

interface ArticleInput {
  title: string;
  description: string;
  slug: string;
  image: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function articleJsonLd(a: ArticleInput) {
  const url = absoluteUrl(`/blog/${a.slug}`);
  const imageAbs = a.image ? ogImageAbsolute(a.image) : null;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    url,
    mainEntityOfPage: url,
    datePublished: a.createdAt ?? undefined,
    dateModified: a.updatedAt ?? a.createdAt ?? undefined,
    image: imageAbs ? [imageAbs] : undefined,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
  };
}

interface GameInput {
  title: string;
  slug: string;
  description: string;
  image: string | null;
}

export function gameJsonLd(g: GameInput) {
  const url = absoluteUrl(`/games/${g.slug}`);
  const imageAbs = g.image ? ogImageAbsolute(g.image) : null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: g.title,
    url,
    description: g.description,
    image: imageAbs ?? undefined,
    applicationCategory: "GameApplication",
    operatingSystem: "Web Browser",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
