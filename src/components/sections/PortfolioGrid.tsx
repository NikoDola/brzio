import Image from "next/image";
import Link from "next/link";
import { getPosts, getTeam } from "@/lib/content";
import SectionHeading from "@/components/ui/SectionHeading";
import "./PortfolioGrid.css";

interface PortfolioGridProps {
  limit?: number;
  showHeader?: boolean;
}

export default async function PortfolioGrid({ limit, showHeader = true }: PortfolioGridProps) {
  const [posts, team] = await Promise.all([
    getPosts({ type: "portfolio", publishedOnly: true }),
    getTeam(),
  ]);
  const teamMap = new Map(team.map((m) => [m.slug, m.name]));
  const all = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    image: p.thumbnail,
    creator: (p.teamMember && teamMap.get(p.teamMember)) || "",
  }));
  const items = limit ? all.slice(0, limit) : all;

  return (
    <section className="portfolio-section">
      {showHeader && (
        <div className="portfolio-header">
          <SectionHeading
            eyebrow="Our Work"
            title="Branding crafted with purpose, built to last."
          />
        </div>
      )}
      <div className="portfolio-grid">
        {items.map((item, idx) => (
          <Link
            key={item.slug}
            href={`/portfolio/${item.slug}`}
            className={`portfolio-item ${idx === 0 ? "featured" : ""}`}
          >
            <Image
              src={item.image}
              alt={item.title}
              fill
              sizes="(max-width: 580px) 100vw, (max-width: 900px) 50vw, 33vw"
              style={{ objectFit: "cover" }}
              priority={idx < 3}
            />
            <div className="portfolio-item-overlay">
              <div className="portfolio-item-title">{item.title}</div>
              {item.creator && <div className="portfolio-item-designer">by {item.creator}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
