import Image from "next/image";
import Hero from "@/components/sections/Hero";
import Stats from "@/components/sections/Stats";
import PortfolioGrid from "@/components/sections/PortfolioGrid";
import ClientLogos from "@/components/sections/ClientLogos";
import Testimonials from "@/components/sections/Testimonials";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import "./HomePage.css";

export default function HomePage() {
  return (
    <>
      <Hero
        title={
          <>
            Learn <span className="hero-accent--green">Better.</span>
            <br />
            Build <span className="hero-accent--rose">Better.</span>
          </>
        }
        primaryCta={{ label: "Start a Project", href: "/services" }}
        secondaryCta={{ label: "Our Work", href: "/our-work" }}
      />

      <Stats />

      <ClientLogos />

      {/* About mini section */}
      <section className="home-about">
        <div className="home-about-inner">
          <div>
            <SectionHeading
              eyebrow="Who We Are"
              title={
                <>
                  More than an agency.
                  <br />An <em>ecosystem.</em>
                </>
              }
            />
            <p className="home-about-text">
              We connect clients with the best creative and technical talent on
              the internet. Graphic designers, UI/UX designers, software
              engineers, and branding specialists. Every professional in our
              network has at least 5 years of real, in-field experience.
            </p>
            <p className="home-about-text">
              We also educate. Clients learn what they are paying for, in plain
              language. Workers learn what the industry actually needs. Both
              sides build better projects.
            </p>

            <div className="home-about-features">
              <div className="home-about-feature">
                <div className="home-feature-icon">◈</div>
                <div className="home-feature-content">
                  <h3>15+ Years of Real Experience</h3>
                  <p>Not trend chasers. We write about tools we use and work we have actually shipped.</p>
                </div>
              </div>
              <div className="home-about-feature">
                <div className="home-feature-icon">◎</div>
                <div className="home-feature-content">
                  <h3>Project-Based, No Retainers</h3>
                  <p>A project has a beginning, a scope, and an end. You know what you are getting before you commit.</p>
                </div>
              </div>
              <div className="home-about-feature">
                <div className="home-feature-icon">◇</div>
                <div className="home-feature-content">
                  <h3>Honest Pricing</h3>
                  <p>
                    The price is calculated before checkout. No surprise
                    invoices, no vague estimates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="home-about-image-outer">
            <div className="home-about-image-wrap">
              <Image
                src="/images/home-web.jpg"
                alt="Digital Nectar studio workspace"
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="home-about-image-accent" />
          </div>
        </div>
      </section>

      {/* Portfolio - uses shared data (same source as /our-work) */}
      <PortfolioGrid limit={6} />

      <Testimonials />

      {/* CTA banner */}
      <section className="home-cta-banner">
        <SectionHeading
          title="Ready to build something real?"
          description="Whether it is a logo, a website, or a full brand identity, we give you a clear price and professionals who know the work."
          align="center"
        />
        <Button href="/services" variant="primary" size="lg">
          Start a Project
        </Button>
      </section>
    </>
  );
}
