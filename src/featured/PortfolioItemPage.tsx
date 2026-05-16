import Image from "next/image";
import Link from "next/link";
import AutoplayVideo from "@/components/ui/AutoplayVideo";
import BlogPostBody from "@/components/ui/BlogPostBody";
import type { ContentBlock } from "@/lib/content";
import "./PortfolioItemPage.css";

interface PortfolioItemPageProps {
  item: {
    title: string;
    slug: string;
    description: string;
    image: string;
    images: string[];
    blocks?: ContentBlock[];
  };
  teamMember: { name: string; slug: string; image: string } | null;
  related: { title: string; slug: string; image: string }[];
}

export default function PortfolioItemPage({ item, teamMember, related }: PortfolioItemPageProps) {
  const allImages = [item.image, ...item.images];

  return (
    <>
      <section className="pitem-hero">
        <div className="pitem-hero-image">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            priority
          />
          <div className="pitem-hero-overlay" />
        </div>
        <div className="pitem-hero-content">
          <Link href="/our-work" className="pitem-back">
            ← Back to Portfolio
          </Link>

          <p className="pitem-hero-eyebrow">Portfolio</p>
          <h1 className="pitem-hero-title">{item.title}</h1>
        </div>
      </section>

      <section className="pitem-info">
        <div className="pitem-info-inner">
          {item.description && <p className="pitem-description">{item.description}</p>}
          {item.blocks && item.blocks.length > 0 && (
            <BlogPostBody blocks={item.blocks} />
          )}
          <Link href="/services" className="pitem-cta">
            Order a Similar Design
          </Link>
        </div>
      </section>

      <section className="pitem-gallery">
        <div className="pitem-gallery-inner">
          {allImages.map((src, idx) =>
            src.endsWith(".mp4") || src.endsWith(".mov") ? (
              <div key={idx} className="pitem-gallery-video-wrap">
                <AutoplayVideo src={src} className="pitem-gallery-video" />
              </div>
            ) : (
              <div key={idx} className="pitem-gallery-image">
                <Image
                  src={src}
                  alt={`${item.title} — view ${idx + 1}`}
                  fill
                  sizes="(max-width: 900px) 100vw, 900px"
                  style={{ objectFit: "contain" }}
                />
              </div>
            )
          )}
        </div>
      </section>

      {related.length > 0 && teamMember && (
        <section className="pitem-related">
          <div className="pitem-related-inner">
            <p className="pitem-related-eyebrow">More by {teamMember.name}</p>
            <div className="pitem-related-grid">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/portfolio/${r.slug}`}
                  className="pitem-related-item"
                >
                  <Image
                    src={r.image}
                    alt={r.title}
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="pitem-related-overlay">
                    <span>{r.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {teamMember && (
        <Link href={`/about-us/${teamMember.slug}`} className="pitem-designer-avatar-link">
          <div className="pitem-designer-avatar">
            <Image
              src={teamMember.image}
              alt={teamMember.name}
              fill
              sizes="60px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <span className="pitem-designer-avatar-name">{teamMember.name}</span>
        </Link>
      )}

      <section className="pitem-footer-cta">
        <div className="pitem-footer-cta-inner">
          <h2>Ready to build your brand?</h2>
          <p>Tell us your vision and we&apos;ll bring it to life.</p>
          <Link href="/services" className="pitem-footer-btn">
            Start Your Order
          </Link>
        </div>
      </section>
    </>
  );
}
