import Image from "next/image";
import SectionHeading from "@/components/ui/SectionHeading";
import "./AboutPage.css";

const values = [
  {
    title: "Honesty Over Hype",
    desc: "We do not promote ourselves with empty marketing. We talk about what we have actually used, built, and learned. If we have no experience with something, we say so.",
  },
  {
    title: "Education Over Mystification",
    desc: "We refuse to hide behind jargon. Every piece of communication we write is designed to make complicated things understandable, because a confused client is an easy target.",
  },
  {
    title: "Experience Over Trend-Chasing",
    desc: "15+ years in the field is not a slogan. It is the filter we apply to every recommendation, every tool we suggest, and every project we take on.",
  },
];

const principles = [
  "Work with professionals who have shipped real projects for real clients",
  "Get a clear price before you commit — no surprise invoices",
  "Receive honest advice, not upsells designed to inflate your bill",
  "Understand what you are buying, explained in plain language",
  "Access a network built on referrals and reputation, not advertising spend",
];

export default function AboutPage() {
  return (
    <>
      <section className="about-hero">
        <div className="about-hero-inner">
          <div>
            <p className="about-hero-eyebrow">About Us</p>
            <h1 className="about-hero-title">
              Built on
              <br />
              15 years of
              <br />
              honest work.
            </h1>
            <p className="about-hero-text">
              Digital Nectar started as Logo Professionals, an Instagram
              community built around real design tutorials and honest creative
              education. From zero, we grew it to 350,000 followers. Not with
              ads. With content that actually taught something.
            </p>
            <p className="about-hero-text">
              That community showed us something: the world does not need
              another generic agency. It needs an upgrade. A brand that takes
              the same honesty and teaching spirit and applies it to the full
              picture: design, development, education, and the freelance world
              itself. Digital Nectar is that upgrade.
            </p>
          </div>
          <div className="about-hero-image">
            <Image
              src="/images/about-team-photo.jpg"
              alt="Digital Nectar founders"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className="about-values">
        <div className="about-values-inner">
          <div className="about-values-header">
            <SectionHeading
              eyebrow="What We Stand For"
              title="Principles we do not negotiate on"
              align="center"
            />
          </div>
          <div className="about-values-grid">
            {values.map((v, idx) => (
              <div key={idx} className="about-value-card">
                <div className="about-value-number">0{idx + 1}</div>
                <h3 className="about-value-title">{v.title}</h3>
                <p className="about-value-desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-benefits">
        <div className="about-benefits-inner">
          <div>
            <SectionHeading
              eyebrow="Why Work With Us"
              title="What working with Digital Nectar actually means"
              description="We connect clients with verified creative and technical talent. Every professional in our network has at least 5 years of real, in-field experience. Not side hustles. Not portfolios built in a weekend. Real work, real clients, real results."
            />
          </div>
          <ul className="about-benefits-list">
            {principles.map((p, idx) => (
              <li key={idx}>
                <span className="about-benefit-check">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="about-mission">
        <div className="about-mission-inner">
          <p className="about-section-eyebrow">Our Mission</p>
          <blockquote className="about-mission-quote">
            To match clients with the best creative and technical talent on the
            internet, and to educate both sides of the work, so that great
            projects are built by people who understand each other.
          </blockquote>
          <p className="about-mission-vision-label">Our Vision</p>
          <blockquote className="about-mission-quote about-mission-quote--secondary">
            A freelance and creative industry where honesty replaces hype,
            where clients are respected enough to be educated, where scammers
            are called out, and where the best workers are recognised for real
            work.
          </blockquote>
        </div>
      </section>
    </>
  );
}
