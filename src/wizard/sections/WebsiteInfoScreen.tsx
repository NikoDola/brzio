"use client"
import { useState, useEffect } from "react"
import BackButton from "../ui/BackButton"
import TextInput from "../ui/TextInput"
import UploadZone from "../ui/UploadZone"
import type { WebsiteInfo } from "./types"
import "./WebsiteInfoScreen.css"

const INDUSTRIES = [
  "Architecture & Construction",
  "Automotive",
  "Beauty & Cosmetics",
  "Education",
  "Entertainment & Media",
  "Fashion & Apparel",
  "Finance & Banking",
  "Fitness & Wellness",
  "Food & Beverage",
  "Healthcare & Medical",
  "Hospitality & Travel",
  "Legal & Law",
  "Marketing & Advertising",
  "Non-profit & NGO",
  "Photography & Film",
  "Professional Services",
  "Real Estate",
  "Retail & E-commerce",
  "Technology & Software",
  "Other",
]

interface Props {
  onBack: () => void
  onNext: (info: WebsiteInfo) => void
  submitRef?: { current: (() => void) | null }
  setFormValid?: (valid: boolean) => void
  initialValue?: Partial<WebsiteInfo>
  initialFile?: File | null
}

export default function WebsiteInfoScreen({ onBack, onNext, submitRef, setFormValid, initialValue, initialFile }: Props) {
  const [companyName, setCompany]   = useState(initialValue?.companyName ?? "")
  const [existingUrl, setUrl]       = useState(initialValue?.existingUrl ?? "")
  const [industry, setIndustry]     = useState(initialValue?.industry ?? "")
  const [description, setDesc]      = useState(initialValue?.description ?? "")
  const [logoFile, setLogoFile]     = useState<File | null>(initialFile ?? null)
  const [error, setError]           = useState(false)

  const isValid = companyName.trim().length > 0
  useEffect(() => { setFormValid?.(isValid) }, [isValid, setFormValid])

  useEffect(() => {
    if (!submitRef) return
    submitRef.current = () => {
      if (!companyName.trim()) { setError(true); return }
      onNext({ companyName, existingUrl: existingUrl || undefined, industry: industry || undefined, description: description || undefined, logoFile })
    }
  })

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wi__header">
        <h1 className="wi__title">Tell us about your website</h1>
        <p className="wi__subtitle">
          A little context goes a long way. The more you share, the better we can tailor the design to your brand.
        </p>
      </div>

      <div className="wi__form">

        {/* Company name */}
        <div className="wi__field">
          <TextInput
            label="Company Name"
            placeholder="e.g. Apex Studio"
            value={companyName}
            onChange={v => { setCompany(v); if (v.trim()) setError(false) }}
          />
          {error && <p className="form-error">Please enter your company name to continue.</p>}
        </div>

        {/* Existing website URL */}
        <div className="wi__field">
          <TextInput
            label="Existing Website"
            placeholder="e.g. https://yoursite.com"
            value={existingUrl}
            onChange={setUrl}
            hint="Optional — enter the URL if you have a current site that needs a rebuild or redesign"
          />
        </div>

        {/* Industry */}
        <div className="wi__field">
          <label className="wi__field-label">
            Industry
            <span className="wi__field-badge">Optional</span>
          </label>
          <div className="wi__select-wrap">
            <select className="wi__select" value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select an industry</option>
              {INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            <svg className="wi__select-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Description */}
        <div className="wi__field">
          <label className="wi__field-label">
            About your business
            <span className="wi__field-badge wi__field-badge--accent">Recommended</span>
          </label>
          <p className="wi__field-hint">
            Tell us what your business does, who your audience is, and what you want visitors to feel or do on your site.
          </p>
          <textarea
            className="wi__textarea"
            value={description}
            onChange={e => setDesc(e.target.value)}
            rows={5}
            placeholder="e.g. We're a boutique fitness studio targeting young professionals. We want the site to feel energetic, modern, and make it easy to book a class..."
          />
        </div>

        {/* Logo upload */}
        <div className="wi__field">
          <label className="wi__field-label">
            Existing Logo
            <span className="wi__field-badge">Optional</span>
          </label>
          <p className="wi__field-hint">
            Have a logo already? Upload it and we&apos;ll incorporate it into the design.
            Preferred formats: AI · SVG · PDF · EPS
          </p>
          <UploadZone file={logoFile} onFile={setLogoFile} />
        </div>

      </div>
    </div>
  )
}
