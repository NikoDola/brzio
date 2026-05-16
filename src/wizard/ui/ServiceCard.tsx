"use client"
import "./ServiceCard.css"

interface ServiceCardProps {
  title:        string
  description:  string
  price?:       string
  pricePre?:    string
  priceLabel?:  string
  icon:         React.ReactNode
  selected:     boolean
  onClick:      () => void
  badge?:       string
  learnMore?:   string
  onLearnMore?: (e: React.MouseEvent) => void
}

export default function ServiceCard({ title, description, price, pricePre, priceLabel = "flat rate", icon, selected, onClick, badge, learnMore, onLearnMore }: ServiceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`service-card ${selected ? "service-card--selected" : ""}`}
    >
      {selected && (
        <div className="service-card__check">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {badge && (
        <div className="service-card__badge">{badge}</div>
      )}
      <div className="service-card__icon">{icon}</div>
      <div className="service-card__title">{title}</div>
      <div className="service-card__description">{description}</div>
      {price && (
        <div className="service-card__price">
          <span className="service-card__price-amount">{pricePre}${price}</span>
          <span className="service-card__price-label">{priceLabel}</span>
        </div>
      )}
      {learnMore && (
        <button
          className="service-card__learn-more"
          onClick={e => { e.stopPropagation(); onLearnMore?.(e) }}
        >
          {learnMore}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}
