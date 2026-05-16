"use client"
import { useState, useEffect, useRef } from "react"
import BackButton from "../ui/BackButton"
import { COLOR_FAMILIES } from "./data"
import { ColorPickerModal, SwatchMenu } from "./ColorPickerScreen"
import type { WebsiteColorsInfo } from "./types"
import "./ColorPickerScreen.css"
import "./WebsiteColorsScreen.css"

interface Props {
  onBack: () => void
  onNext: (info: WebsiteColorsInfo) => void
  submitRef?: { current: (() => void) | null }
  initialValue?: Partial<WebsiteColorsInfo>
  hasExistingUrl?: boolean
  hasLogo?: boolean
}

export default function WebsiteColorsScreen({ onBack, onNext, submitRef, initialValue, hasExistingUrl, hasLogo }: Props) {
  const MAX_COLORS = 5
  const [colorFamilies, setFamilies]         = useState<string[]>(initialValue?.colorFamilies ?? [])
  const [customColors, setCustom]            = useState<string[]>(initialValue?.customColors ?? [])
  const [useExistingWebsite, setUseWebsite]  = useState(initialValue?.useExistingWebsite ?? false)
  const [useExistingLogo, setUseLogo]        = useState(initialValue?.useExistingLogo ?? false)
  const [showPicker, setShowPicker]          = useState(false)
  const [swatchMenu, setSwatchMenu]          = useState<number | null>(null)
  const [editingIndex, setEditingIndex]      = useState<number | null>(null)

  const pickerScrolledRef = useRef(false)

  const toggle = (id: string) =>
    setFamilies(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_COLORS ? prev : [...prev, id])

  useEffect(() => {
    if (submitRef) submitRef.current = () => onNext({ colorFamilies, customColors, useExistingWebsite, useExistingLogo })
  })

  useEffect(() => {
    if (showPicker && window.innerWidth < 1000) {
      window.scrollBy({ top: 100, behavior: "smooth" })
      pickerScrolledRef.current = true
    } else if (!showPicker) {
      pickerScrolledRef.current = false
    }
  }, [showPicker])

  const handleColorAdded = (hex: string) => {
    if (pickerScrolledRef.current && window.innerWidth < 1000) {
      window.scrollBy({ top: -100, behavior: "smooth" })
    }
    if (editingIndex !== null) {
      setCustom(c => c.map((col, i) => i === editingIndex ? hex : col))
      setEditingIndex(null)
    } else {
      setCustom(c => [...c, hex])
    }
    setShowPicker(false)
  }

  const handlePickerClose = () => { setEditingIndex(null); setShowPicker(false) }

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wc__header">
        <h1 className="wc__title">Color direction</h1>
        <p className="wc__subtitle">Pick up to <strong>5 palettes</strong>, add custom hex colors, or both. Leave empty to let the designer choose.</p>
      </div>

      {(hasExistingUrl || hasLogo) && (
        <div className="wc__existing">
          {hasExistingUrl && (
            <div
              onClick={() => setUseWebsite(v => !v)}
              className={`wc__existing-toggle${useExistingWebsite ? " wc__existing-toggle--active" : ""}`}
            >
              <div className={`wc__existing-radio${useExistingWebsite ? " wc__existing-radio--active" : ""}`}>
                {useExistingWebsite && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div className={`wc__existing-label${useExistingWebsite ? " wc__existing-label--active" : ""}`}>Use my existing website&apos;s colors</div>
                <div className="wc__existing-hint">We&apos;ll extract and carry over your current site&apos;s palette</div>
              </div>
            </div>
          )}
          {hasLogo && (
            <div
              onClick={() => setUseLogo(v => !v)}
              className={`wc__existing-toggle${useExistingLogo ? " wc__existing-toggle--active" : ""}`}
            >
              <div className={`wc__existing-radio${useExistingLogo ? " wc__existing-radio--active" : ""}`}>
                {useExistingLogo && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div className={`wc__existing-label${useExistingLogo ? " wc__existing-label--active" : ""}`}>Use my uploaded logo&apos;s colors</div>
                <div className="wc__existing-hint">We&apos;ll pull the palette directly from your logo file</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="wc__custom">
        <div className="wc__custom-label">Custom colors</div>
        <div className="wc__custom-row">
          {customColors.map((hex, i) => (
            <div key={i} className="color-picker__swatch-wrap">
              <div
                className="color-picker__custom-swatch"
                style={{ background: hex }}
                onClick={() => { setSwatchMenu(swatchMenu === i ? null : i); setShowPicker(false); setEditingIndex(null) }}
              />
              {swatchMenu === i && (
                <SwatchMenu
                  onEdit={() => { setSwatchMenu(null); setEditingIndex(i); setShowPicker(true) }}
                  onDelete={() => { setSwatchMenu(null); setCustom(c => c.filter((_, j) => j !== i)) }}
                  onClose={() => setSwatchMenu(null)}
                />
              )}
            </div>
          ))}
          <button onClick={() => { setShowPicker(v => !v); setSwatchMenu(null); setEditingIndex(null) }} className="color-picker__custom-add">+</button>
        </div>
        {showPicker && (
          <ColorPickerModal
            onAdd={handleColorAdded}
            onClose={handlePickerClose}
            initialHex={editingIndex !== null ? customColors[editingIndex] : undefined}
            mode={editingIndex !== null ? "edit" : "add"}
          />
        )}
      </div>

      <div className="color-picker__grid">
        {COLOR_FAMILIES.map((family) => {
          const sel = colorFamilies.includes(family.id)
          const dimmed = colorFamilies.length >= MAX_COLORS && !sel
          return (
            <div
              key={family.id}
              onClick={() => !dimmed && toggle(family.id)}
              className={`color-picker__family-card${sel ? " color-picker__family-card--selected" : ""}${dimmed ? " color-picker__family-card--dimmed" : ""}`}
            >
              {sel && (
                <div className="color-picker__family-check">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l2.5 2.5 5-5" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
              <div className="color-picker__family-swatches">
                {family.colors.map((hex, j) => (
                  <div key={j} className="color-picker__family-swatch" style={{ background: hex }} />
                ))}
              </div>
              <div className="color-picker__family-info">
                <div className="color-picker__family-name">{family.label}</div>
                <div className="color-picker__family-sublabel">{family.sublabel}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
