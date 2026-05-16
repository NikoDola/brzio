"use client";

import { useState } from "react";
import { faq as defaultFaq } from "@/lib/data";
import SectionHeading from "@/components/ui/SectionHeading";
import "./FAQ.css";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items?: FAQItem[];
  eyebrow?: string;
  title?: string;
  description?: string;
}

export default function FAQ({
  items = defaultFaq,
  eyebrow = "FAQ",
  title = "Common Questions",
  description = "Everything you need to know about working with us.",
}: FAQProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="faq-section">
      <div className="faq-inner">
        <div className="faq-sidebar">
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            description={
              <>
                {description}{" "}
                <a href="/contact-us" style={{ color: "var(--primary-green)" }}>
                  Contact us directly.
                </a>
              </>
            }
          />
        </div>

        <div className="faq-list">
          {items.map((item, idx) => (
            <div key={idx} className="faq-item">
              <button
                className="faq-question"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              >
                {item.question}
                <span className={`faq-icon ${openIdx === idx ? "open" : ""}`}>
                  +
                </span>
              </button>
              <div className={`faq-answer ${openIdx === idx ? "open" : ""}`}>
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
