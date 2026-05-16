"use client"
import { useState, useEffect } from "react"
import VariationCard from "../ui/VariationCard"
import BackButton from "../ui/BackButton"
import { VerticalLogoDemo, HorizontalLogoDemo, BadgeLogoDemo, IconOnlyDemo, WordmarkDemo } from "./LogoDemos"
import "./VariationsScreen.css"

interface Props { onBack: () => void; onNext: (vars: string[]) => void; onChange?: (vars: string[]) => void; submitRef?: { current: (() => void) | null }; setFormValid?: (valid: boolean) => void; initialValue?: string[] }

const VARIATIONS = [
  { id: "vertical",   title: "Vertical",     slug: "vertical-logo",     description: "Icon stacked above the brand name. Ideal for social profiles and square formats.",      demo: <VerticalLogoDemo /> },
  { id: "horizontal", title: "Horizontal",   slug: "horizontal-logo",   description: "Icon beside the brand name. The most versatile format — great for headers and cards.",  demo: <HorizontalLogoDemo /> },
  { id: "badge",      title: "Badge / Seal", slug: "badge-seal-logo",   description: "Name wraps around the icon in a circular seal. Adds a premium, established feel.",       demo: <BadgeLogoDemo /> },
  { id: "icon",       title: "Icon Only",    slug: "icon-only-logo",    description: "Just the logomark, no text. Used as a standalone symbol across all touchpoints.",         demo: <IconOnlyDemo /> },
  { id: "wordmark",   title: "Wordmark",     slug: "wordmark-logo",     description: "Typography-only logo. The brand name itself becomes the visual identity.",               demo: <WordmarkDemo /> },
]

export default function VariationsScreen({ onBack, onNext, onChange, submitRef, setFormValid, initialValue }: Props) {
  const [selected, setSelected] = useState<string[]>(initialValue ?? [])
  const [error, setError]       = useState(false)

  const isValid = selected.length > 0
  useEffect(() => { setFormValid?.(isValid) }, [isValid, setFormValid])

  useEffect(() => {
    if (submitRef) submitRef.current = () => {
      if (selected.length === 0) { setError(true); return }
      onNext(selected)
    }
  })

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    setSelected(next)
    onChange?.(next)
    if (next.length > 0) setError(false)
  }

  const extraCount  = Math.max(0, selected.length - 1)
  const extrasTotal = extraCount * 25

  const getPriceLabel = (id: string) => {
    if (selected.length === 0) return "1 variation included"
    if (selected[0] === id) return "1 variation included"
    if (selected.includes(id)) return "+$25"
    return "+$25"
  }

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />
      <div className="variations__header">
        <h1 className="variations__title">
          Choose your logo variations
        </h1>
        <p className="variations__subtitle">
          Your first variation is <strong>included free</strong>. Each additional format is <strong>+$25</strong>.
        </p>
      </div>

      <div className="variations__grid">
        {VARIATIONS.map(v => {
          const label  = getPriceLabel(v.id)
          const isFree = label.includes("included")
          return (
            <div key={v.id} className="variations__card-wrap">
              {label && <div className={`variations__price-badge${isFree ? " variations__price-badge--free" : ""}`}>{label}</div>}
              <div className="variations__card-body">
                <VariationCard title={v.title} description={v.description} selected={selected.includes(v.id)} onClick={() => toggle(v.id)}>
                  {v.demo}
                </VariationCard>
              </div>
              <a href={`/blog/${v.slug}`} onClick={e => e.stopPropagation()} className="variations__read-more">
                Read more
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="form-error form-error--with-bottom-margin">
          Please select at least one logo variation to continue.
        </p>
      )}

      {selected.length > 1 && (
        <div className="variations__extras">
          <span className="variations__extras-label">1 included + {extraCount} extra variation{extraCount > 1 ? "s" : ""}</span>
          <span className="variations__extras-total">+${extrasTotal} added</span>
        </div>
      )}

    </div>
  )
}
