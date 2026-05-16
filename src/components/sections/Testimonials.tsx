import ReactCountryFlag from "react-country-flag";
import { getPartners } from "@/lib/content";
import { getCountryName } from "@/lib/countries";
import SectionHeading from "@/components/ui/SectionHeading";
import "./Testimonials.css";

export default async function Testimonials() {
  const partners = await getPartners();
  const reviews = partners.filter((p) => p.review && p.review.trim());
  if (reviews.length === 0) return null;

  return (
    <section className="testimonials">
      <div className="testimonials-header">
        <SectionHeading
          eyebrow="Client Reviews"
          title="Trusted by brands across the globe."
          align="center"
        />
      </div>

      <div className="testimonials-grid">
        {reviews.map((t) => {
          const displayName = t.clientName || t.company;
          return (
            <div key={t.id} className="testimonial-card">
              <span className="testimonial-quote-icon">&ldquo;</span>
              <p className="testimonial-text">{t.review}</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="testimonial-name">
                    <span>{displayName}</span>
                    {t.country && (
                      <span className="testimonial-flag" title={getCountryName(t.country)}>
                        <ReactCountryFlag countryCode={t.country} svg style={{ width: "18px", height: "auto" }} />
                      </span>
                    )}
                  </div>
                  {t.clientName && t.company && (
                    <div className="testimonial-company">{t.company}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
