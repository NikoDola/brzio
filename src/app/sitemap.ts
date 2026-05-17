import { MetadataRoute } from "next";
import { getPosts } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

function toDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts({ publishedOnly: true });
  const now = new Date();
  const latestPost = posts.reduce<Date | undefined>((acc, p) => {
    const d = toDate(p.updatedAt) ?? toDate(p.createdAt);
    if (!d) return acc;
    if (!acc || d > acc) return d;
    return acc;
  }, undefined);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL,              priority: 1.0, changeFrequency: "weekly",  lastModified: latestPost ?? now },
    { url: `${SITE_URL}/blog`,    priority: 0.7, changeFrequency: "weekly",  lastModified: latestPost ?? now },
  ];

  const gameRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => p.type === "game")
    .map((p) => ({
      url: `${SITE_URL}/games/${p.slug}`,
      priority: 0.8,
      changeFrequency: "monthly",
      lastModified: toDate(p.updatedAt) ?? toDate(p.createdAt) ?? now,
    }));

  const blogRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => p.type === "blog")
    .map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      priority: 0.6,
      changeFrequency: "monthly",
      lastModified: toDate(p.updatedAt) ?? toDate(p.createdAt) ?? now,
    }));

  return [...staticRoutes, ...gameRoutes, ...blogRoutes];
}
