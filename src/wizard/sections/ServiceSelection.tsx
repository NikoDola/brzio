"use client"
import { useState, useEffect, useRef } from "react"
import { T } from "./tokens"
import ServiceCard from "../ui/ServiceCard"
import "./ServiceSelection.css"

type SelectableService = "design" | "website"

interface Props {
  onSelect: (type: SelectableService) => void
  submitRef?: { current: (() => void) | null }
  setNextDisabled?: (v: boolean) => void
  initialValue?: SelectableService | "redesign" | null
}

const LOGO_STEPS = [
  { n: 1, heading: "Fill out the brief",    body: "Tell us about your brand, goals, and style direction. The whole thing takes about 3 minutes." },
  { n: 2, heading: "Pay a 35% deposit",      body: "You only pay 35% upfront to get started. The remaining balance is due when your project is ready." },
  { n: 3, heading: "We get to work",         body: "Your brief lands in our studio and we start designing. We study your brand, competitors, and target audience before touching the pen." },
  { n: 4, heading: "First draft delivery",   body: "You receive your first concept within 5 business days, delivered as a clean presentation with full context and reasoning." },
  { n: 5, heading: "Revisions",              body: "Two rounds of revisions are included. You tell us what to tweak and we refine until it feels exactly right." },
  { n: 6, heading: "Final handoff",          body: "Once you approve, we deliver the full file package in all the formats you need to go live." },
]

const WEBSITE_STEPS = [
  { n: 1, heading: "Share your vision",      body: "Tell us about your business, your audience, and what you need from your website. Pages, goals, and any references you love." },
  { n: 2, heading: "Pay a 35% deposit",      body: "A small upfront deposit secures your spot. The rest is due once your site is approved and ready to launch." },
  { n: 3, heading: "Sitemap and wireframes", body: "We map out the structure and layout of every page before design begins, so there are no surprises later." },
  { n: 4, heading: "Design concepts",        body: "You receive a full design concept within 7 to 14 business days, desktop and mobile, with a walkthrough of every decision." },
  { n: 5, heading: "Revisions and handoff",  body: "Two revision rounds are included. Once approved, we deliver the design files and, if included, the live coded site." },
  { n: 6, heading: "Launch ready",           body: "You walk away with a site that's ready to publish, with all assets, fonts, and documentation included." },
]

export default function ServiceSelection({ onSelect, submitRef, setNextDisabled, initialValue }: Props) {
  const normalized = initialValue === "redesign" ? "design" : (initialValue ?? null)
  const [selected, setSelected] = useState<SelectableService | null>(normalized)
  const hiwRef = useRef<HTMLDivElement>(null)

  const scrollToHiw = (type: SelectableService) => {
    setSelected(type)
    setTimeout(() => hiwRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  useEffect(() => {
    if (submitRef) submitRef.current = selected ? () => onSelect(selected) : null
    setNextDisabled?.(!selected)
  })

  const steps = selected === "website" ? WEBSITE_STEPS : LOGO_STEPS
  const hiwTitle = selected === "website" ? "How Website Design Works" : "How Logo Design Works"
  const hiwNote = selected === "website"
    ? "Not satisfied after included revisions? Only the deposit applies. Additional revisions are available at $30 per round."
    : "Not happy after included revisions? You are free to cancel and only the deposit applies. Extra revision rounds can be added for $15 each."

  return (
    <div className="screen-enter">
      <div className="service-sel__header">
        <div className="service-sel__badge">
          <div className="service-sel__badge-dot" />
          <span className="service-sel__badge-label">Services</span>
        </div>
        <h1 className="service-sel__title">
          What can we help you with?
        </h1>
        <p className="service-sel__subtitle">
          Choose the service that fits your project. Both include the same care and attention to detail.
        </p>
      </div>

      <div className="service-sel__cards">
        <ServiceCard
          title="Logo Design or Redesign"
          description="Start fresh or refresh your existing logo. We craft a complete identity tailored to your brand from the ground up."
          price="150"
          icon={<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="2" y="2" width="32" height="32" rx="8" fill={T.color.accentLight} stroke={T.color.accentMuted} strokeWidth="1.5"/><path d="M18 9v18M9 18h18" stroke={T.color.accent} strokeWidth="2.5" strokeLinecap="round"/><circle cx="18" cy="18" r="4" fill={T.color.accent} opacity="0.3"/></svg>}
          selected={selected === "design"}
          onClick={() => setSelected("design")}
          learnMore="See how this process works"
          onLearnMore={() => scrollToHiw("design")}
        />
        <ServiceCard
          title="Website Design"
          description="A clean, responsive, conversion-focused website built around your brand. From landing pages to full multi-page sites."
          price="400"
          priceLabel="starting at"
          icon={<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="2" y="2" width="32" height="32" rx="8" fill={T.color.accentLight} stroke={T.color.accentMuted} strokeWidth="1.5"/><rect x="7" y="10" width="22" height="16" rx="2" stroke={T.color.accent} strokeWidth="1.8"/><path d="M7 14h22" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round"/><circle cx="10.5" cy="12" r="1" fill={T.color.accent}/><circle cx="13.5" cy="12" r="1" fill={T.color.accent}/><circle cx="16.5" cy="12" r="1" fill={T.color.accent}/></svg>}
          selected={selected === "website"}
          onClick={() => setSelected("website")}
          learnMore="See how this process works"
          onLearnMore={() => scrollToHiw("website")}
        />
      </div>

      {selected && <div className="hiw" ref={hiwRef}>
        <h2 className="hiw__title">{hiwTitle}</h2>
        <div className="hiw__eyebrow">Simple process. No risk. Clear pricing</div>
        <div className="hiw__grid">
          {steps.map(step => (
            <div key={step.n} className="hiw__step">
              <div className="hiw__step-number">{step.n}</div>
              <div className="hiw__step-heading">{step.heading}</div>
              <div className="hiw__step-body">{step.body}</div>
            </div>
          ))}
        </div>
        <div className="hiw__note">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="hiw__note-icon"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          {hiwNote}
        </div>
      </div>}
    </div>
  )
}
