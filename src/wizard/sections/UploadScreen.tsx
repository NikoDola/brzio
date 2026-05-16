"use client"
import { useState, useEffect } from "react"
import TextInput from "../ui/TextInput"
import UploadZone from "../ui/UploadZone"
import BackButton from "../ui/BackButton"
import "./UploadScreen.css"

interface UploadInfo { companyName: string; tagline: string; description: string; file: File | null }
interface Props { onBack: () => void; onNext: (info: UploadInfo) => void; submitRef?: { current: (() => void) | null }; setFormValid?: (valid: boolean) => void; initialValue?: Partial<Omit<UploadInfo, "file">>; initialFile?: File | null }

export default function UploadScreen({ onBack, onNext, submitRef, setFormValid, initialValue, initialFile }: Props) {
  const [companyName, setCompany] = useState(initialValue?.companyName ?? "")
  const [tagline, setTagline]     = useState(initialValue?.tagline ?? "")
  const [description, setDesc]    = useState(initialValue?.description ?? "")
  const [file, setFile]           = useState<File | null>(initialFile ?? null)
  const [nameError, setNameError] = useState(false)
  const [fileError, setFileError] = useState(false)

  const isValid = companyName.trim().length > 0 && file !== null
  useEffect(() => { setFormValid?.(isValid) }, [isValid, setFormValid])

  useEffect(() => {
    if (submitRef) submitRef.current = () => {
      const nameInvalid = !companyName.trim()
      const fileInvalid = !file
      if (nameInvalid || fileInvalid) {
        setNameError(nameInvalid)
        setFileError(fileInvalid)
        return
      }
      onNext({ companyName, tagline, description, file })
    }
  })

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />
      <div className="upload__header">
        <h1 className="upload__title">
          Tell us about your brand
        </h1>
        <p className="upload__subtitle">
          Share a few details about your company so we understand what we&apos;re working with before we begin.
        </p>
      </div>

      <div className="upload__fields">
        <TextInput label="Company Name" placeholder="e.g. Apex Studio" value={companyName}
          onChange={v => { setCompany(v); if (v.trim()) setNameError(false) }} />
        {nameError && <p className="form-error">Please enter your company name to continue.</p>}
        <TextInput label="Tagline" placeholder="e.g. Crafting tomorrow's brands" value={tagline} onChange={setTagline} hint="Optional" />
      </div>

      <div className="upload__desc-block">
        <label className="upload__desc-label">
          About your company
          <span className="upload__desc-label-badge">Recommended</span>
        </label>
        <p className="upload__desc-hint">
          Tell us what you do, who your audience is, your values, and the feeling you want your logo to convey.
        </p>
        <textarea
          value={description}
          onChange={e => setDesc(e.target.value)}
          rows={5}
          placeholder="e.g. We're a boutique creative studio focused on sustainable brands..."
          className="upload__textarea"
        />
      </div>

      <div className="upload__zone-block">
        <div className="upload__zone-label">Current Logo</div>
        <UploadZone file={file} onFile={f => { setFile(f); if (f) setFileError(false) }} />
        {fileError && <p className="form-error">Please upload your current logo to continue.</p>}
      </div>

      <div className="upload__tips">
        {[
          ["Preferred", "SVG, AI, EPS, PDF — vector formats give the best results"],
          ["Accepted",  "JPG, PNG — raster files work too; higher resolution is better"],
        ].map(([label, tip]) => (
          <div key={label} className="upload__tip">
            <div className="upload__tip-label">✦ {label}</div>
            <div className="upload__tip-text">{tip}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
