"use client"
import { useState, useEffect, useRef } from "react"
import BackButton from "../ui/BackButton"
import type { WebsiteStyleInfo } from "./types"
import "./WebsiteStyleScreen.css"

interface Props {
  onBack: () => void
  onNext: (info: WebsiteStyleInfo) => void
  submitRef?: { current: (() => void) | null }
  initialValue?: Partial<WebsiteStyleInfo>
}

function isValidUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t || /\s/.test(t)) return false
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t)
    const parts = url.hostname.split(".")
    return parts.length >= 2 && parts[parts.length - 1].length >= 2
  } catch {
    return false
  }
}

export default function WebsiteStyleScreen({ onBack, onNext, submitRef, initialValue }: Props) {
  const [links,      setLinks]    = useState<string[]>(initialValue?.links  ?? [])
  const [images,     setImages]   = useState<File[]>(initialValue?.images ?? [])
  const [input,      setInput]    = useState("")
  const [inputError, setInputError] = useState("")
  const [dragging,   setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLink = () => {
    const t = input.trim()
    if (!t) return
    if (!isValidUrl(t)) { setInputError("Please enter a valid URL, e.g. nikodola.com"); return }
    if (links.includes(t)) { setInputError("This link has already been added"); return }
    setLinks(prev => [...prev, t])
    setInput("")
    setInputError("")
  }

  const removeLink  = (i: number) => setLinks(prev => prev.filter((_, j) => j !== i))
  const removeImage = (i: number) => setImages(prev => prev.filter((_, j) => j !== i))

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"))
    setImages(prev => [...prev, ...imgs])
  }

  useEffect(() => {
    if (submitRef) submitRef.current = () => onNext({ links, images })
  })

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wst__header">
        <h1 className="wst__title">Style references</h1>
        <p className="wst__subtitle">
          Share links to websites you love or pages from competitors, and upload any images that inspire you.
        </p>
      </div>

      {/* ── Links ── */}
      <div className="wst__label">
        Inspiration & competitor links
        <span className="wst__optional">Optional</span>
      </div>

      {links.length > 0 && (
        <div className="wst__links">
          {links.map((link, i) => (
            <div key={i} className="wst__link-row">
              <svg className="wst__link-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1.5 7h11M7 1.5a8.5 8.5 0 0 1 0 11M7 1.5a8.5 8.5 0 0 0 0 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="wst__link-text">{link}</span>
              <button className="wst__link-remove" onClick={() => removeLink(i)} aria-label="Remove">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="wst__add-row">
        <input
          className={`wst__input${inputError ? " wst__input--error" : ""}`}
          placeholder="nikodola.com or https://example.com"
          value={input}
          onChange={e => { setInput(e.target.value); setInputError("") }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink() } }}
        />
        <button className="wst__add-btn" onClick={addLink} aria-label="Add link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {inputError && <p className="wst__input-error">{inputError}</p>}

      {/* ── Images ── */}
      <div className="wst__label wst__label--images">
        Inspiration images
        <span className="wst__optional">Optional</span>
      </div>

      {images.length > 0 && (
        <div className="wst__thumbnails">
          {images.map((file, i) => (
            <div key={i} className="wst__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="wst__thumb-img"
              />
              <button className="wst__thumb-remove" onClick={() => removeImage(i)} aria-label="Remove image">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`wst__drop-zone${dragging ? " wst__drop-zone--dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={e => addFiles(e.target.files)}
        />
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="wst__drop-icon">
          <rect x="1" y="1" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 7v8M7 11h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span className="wst__drop-text">Drop images here or click to browse</span>
        <span className="wst__drop-formats">JPG · PNG · GIF · WEBP</span>
      </div>
    </div>
  )
}
