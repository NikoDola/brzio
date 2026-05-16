"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

interface BlogPostHeroProps {
  src: string;
  alt: string;
  title: string;
  tags: string[];
  date?: string;
}

export default function BlogPostHero({ src, alt, title, tags, date }: BlogPostHeroProps) {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!bgRef.current) return;
      if (window.innerWidth <= 760) return;
      bgRef.current.style.transform = `translateY(${window.scrollY * 0.4}px)`;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="blog-post-hero">
      <div className="blog-post-hero-bg" ref={bgRef}>
        <Image src={src} alt={alt} fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center" }} priority />
      </div>
      <div className="blog-post-hero-overlay" />
      <div className="blog-post-hero-content">
        {tags.length > 0 && (
          <div className="blog-post-hero-tags">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="blog-tag">{t}</span>
            ))}
            {date && <span className="blog-date">{date}</span>}
          </div>
        )}
        <h1 className="blog-post-title">{title}</h1>
      </div>
    </section>
  );
}
