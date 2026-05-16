"use client"
import { useState, useEffect } from "react"
import BackButton from "../ui/BackButton"
import type { WebsiteExtrasInfo } from "./types"
import "./WebsiteExtrasScreen.css"

const DOMAIN_PRICE      = 40
const HOSTING_PRICE     = 240
const MAINTENANCE_PRICE = 300

function extractDomain(url: string): string {
  if (!url) return ""
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : "https://" + url)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

interface Props {
  onBack:        () => void
  onNext:        (info: WebsiteExtrasInfo) => void
  submitRef?:    { current: (() => void) | null }
  initialValue?: Partial<WebsiteExtrasInfo>
  existingUrl?:  string
  onChange?:     (extrasPrice: number) => void
}

export default function WebsiteExtrasScreen({ onBack, onNext, submitRef, initialValue, existingUrl, onChange }: Props) {
  const prefilled = extractDomain(existingUrl ?? "")

  const [domainMode,      setDomainMode]  = useState<"own" | "new">(initialValue?.domainMode  ?? "own")
  const [domainName,      setDomainName]  = useState(initialValue?.domainName      ?? prefilled)
  const [hostingMode,     setHostingMode] = useState<"own" | "new">(initialValue?.hostingMode ?? "own")
  const [hostingProvider, setProvider]   = useState(initialValue?.hostingProvider  ?? "")
  const [maintenance,     setMaint]      = useState(initialValue?.maintenance      ?? false)

  const extrasPrice =
    (domainMode  === "new" ? DOMAIN_PRICE      : 0) +
    (hostingMode === "new" ? HOSTING_PRICE     : 0) +
    (maintenance           ? MAINTENANCE_PRICE : 0)

  useEffect(() => { onChange?.(extrasPrice) }, [extrasPrice, onChange])

  useEffect(() => {
    if (submitRef) submitRef.current = () => onNext({ domainMode, domainName, hostingMode, hostingProvider, maintenance })
  })

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="we__header">
        <h1 className="we__title">A few last details</h1>
        <p className="we__subtitle">
          Let us know what you already have and what you&apos;d like us to handle. You can always change these later.
        </p>
      </div>

      {/* ── Domain ── */}
      <div className="we__section">
        <div className="we__section-label">Domain</div>

        <div className={`we__option${domainMode === "own" ? " we__option--active" : ""}`} onClick={() => setDomainMode("own")}>
          <div className={`we__radio${domainMode === "own" ? " we__radio--active" : ""}`}>
            {domainMode === "own" && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <span className="we__option-title">I already have a domain</span>
            {domainMode === "own" && (
              <input
                className="we__sub-input"
                placeholder="nikodola.com"
                value={domainName}
                onChange={e => setDomainName(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        <div className={`we__option${domainMode === "new" ? " we__option--active" : ""}`} onClick={() => setDomainMode("new")}>
          <div className={`we__radio${domainMode === "new" ? " we__radio--active" : ""}`}>
            {domainMode === "new" && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <div className="we__option-title-row">
              <span className="we__option-title">Get a domain for me</span>
              <span className="we__price-badge">+${DOMAIN_PRICE} / 2 years</span>
            </div>
            <div className="we__option-hint">We&apos;ll register and connect the domain for you</div>
            {domainMode === "new" && (
              <input
                className="we__sub-input"
                placeholder="What domain name do you want? (optional)"
                value={domainName}
                onChange={e => setDomainName(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Hosting ── */}
      <div className="we__section">
        <div className="we__section-label">Hosting</div>

        <div className={`we__option${hostingMode === "own" ? " we__option--active" : ""}`} onClick={() => setHostingMode("own")}>
          <div className={`we__radio${hostingMode === "own" ? " we__radio--active" : ""}`}>
            {hostingMode === "own" && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <span className="we__option-title">I already have a hosting provider</span>
            {hostingMode === "own" && (
              <input
                className="we__sub-input"
                placeholder="Provider name (optional)"
                value={hostingProvider}
                onChange={e => setProvider(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        <div className={`we__option${hostingMode === "new" ? " we__option--active" : ""}`} onClick={() => setHostingMode("new")}>
          <div className={`we__radio${hostingMode === "new" ? " we__radio--active" : ""}`}>
            {hostingMode === "new" && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <div className="we__option-title-row">
              <span className="we__option-title">Set up hosting for me</span>
              <span className="we__price-badge">+${HOSTING_PRICE} / 2 years</span>
            </div>
            <div className="we__option-hint">Fast, reliable hosting optimized for your site — we handle everything</div>
          </div>
        </div>
      </div>

      {/* ── Maintenance ── */}
      <div className="we__section">
        <div className="we__section-label">Maintenance</div>

        <div className={`we__option${!maintenance ? " we__option--active" : ""}`} onClick={() => setMaint(false)}>
          <div className={`we__radio${!maintenance ? " we__radio--active" : ""}`}>
            {!maintenance && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <span className="we__option-title">No thanks, I&apos;ll manage it myself</span>
          </div>
        </div>

        <div className={`we__option${maintenance ? " we__option--active" : ""}`} onClick={() => setMaint(true)}>
          <div className={`we__radio${maintenance ? " we__radio--active" : ""}`}>
            {maintenance && <div className="we__radio-dot" />}
          </div>
          <div className="we__option-body">
            <div className="we__option-title-row">
              <span className="we__option-title">Include maintenance</span>
              <span className="we__price-badge">+${MAINTENANCE_PRICE} / 2 years</span>
            </div>
            <div className="we__option-hint">Monthly updates, security patches, and performance monitoring</div>
          </div>
        </div>
      </div>
    </div>
  )
}
