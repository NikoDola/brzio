import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/content";
import BlogPostBody from "@/components/ui/BlogPostBody";
import BlogPostHero from "@/components/ui/BlogPostHero";
import { SITE_URL, SITE_NAME, articleJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import "../blog.css";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug, "blog");
  if (!post || !post.published) return {};

  const title = post.title;
  const description = post.excerpt || post.title;
  const url = `${SITE_URL}/blog/${post.slug}`;
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
      publishedTime: post.createdAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug, "blog");
  if (!post || !post.published) notFound();

  const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

  const article = articleJsonLd({
    title: post.title,
    description: post.excerpt || post.title,
    slug: post.slug,
    image: post.thumbnail || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <div className="blog-post-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }} />
      {post.thumbnail ? (
        <BlogPostHero
          src={post.thumbnail}
          alt={post.title}
          title={post.title}
          tags={post.tags}
          date={post.createdAt ? formatDate(post.createdAt) : undefined}
        />
      ) : (
        <div className="blog-post-hero-no-image">
          <div className="blog-post-hero-no-image-inner">
            <div className="blog-post-meta">
              {post.tags.slice(0, 3).map((t) => (
                <span key={t} className="blog-tag">{t}</span>
              ))}
            </div>
            <h1 className="blog-post-title">{post.title}</h1>
          </div>
        </div>
      )}

      <div className="blog-post-body">
        <div className="blog-post-inner">
          <Link href="/blog" className="blog-back-link">← Back to Blog</Link>

          {post.excerpt && <p className="blog-post-excerpt">{post.excerpt}</p>}

          <BlogPostBody html={post.content} blocks={post.blocks} />

          {post.gallery.length > 0 && (
            <div className="blog-post-gallery">
              <h3>Gallery</h3>
              <div className="blog-post-gallery-grid">
                {post.gallery.map((src, i) => (
                  <div key={i} className="blog-post-gallery-item">
                    {isVideo(src) ? (
                      <video src={src} muted playsInline preload="metadata" className="blog-post-gallery-video" />
                    ) : (
                      <Image src={src} alt={`Gallery ${i + 1}`} fill style={{ objectFit: "cover" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
