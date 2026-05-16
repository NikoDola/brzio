import Image from "next/image";
import Link from "next/link";
import type { TeamMember } from "@/lib/content";
import SectionHeading from "@/components/ui/SectionHeading";
import "./OurTeamPage.css";

export default function OurTeamPage({ team }: { team: TeamMember[] }) {
  return (
    <>
      <section className="our-team-hero">
        <div className="our-team-hero-inner">
          <p className="our-team-eyebrow">Our Hummingbirds</p>
          <h1 className="our-team-title">Meet the Team</h1>
          <p className="our-team-subtitle">
            The people behind Digital Nectar have spent their entire careers
            inside the freelance world as designers, developers, and
            outsourcers. When the workload grew bigger than what we could ship
            ourselves, we did not just hire. We built a network of trusted
            professionals. This is the formal version of that network.
          </p>
        </div>
      </section>

      <section className="our-team-grid-section">
        <div className="our-team-grid">
          {team.map((member) => (
            <Link
              key={member.slug}
              href={`/about-us/${member.slug}`}
              className="our-team-card"
            >
              <div className="our-team-card-image">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="our-team-card-info">
                <div className="our-team-card-name">{member.name}</div>
                <div className="our-team-card-role">{member.role}</div>
                <span className="our-team-card-arrow">View Profile →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="our-team-cta">
        <SectionHeading
          eyebrow="Work With Us"
          eyebrowColor="rose"
          title="Ready to start a project?"
          description="Reach out and tell us what you need. We will match you with the right people from our network and give you a clear scope and price before anything begins."
          align="center"
        />
        <Link href="/contact-us" className="our-team-cta-btn">
          Get in Touch
        </Link>
      </section>
    </>
  );
}
