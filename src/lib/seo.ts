import type { Metadata } from "next";
import { getSeo } from "./content";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://digitalnectar.space";
export const SITE_NAME = "Digital Nectar";

const FALLBACK_TITLE = "Digital Nectar | Creative & Tech Studio";
const FALLBACK_DESCRIPTION =
  "Digital Nectar is a creative and technology studio specialising in brand identity, logo design, UI/UX, and software engineering.";

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
    alternateName: "The Logo Professionals",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    foundingDate: "2026",
    description: FALLBACK_DESCRIPTION,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE_URL}/contact-us`,
      availableLanguage: ["English"],
    },
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
  authorName?: string | null;
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
    author: a.authorName ? { "@type": "Person", name: a.authorName } : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
  };
}

interface PersonInput {
  name: string;
  slug: string;
  role: string;
  image: string | null;
  bio: string;
  sameAs?: string[];
}

export function personJsonLd(p: PersonInput) {
  const url = absoluteUrl(`/about-us/${p.slug}`);
  const imageAbs = p.image ? ogImageAbsolute(p.image) : null;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url,
    jobTitle: p.role,
    image: imageAbs ?? undefined,
    description: p.bio,
    sameAs: p.sameAs?.filter(Boolean),
    worksFor: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

interface CreativeWorkInput {
  title: string;
  slug: string;
  description: string;
  image: string | null;
  authorName?: string | null;
  createdAt: string | null;
}

export function creativeWorkJsonLd(w: CreativeWorkInput) {
  const url = absoluteUrl(`/portfolio/${w.slug}`);
  const imageAbs = w.image ? ogImageAbsolute(w.image) : null;
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: w.title,
    url,
    description: w.description,
    image: imageAbs ?? undefined,
    dateCreated: w.createdAt ?? undefined,
    creator: w.authorName ? { "@type": "Person", name: w.authorName } : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
