"use client"
import { useState, useEffect } from "react"
import TextInput from "../ui/TextInput"
import BackButton from "../ui/BackButton"
import UploadZone from "../ui/UploadZone"
import "./BrandInfoScreen.css"

interface BrandInfo { companyName: string; tagline: string; description: string; logoFile?: File | null }
interface Props {
  onBack: () => void
  onNext: (info: BrandInfo) => void
  submitRef?: { current: (() => void) | null }
  setFormValid?: (valid: boolean) => void
  initialValue?: Partial<Omit<BrandInfo, "logoFile">>
  initialFile?: File | null
}

export default function BrandInfoScreen({ onBack, onNext, submitRef, setFormValid, initialValue, initialFile }: Props) {
  const [companyName, setCompany] = useState(initialValue?.companyName ?? "")
  const [tagline, setTagline]     = useState(initialValue?.tagline ?? "")
  const [description, setDesc]    = useState(initialValue?.description ?? "")
  const [logoFile, setLogoFile]   = useState<File | null>(initialFile ?? null)
  const [error, setError]         = useState(false)

  const isValid = companyName.trim().length > 0
  useEffect(() => { setFormValid?.(isValid) }, [isValid, setFormValid])

  useEffect(() => {
    if (submitRef) submitRef.current = () => {
      if (!companyName.trim()) { setError(true); return }
      onNext({ companyName, tagline, description, logoFile })
    }
  })

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />
      <div className="brand-info__header">
        <h1 className="brand-info__title">
          Tell us about your brand
        </h1>
        <p className="brand-info__subtitle">
          This helps us shape your logo to fit your identity. The more you share, the better the result.
        </p>
      </div>

      <div className="brand-info__fields">
        <TextInput label="Company Name" placeholder="e.g. Apex Studio" value={companyName}
          onChange={v => { setCompany(v); if (v.trim()) setError(false) }} />
        {error && (
          <p className="form-error">
            Please enter your company name to continue.
          </p>
        )}
        <TextInput label="Tagline" placeholder="e.g. Crafting tomorrow's brands" value={tagline} onChange={setTagline} hint="Optional" />
      </div>

      <div className="brand-info__desc-block">
        <label className="brand-info__desc-label">
          About your company
          <span className="brand-info__desc-label-badge">Recommended</span>
        </label>
        <p className="brand-info__desc-hint">
          Tell us what you do, who your audience is, your values, and the feeling you want your logo to convey.
        </p>
        <textarea value={description} onChange={e => setDesc(e.target.value)} rows={5}
          placeholder="e.g. We're a boutique creative studio focused on sustainable brands..."
          className="brand-info__textarea"
        />
      </div>

      <div className="brand-info__upload-block">
        <label className="brand-info__desc-label">
          Existing Logo
          <span className="brand-info__desc-label-badge">Optional</span>
        </label>
        <p className="brand-info__desc-hint">
          Have a current logo you want redesigned? Upload it and we&apos;ll use it as a reference.
        </p>
        <UploadZone file={logoFile} onFile={setLogoFile} />
      </div>
    </div>
  )
}
