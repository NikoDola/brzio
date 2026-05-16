"use client"
import { useState, useEffect, useRef } from "react"
import StyleCard from "../ui/StyleCard"
import BackButton from "../ui/BackButton"
import TextInput from "../ui/TextInput"
import { STYLE_PRESETS } from "./data"
import "./StylePickerScreen.css"

interface StyleInfo { styles: string[]; pinterestUrl: string; inspirationFile: File | null }
interface Props { onBack: () => void; onNext: (info: StyleInfo) => void; submitRef?: { current: (() => void) | null }; initialValue?: { styles: string[]; pinterestUrl: string } }

interface LogoAsset {
  id: string; url: string; title: string; designer: string; displayInStyleScreen: boolean
  age: string; materialism: string; formStyle: string; obviousAbstract: string
  negativeSpace: string; era: string; gender: string; colorCount: string; logoType: string; complexity: string
}

function deriveTags(logo: LogoAsset): string[] {
  const t: string[] = []
  if (logo.logoType && logo.logoType !== "Logo") t.push(logo.logoType)
  if (logo.age === "youthful")             t.push("Youthful")
  if (logo.age === "mature")               t.push("Mature")
  if (logo.materialism === "luxury")       t.push("Luxury")
  if (logo.materialism === "economical")   t.push("Budget-friendly")
  if (logo.formStyle === "geometric")      t.push("Geometric")
  if (logo.formStyle === "organic")        t.push("Organic")
  if (logo.obviousAbstract === "obvious")  t.push("Obvious")
  if (logo.obviousAbstract === "abstract") t.push("Abstract")
  if (logo.negativeSpace === "yes")        t.push("Neg. Space")
  if (logo.era === "vintage")              t.push("Vintage")
  if (logo.gender === "manly")             t.push("Masculine")
  if (logo.gender === "feminine")          t.push("Feminine")
  if (logo.colorCount === "1 color")       t.push("Mono")
  if (logo.colorCount === "4+ colors")     t.push("Colorful")
  if (logo.complexity === "minimal")       t.push("Minimal")
  if (logo.complexity === "complex")       t.push("Complex")
  return t
}

function LogoStyleCard({ logo, selected, onClick, dimmed }: { logo: LogoAsset; selected: boolean; onClick: () => void; dimmed: boolean }) {
  const tags = deriveTags(logo)
  return (
    <div
      onClick={onClick}
      className={`logo-style-card${selected ? " logo-style-card--selected" : ""}${dimmed ? " logo-style-card--dimmed" : ""}`}
    >
      {selected && (
        <div className="logo-style-card__check">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div className="logo-style-card__img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.url} alt={logo.title} className="logo-style-card__img" />
      </div>
      <div className="logo-style-card__body">
        {logo.title && <div className="logo-style-card__title">{logo.title}</div>}
        {tags.length > 0 && (
          <div className="logo-style-card__tags">
            {tags.map(tag => <span key={tag} className="logo-style-card__tag">{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

const MAX_SELECT  = 6
const BATCH_SIZE  = 6
const LOGO_BATCH  = 9

const ALL_PRESETS = [
  ...STYLE_PRESETS,
  ...STYLE_PRESETS.map(p => ({ ...p, id: `${p.id}-2` })),
  ...STYLE_PRESETS.map(p => ({ ...p, id: `${p.id}-3` })),
]

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spinner">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="20 14" opacity="0.6"/>
    </svg>
  )
}

export default function StylePickerScreen({ onBack, onNext, submitRef, initialValue }: Props) {
  const [selected, setSelected]               = useState<string[]>(initialValue?.styles ?? [])
  const [pinterestUrl, setPinterestUrl]       = useState(initialValue?.pinterestUrl ?? "")
  const [inspirationFile, setInspirationFile] = useState<File | null>(null)
  const [dragging, setDragging]               = useState(false)
  const [loadingFirst, setLoadingFirst]       = useState(true)
  const [loadingMore, setLoadingMore]         = useState(false)
  const [visibleCount, setVisibleCount]       = useState(BATCH_SIZE)
  const [logoAssets, setLogoAssets]           = useState<LogoAsset[]>([])
  const fileInputRef                          = useRef<HTMLInputElement>(null)
  const logoAssetsRef                         = useRef<LogoAsset[]>([])

  useEffect(() => {
    if (submitRef) submitRef.current = () => onNext({ styles: selected, pinterestUrl, inspirationFile })
  })

  useEffect(() => {
    fetch("/company-assets/logos.json")
      .then(r => r.json())
      .then((data: LogoAsset[]) => {
        const visible = (data || []).filter(l => l.displayInStyleScreen)
        logoAssetsRef.current = visible
        if (visible.length > 0) setVisibleCount(LOGO_BATCH)
        setLogoAssets(visible)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setLoadingFirst(false), 900)
    return () => clearTimeout(t)
  }, [])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_SELECT) return prev
      return [...prev, id]
    })
  }

  const useLogos = logoAssets.length > 0
  const sourceItems = useLogos ? logoAssets : ALL_PRESETS
  const visiblePresets = sourceItems.slice(0, visibleCount)
  const hasMore = visibleCount < sourceItems.length

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />
      <div className="style-picker__header">
        <h1 className="style-picker__title">
          Choose a design style
        </h1>
        <p className="style-picker__subtitle">
          Pick up to <strong>6 styles</strong> that feel right for your brand, share a Pinterest board, or drop an inspiration file. This step is entirely optional — skip ahead if you&apos;d rather let us lead.
        </p>
      </div>

      <div className="style-picker__inspiration">
        <div className="style-picker__inspiration-pinterest">
          <div className="style-picker__inspiration-pinterest-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.23-5.22 1.23-5.22s-.31-.63-.31-1.56c0-1.46.85-2.55 1.9-2.55.9 0 1.33.67 1.33 1.48 0 .9-.57 2.25-.87 3.5-.25 1.04.52 1.89 1.54 1.89 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.34-4.23-2.96 0-4.69 2.22-4.69 4.51 0 .89.34 1.85.77 2.37.08.1.09.19.07.29-.08.32-.25 1.04-.28 1.18-.04.19-.14.23-.32.14-1.25-.58-2.03-2.42-2.03-3.89 0-3.15 2.29-6.05 6.6-6.05 3.46 0 6.15 2.47 6.15 5.77 0 3.44-2.17 6.21-5.18 6.21-1.01 0-1.96-.53-2.29-1.15l-.62 2.33c-.22.86-.83 1.94-1.24 2.59.94.29 1.93.45 2.96.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#E60023"/>
            </svg>
          </div>
          <div className="style-picker__inspiration-pinterest-body">
            <div className="style-picker__inspiration-pinterest-label">Share a Pinterest board</div>
            <div className="style-picker__inspiration-pinterest-hint">Paste the link to a board filled with brands, logos, or visuals that inspire you</div>
          </div>
        </div>
        <TextInput
          label=""
          placeholder="https://pinterest.com/yourboard/logo-inspiration"
          value={pinterestUrl}
          onChange={setPinterestUrl}
          hint="Optional"
        />
        <div className="style-picker__inspiration-divider">
          <span>or upload inspiration files</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
          style={{ display: "none" }}
          onChange={e => e.target.files?.[0] && setInspirationFile(e.target.files[0])}
        />
        <div
          className={`style-picker__dropzone${dragging ? " style-picker__dropzone--dragging" : ""}${inspirationFile ? " style-picker__dropzone--filled" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setInspirationFile(f) }}
        >
          {inspirationFile ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v10M5 8l4 4 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="14" width="14" height="2" rx="1" fill="#fff"/></svg>
              <div>
                <div className="style-picker__dropzone-filename">{inspirationFile.name}</div>
                <div className="style-picker__dropzone-replace">Click to replace</div>
              </div>
              <button
                className="style-picker__dropzone-remove"
                onClick={e => { e.stopPropagation(); setInspirationFile(null) }}
                aria-label="Remove file"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 12V2M5 6l4-4 4 4" stroke="var(--color-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="14" width="14" height="2" rx="1" fill="var(--color-border)"/></svg>
              <div>
                <span className="style-picker__dropzone-heading">Drop a file or click to browse</span>
                <span className="style-picker__dropzone-formats"> · JPG, PNG, PDF</span>
              </div>
            </>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="style-picker__selection-bar">
          <div className="style-picker__selection-badge">
            {selected.length} / {MAX_SELECT} selected
          </div>
          {selected.length >= MAX_SELECT && <span className="style-picker__selection-max">Maximum reached</span>}
        </div>
      )}

      <div className="style-picker__grid">
        {loadingFirst
          ? [...Array(BATCH_SIZE)].map((_, i) => <div key={i} className="skeleton skeleton--logo-card" />)
          : useLogos
            ? visiblePresets.map(s => {
                const logo = s as LogoAsset
                return (
                  <LogoStyleCard key={logo.id} logo={logo} selected={selected.includes(logo.id)}
                    onClick={() => toggleSelect(logo.id)} dimmed={selected.length >= MAX_SELECT && !selected.includes(logo.id)} />
                )
              })
            : visiblePresets.map((s, i) => {
                const preset = s as typeof ALL_PRESETS[number]
                return (
                  <StyleCard key={preset.id} label={preset.label} sublabel={preset.sublabel} selected={selected.includes(preset.id)}
                    onClick={() => toggleSelect(preset.id)} index={i} dimmed={selected.length >= MAX_SELECT && !selected.includes(preset.id)}>
                    {preset.preview("var(--color-accent)")}
                  </StyleCard>
                )
              })
        }
        {loadingMore && [...Array(BATCH_SIZE)].map((_, i) => <div key={"m"+i} className="skeleton skeleton--logo-card" />)}
      </div>

      {!loadingFirst && hasMore && (
        <div className="style-picker__load-more">
          <button
            onClick={() => {
              if (loadingMore) return
              setLoadingMore(true)
              setTimeout(() => {
                const logos = logoAssetsRef.current
                const batch = logos.length > 0 ? LOGO_BATCH : BATCH_SIZE
                const total = logos.length > 0 ? logos.length : ALL_PRESETS.length
                setVisibleCount(c => Math.min(c + batch, total))
                setLoadingMore(false)
              }, 800)
            }}
            className={`style-picker__load-more-btn${loadingMore ? " style-picker__load-more-btn--loading" : ""}`}
          >
            {loadingMore ? <><Spinner /> Loading...</> : <>Load more styles</>}
          </button>
        </div>
      )}

      <div className="style-picker__footer">
        <span className="style-picker__footer-label">
          {selected.length === 0 && !pinterestUrl && !inspirationFile ? "Choose styles or share your inspiration" : `${selected.length} style${selected.length !== 1 ? "s" : ""} selected${inspirationFile ? " · 1 file" : ""}${pinterestUrl ? " · Pinterest added" : ""}`}
        </span>
      </div>
    </div>
  )
}
