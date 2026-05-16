import Image from "next/image";
import { getPartners } from "@/lib/content";
import type { Partner } from "@/lib/content";
import "./ClientLogos.css";

export default async function ClientLogos() {
  const partners = (await getPartners()).filter((p) => Boolean(p.image));
  if (partners.length === 0) return null;

  // 4 copies so the track is always wider than any viewport at any scroll position
  const looped: Partner[] = [...partners, ...partners, ...partners, ...partners];

  return (
    <div className="client-logos">
      <p className="client-logos-label">Trusted by brands worldwide</p>
      <div className="client-logos-track-wrapper">
        <div className="client-logos-track">
          {looped.map((logo, idx) => {
            const inner = (
              <Image
                src={logo.image}
                alt={logo.company}
                width={113}
                height={48}
                style={{ objectFit: "contain", height: "48px", width: "auto" }}
              />
            );

            if (logo.url) {
              return (
                <a
                  key={idx}
                  href={logo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="client-logo-item"
                  aria-label={logo.company}
                >
                  {inner}
                </a>
              );
            }

            return (
              <span key={idx} className="client-logo-item" aria-label={logo.company}>
                {inner}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
