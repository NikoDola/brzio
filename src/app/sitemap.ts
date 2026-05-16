import { MetadataRoute } from "next";
import { getTeam, getPosts } from "@/lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://digitalnectar.space";

function toDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [team, posts] = await Promise.all([
    getTeam(),
    getPosts({ publishedOnly: true }),
  ]);

  const now = new Date();
  const latestPost = posts.reduce<Date | undefined>((acc, p) => {
    const d = toDate(p.updatedAt) ?? toDate(p.createdAt);
    if (!d) return acc;
    if (!acc || d > acc) return d;
    return acc;
  }, undefined);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                     priority: 1.0, changeFrequency: "monthly", lastModified: latestPost ?? now },
    { url: `${BASE}/services`,       priority: 0.9, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE}/our-work`,       priority: 0.8, changeFrequency: "monthly", lastModified: latestPost ?? now },
    { url: `${BASE}/about-us`,       priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE}/our-team`,       priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE}/contact-us`,     priority: 0.7, changeFrequency: "yearly",  lastModified: now },
    { url: `${BASE}/blog`,           priority: 0.7, changeFrequency: "weekly",  lastModified: latestPost ?? now },
    { url: `${BASE}/cookie-policy`,  priority: 0.3, changeFrequency: "yearly",  lastModified: now },
  ];

  const teamRoutes: MetadataRoute.Sitemap = team.map((m) => ({
    url: `${BASE}/about-us/${m.slug}`,
    priority: 0.6,
    changeFrequency: "yearly",
    lastModified: now,
  }));

  const portfolioRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => p.type === "portfolio")
    .map((p) => ({
      url: `${BASE}/portfolio/${p.slug}`,
      priority: 0.6,
      changeFrequency: "yearly",
      lastModified: toDate(p.updatedAt) ?? toDate(p.createdAt) ?? now,
    }));

  const blogRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => p.type === "blog")
    .map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      priority: 0.6,
      changeFrequency: "monthly",
      lastModified: toDate(p.updatedAt) ?? toDate(p.createdAt) ?? now,
    }));

  return [...staticRoutes, ...teamRoutes, ...portfolioRoutes, ...blogRoutes];
}
