import Image from "next/image";
import Link from "next/link";
import { getPosts } from "@/lib/content";
import { metadataForRoute } from "@/lib/seo";
import "./blog.css";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata() {
  return metadataForRoute("/blog");
}

export default async function BlogPage() {
  const posts = await getPosts({ type: "blog", publishedOnly: true });

  return (
    <div className="blog-page">
      <section className="blog-hero">
        <div className="blog-hero-inner">
          <p className="blog-eyebrow">Insights & Resources</p>
          <h1 className="blog-hero-title">The Digital Nectar Blog</h1>
          <p className="blog-hero-sub">
            Design tips, branding strategy, and behind-the-scenes from our studio.
          </p>
        </div>
      </section>

      <section className="blog-grid-section">
        <div className="blog-grid-inner">
          {posts.length === 0 ? (
            <div className="blog-empty">
              <p>No posts yet. Check back soon.</p>
            </div>
          ) : (
            <div className="blog-grid">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-card-image">
                    {post.thumbnail ? (
                      <Image src={post.thumbnail} alt={post.title} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="blog-card-image-placeholder" />
                    )}
                  </div>
                  <div className="blog-card-body">
                    <div className="blog-card-meta">
                      {post.tags.slice(0, 2).map((t) => (
                        <span key={t} className="blog-tag">{t}</span>
                      ))}
                      {post.createdAt && <span className="blog-date">{formatDate(post.createdAt)}</span>}
                    </div>
                    <h2 className="blog-card-title">{post.title}</h2>
                    {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}
                    <span className="blog-card-read">Read more →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
