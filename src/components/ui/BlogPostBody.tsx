"use client";

import type { ContentBlock } from "@/lib/content";
import "./BlogPostBody.css";

function splitParagraphs(text: string) {
  return text.split(/\n\n+/).filter(Boolean);
}

function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="blog-post-content">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "section":
            return (
              <section key={i} className="bp-section">
                {block.heading && <h2>{block.heading}</h2>}
                {splitParagraphs(block.body).map((p, j) => <p key={j}>{p}</p>)}
              </section>
            );

          case "banner":
            return (
              <div key={i} className="bp-banner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.src} alt={block.alt || ""} />
              </div>
            );

          case "split":
            return (
              <div key={i} className={`bp-split${block.layout === "right" ? " bp-split--reverse" : ""}`}>
                <div className="bp-split-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={block.src} alt={block.alt || ""} />
                </div>
                <div className="bp-split-text">
                  {block.heading && <h3>{block.heading}</h3>}
                  {splitParagraphs(block.body).map((p, j) => <p key={j}>{p}</p>)}
                </div>
              </div>
            );

          case "card-grid":
            return (
              <div key={i} className={`bp-grid${block.variant === "icon" ? " bp-grid--icon" : ""}`}>
                {block.cards.map((card, j) => (
                  <div key={j} className="bp-card">
                    {card.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.src} alt={card.heading} />
                    )}
                    <div className="bp-card-body">
                      <h3>{card.heading}</h3>
                      {splitParagraphs(card.body).map((p, k) => <p key={k}>{p}</p>)}
                    </div>
                  </div>
                ))}
              </div>
            );

          case "highlight":
            return (
              <div key={i} className={`bp-highlight${block.variant === "rose" ? " bp-highlight--rose" : ""}`}>
                <h2>{block.heading}</h2>
                {splitParagraphs(block.body).map((p, j) => <p key={j}>{p}</p>)}
              </div>
            );

          case "quote":
            return (
              <blockquote key={i} className="bp-quote">
                {block.text}
              </blockquote>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

interface Props {
  html?: string;
  blocks?: ContentBlock[];
}

export default function BlogPostBody({ html, blocks }: Props) {
  if (blocks?.length) {
    return <BlockRenderer blocks={blocks} />;
  }

  if (!html) return null;

  return (
    <div
      className="blog-post-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
