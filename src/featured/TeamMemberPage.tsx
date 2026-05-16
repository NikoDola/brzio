"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TeamMember } from "@/lib/content";
import SectionHeading from "@/components/ui/SectionHeading";
import "./TeamMemberPage.css";

interface TeamMemberPageProps {
  member: TeamMember;
  portfolio: { title: string; slug: string; image: string }[];
  others: TeamMember[];
}

export default function TeamMemberPage({ member, portfolio, others }: TeamMemberPageProps) {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!bgRef.current) return;
      if (window.innerWidth <= 900) return;
      const scrollY = window.scrollY;
      bgRef.current.style.transform = `translateY(${scrollY * 0.4}px)`;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <section className="team-hero">
        <div className="team-hero-bg" ref={bgRef}>
          <Image
            src={member.heroBg}
            alt={member.name}
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center top" }}
            priority
          />
        </div>
        <div className="team-hero-overlay" />
        <div className="team-hero-content">
          <p className="team-hero-eyebrow">Our Hummingbirds</p>
          <h1 className="team-hero-name">{member.name}</h1>
          <p className="team-hero-role">{member.role}</p>
        </div>
      </section>

      <section className="team-bio">
        <div className="team-bio-inner">
          <div className="team-bio-sidebar">
            <div className="team-bio-photo">
              <Image
                src={member.image}
                alt={member.name}
                fill
                sizes="(max-width: 900px) 100vw, 350px"
                style={{ objectFit: "cover" }}
              />
              <div className="mask" />
            </div>
          </div>

          <div className="team-bio-content">
            <p className="team-bio-eyebrow">About {member.name}</p>

            <div className="team-bio-quote">
              <p>&ldquo;{member.quote}&rdquo;</p>
            </div>

            <p className="team-bio-text">{member.bio}</p>

            <div className="team-bio-links">
              {member.instagram && (
                <a
                  href={member.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="team-bio-link"
                >
                  Instagram
                  <span>↗</span>
                </a>
              )}
              {member.website && (
                <a
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="team-bio-link"
                >
                  Personal Website
                  <span>↗</span>
                </a>
              )}
              <Link href="/contact-us" className="team-bio-link">
                Work Together
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {portfolio.length > 0 && (
        <section className="team-portfolio">
          <div className="team-portfolio-inner">
            <div className="team-portfolio-header">
              <SectionHeading
                eyebrow="Selected Work"
                title={`${member.name.split(" ")[0]}'s Projects`}
              />
            </div>
            <div className="team-portfolio-grid">
              {portfolio.map((item, idx) => (
                <Link key={idx} href={`/portfolio/${item.slug}`} className="team-portfolio-item">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="team-portfolio-item-caption">{item.title}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="team-nav-bottom">
        <div className="team-nav-bottom-inner">
          <p className="team-nav-bottom-text">Meet the full team</p>
          <div className="team-nav-links">
            {others.map((m) => (
              <Link
                key={m.slug}
                href={`/about-us/${m.slug}`}
                className="team-nav-link"
              >
                {m.name}
              </Link>
            ))}
            <Link href="/contact-us" className="team-nav-link">
              Work With Us →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
