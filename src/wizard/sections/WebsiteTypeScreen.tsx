"use client"
import { useState, useEffect, useRef } from "react"
import BackButton from "../ui/BackButton"
import ServiceCard from "../ui/ServiceCard"
import { T } from "./tokens"
import { FREE_PAGES, PRICE_PER_PAGE, BASE_PRICE } from "./websitePricing"
import type { WebsiteTypeInfo } from "./types"
import "./WebsiteTypeScreen.css"

const ECOMMERCE_DEFAULT_MAIN = ["Home", "Shop", "Product Detail", "Cart", "Checkout", "Order Confirmation", "About", "Contact"]
const ecomExtraCost = ECOMMERCE_DEFAULT_MAIN.filter(p => !FREE_PAGES.has(p)).length * PRICE_PER_PAGE

const INFO = {
  corporate: {
    title: "What is a Corporate Website?",
    body: "A corporate website is the digital home of your business. It establishes credibility, communicates your value proposition, and turns visitors into leads or clients. It's structured around your story, your offerings, and a clear path to getting in touch.",
    bestFor: "Agencies, studios, professional services, startups, and established businesses focused on brand building and lead generation.",
    features: [
      "Contact and inquiry forms",
      "SEO-friendly structure and markup",
      "Social media integration",
      "Google Maps and location info",
      "Analytics and tracking setup",
    ],
  },
  ecommerce: {
    title: "What is an E-commerce Website?",
    body: "An e-commerce website is a full online store where customers browse products, add them to a cart, and complete purchases directly on your site. It's built for selling physical or digital products at scale, with everything from catalog management to a smooth checkout flow.",
    bestFor: "Retail brands, product-based businesses, makers, and anyone selling physical or digital goods online.",
    features: [
      "Product catalog with filtering and search",
      "Shopping cart and secure checkout",
      "Payment gateway integration",
      "Order management and tracking",
      "Customer account area",
    ],
  },
}

const PRICE_BY_TYPE = {
  corporate: BASE_PRICE,
  ecommerce: BASE_PRICE + ecomExtraCost,
}

interface Props {
  onBack: () => void
  onNext: (info: WebsiteTypeInfo) => void
  submitRef?: { current: (() => void) | null }
  setNextDisabled?: (v: boolean) => void
  onPriceChange?: (price: number) => void
  initialValue?: Partial<WebsiteTypeInfo>
}

export default function WebsiteTypeScreen({ onBack, onNext, submitRef, setNextDisabled, onPriceChange, initialValue }: Props) {
  const [siteType, setSiteType] = useState<"corporate" | "ecommerce" | null>(initialValue?.siteType ?? null)
  const infoRef = useRef<HTMLDivElement>(null)

  const selectType = (type: "corporate" | "ecommerce") => {
    setSiteType(type)
    onPriceChange?.(PRICE_BY_TYPE[type])
  }

  const scrollToInfo = (type: "corporate" | "ecommerce") => {
    selectType(type)
    setTimeout(() => infoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  useEffect(() => {
    setNextDisabled?.(!siteType)
    if (submitRef) {
      submitRef.current = siteType ? () => onNext({ siteType }) : null
    }
  })

  const info = siteType ? INFO[siteType] : null

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wt__header">
        <h1 className="wt__title">What kind of website do you need?</h1>
        <p className="wt__subtitle">
          Choose the type that best fits your business. Each follows a different structure, feature set, and build process.
        </p>
      </div>

      <div className="wt__cards">
        <ServiceCard
          title="Corporate Website"
          description="Build credibility, tell your story, and turn visitors into leads or clients."
          icon={<svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="2" y="2" width="32" height="32" rx="8" fill={T.color.accentLight} stroke={T.color.accentMuted} strokeWidth="1.5"/>
            <rect x="10" y="14" width="16" height="14" rx="2" stroke={T.color.accent} strokeWidth="1.8"/>
            <rect x="14" y="8" width="8" height="8" rx="1.5" stroke={T.color.accent} strokeWidth="1.8"/>
            <path d="M15 28v-5h6v5" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>}
          selected={siteType === "corporate"}
          onClick={() => selectType("corporate")}
          learnMore="Learn what is a Corporate Website"
          onLearnMore={() => scrollToInfo("corporate")}
        />
        <ServiceCard
          title="E-commerce Website"
          description="Sell products or services directly from your site with a full store and checkout."
          price={String(ecomExtraCost)}
          pricePre="+"
          priceLabel="in extra pages"
          icon={<svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="2" y="2" width="32" height="32" rx="8" fill={T.color.accentLight} stroke={T.color.accentMuted} strokeWidth="1.5"/>
            <path d="M8 10h3.5l2.5 11h12l2.5-8H14" stroke={T.color.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="25" r="1.5" fill={T.color.accent}/>
            <circle cx="24" cy="25" r="1.5" fill={T.color.accent}/>
          </svg>}
          selected={siteType === "ecommerce"}
          onClick={() => selectType("ecommerce")}
          learnMore="Learn what is an E-commerce Website"
          onLearnMore={() => scrollToInfo("ecommerce")}
        />
      </div>

      {info && (
        <div className="wt__info" ref={infoRef}>
          <div className="wt__info-title">{info.title}</div>
          <p className="wt__info-body">{info.body}</p>
          <div className="wt__info-cols">
            <div className="wt__info-col">
              <div className="wt__info-label">Best for</div>
              <p className="wt__info-text">{info.bestFor}</p>
            </div>
            <div className="wt__info-col">
              <div className="wt__info-label">Typically includes</div>
              <ul className="wt__info-list">
                {info.features.map(f => (
                  <li key={f} className="wt__info-item">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
