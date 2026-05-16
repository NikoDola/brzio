import PortfolioGrid from "@/components/sections/PortfolioGrid";
import FAQ from "@/components/sections/FAQ";
import Testimonials from "@/components/sections/Testimonials";
import ClientLogos from "@/components/sections/ClientLogos";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import "./OurClientsPage.css";

export default function OurClientsPage() {
  return (
    <>
      <div className="clients-hero">
        <p className="clients-hero-eyebrow">PORTFOLIO & CLIENTS</p>
        <h1 className="clients-hero-title">
          Work We&apos;re
          <br />
          Proud Of
        </h1>
        <p className="clients-hero-subtitle">
          Every project above was shared with client permission. From startups to
          established brands — this is what we do.
        </p>
        <div className="clients-hero-cta">
          <Button href="/services" variant="primary" size="lg">
            Start a Project
          </Button>
        </div>
      </div>

      <PortfolioGrid showHeader={false} />

      <ClientLogos />

      <Testimonials />

      <FAQ />

      <section className="clients-cta">
        <SectionHeading
          title="Ready to join our portfolio?"
          description="Order your custom logo design today and see why clients from 36 countries trust us with their brand."
          align="center"
        />
        <Button href="/services" variant="primary" size="lg">
          Order Now
        </Button>
      </section>
    </>
  );
}
