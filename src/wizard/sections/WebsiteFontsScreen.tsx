"use client"
import { useState, useEffect } from "react"
import BackButton from "../ui/BackButton"
import TextInput from "../ui/TextInput"
import { FONT_CATEGORIES } from "./data"
import { FontCard } from "./TypographyScreen"
import type { WebsiteFontsInfo, FontDef } from "./types"
import "./TypographyScreen.css"
import "./WebsiteFontsScreen.css"

interface FontAsset extends FontDef { category: string; embedParam: string }

interface Props {
  onBack: () => void
  onNext: (info: WebsiteFontsInfo) => void
  submitRef?: { current: (() => void) | null }
  initialValue?: Partial<WebsiteFontsInfo>
}

export default function WebsiteFontsScreen({ onBack, onNext, submitRef, initialValue }: Props) {
  const MAX_FONTS = 10
  const BATCH     = 9

  const [mode, setMode]                     = useState<"designer" | "collection">(initialValue?.mode ?? "designer")
  const [selectedFonts, setSelectedFonts]   = useState<string[]>(initialValue?.selectedFonts ?? [])
  const [fontLinks, setFontLinks]           = useState<string[]>(initialValue?.fontLinks?.length ? initialValue.fontLinks : [""])
  const [activeCategory, setActiveCategory] = useState("sans")
  const [visibleCount, setVisible]          = useState(BATCH)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [fontAssets, setFontAssets]         = useState<FontAsset[]>([])

  const assetCategories: Record<string, { label: string; fonts: FontDef[] }> = fontAssets.length > 0
    ? fontAssets.reduce<Record<string, { label: string; fonts: FontDef[] }>>((acc, f) => {
        const cat = f.category || "sans"
        if (!acc[cat]) acc[cat] = { label: cat === "serif" ? "Serif" : cat === "handwriting" ? "Handwriting" : "Sans-Serif", fonts: [] }
        acc[cat].fonts.push(f)
        return acc
      }, {})
    : FONT_CATEGORIES

  const currentFonts = assetCategories[activeCategory]?.fonts ?? []
  const visibleFonts = currentFonts.slice(0, visibleCount)
  const hasMore      = visibleCount < currentFonts.length

  useEffect(() => {
    fetch("/company-assets/fonts.json")
      .then(r => r.json())
      .then((data: FontAsset[]) => {
        if (!data?.length) return
        setFontAssets(data)
        const url = "https://fonts.googleapis.com/css2?" + data.map(f => `family=${f.embedParam}`).join("&") + "&display=swap"
        if (!document.getElementById("wf-gfonts")) {
          const link = document.createElement("link")
          link.id = "wf-gfonts"; link.rel = "stylesheet"; link.href = url
          document.head.appendChild(link)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { setVisible(BATCH) }, [activeCategory])

  useEffect(() => {
    if (submitRef) submitRef.current = () => onNext({
      mode,
      selectedFonts,
      fontLinks: fontLinks.filter(l => l.trim()),
    })
  })

  const toggleFont = (id: string) =>
    setSelectedFonts(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_FONTS ? prev : [...prev, id])

  const updateLink = (i: number, val: string) => setFontLinks(prev => prev.map((l, j) => j === i ? val : l))
  const addLink    = () => setFontLinks(prev => [...prev, ""])
  const removeLink = (i: number) => setFontLinks(prev => prev.filter((_, j) => j !== i))

  const FONT_TABS = Object.entries(assetCategories).map(([key, cat]) => ({ key, label: cat.label }))

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wf__header">
        <h1 className="wf__title">Fonts</h1>
        <p className="wf__subtitle">Let the designer choose the perfect typefaces, or browse and pick from our curated collection.</p>
      </div>

      <div className="typography__mode-tabs">
        <button
          onClick={() => setMode("designer")}
          className={`typography__mode-tab${mode === "designer" ? " typography__mode-tab--active" : ""}`}
        >
          Let the designer choose
        </button>
        <button
          onClick={() => setMode("collection")}
          className={`typography__mode-tab${mode === "collection" ? " typography__mode-tab--active" : ""}`}
        >
          I&apos;ll pick my own fonts
        </button>
      </div>

      {mode === "designer" ? (
        <div className="typography__designer-message">
          <div className="typography__designer-message-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 4l2.2 6.7H23l-5.6 4.1 2.1 6.6L14 17.3l-5.5 4.1 2.1-6.6L5 10.7h6.8L14 4z" fill="var(--color-accent)" opacity="0.25"/>
              <path d="M14 6l1.8 5.5H22l-5 3.6 1.9 5.8L14 17l-4.9 3.9 1.9-5.8-5-3.6h6.2L14 6z" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="typography__designer-message-body">
            <div className="typography__designer-message-title">We&apos;ll handle the typography</div>
            <p className="typography__designer-message-text">
              Our designer will study your brand, style direction, and audience to choose typefaces that fit perfectly.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="typography__font-links">
            <div className="typography__font-links-label">
              Font references <span className="typography__upload-label-opt">Optional</span>
            </div>
            <div className="typography__font-links-hint">
              Have a font you love? Paste the link and we&apos;ll use it as a reference — Google Fonts, Adobe Fonts, or anywhere else.
            </div>
            <div className="typography__font-links-list">
              {fontLinks.map((link, i) => (
                <div key={i} className="typography__font-link-row">
                  <TextInput
                    label=""
                    placeholder="https://fonts.google.com/specimen/Inter"
                    value={link}
                    onChange={val => updateLink(i, val)}
                  />
                  {fontLinks.length > 1 && (
                    <button onClick={() => removeLink(i)} className="typography__font-link-remove" aria-label="Remove link">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLink} className="typography__font-link-add">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Add another font link
            </button>
          </div>

          <div className="typography__browse-section">
            <div className="typography__tabs">
              {FONT_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveCategory(tab.key)}
                  className={`typography__tab${activeCategory === tab.key ? " typography__tab--active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {selectedFonts.length > 0 && (
              <div className="typography__selection-bar">
                <div className="typography__selection-badge">{selectedFonts.length} / {MAX_FONTS} selected</div>
              </div>
            )}
            <div className="typography__font-grid">
              {visibleFonts.map((font, i) => (
                <FontCard
                  key={font.id}
                  font={font}
                  selected={selectedFonts.includes(font.id)}
                  onClick={() => toggleFont(font.id)}
                  index={i}
                  dimmed={selectedFonts.length >= MAX_FONTS && !selectedFonts.includes(font.id)}
                />
              ))}
              {loadingMore && [...Array(BATCH)].map((_, i) => <div key={"sk" + i} className="skeleton skeleton--font-card" />)}
            </div>
            {hasMore && !loadingMore && (
              <div className="typography__load-more">
                <button
                  onClick={() => {
                    setLoadingMore(true)
                    setTimeout(() => { setVisible(v => Math.min(v + BATCH, currentFonts.length)); setLoadingMore(false) }, 700)
                  }}
                  className="typography__load-more-btn"
                >
                  Load more fonts
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
