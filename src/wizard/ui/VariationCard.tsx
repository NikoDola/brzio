"use client"
import "./VariationCard.css"

interface VariationCardProps {
  title:       string
  description: string
  selected:    boolean
  onClick:     () => void
  children:    React.ReactNode
}

export default function VariationCard({ title, description, selected, onClick, children }: VariationCardProps) {
  return (
    <div
      onClick={onClick}
      className={`variation-card ${selected ? "variation-card--selected" : ""}`}
    >
      {selected && (
        <div className="variation-card__check">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div className="variation-card__preview">
        {children}
      </div>
      <div className="variation-card__text">
        <div className="variation-card__title">{title}</div>
        <div className="variation-card__description">{description}</div>
      </div>
    </div>
  )
}
