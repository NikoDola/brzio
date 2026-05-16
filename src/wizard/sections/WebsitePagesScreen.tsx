"use client"
import { useState, useEffect, useMemo } from "react"
import BackButton from "../ui/BackButton"
import { calcWebsitePrice } from "./websitePricing"
import { FREE_PAGES, PRICE_PER_PAGE } from "./websitePricing"
import type { WebsitePagesInfo } from "./types"
import "./WebsitePagesScreen.css"

interface PageDef { name: string; main?: boolean }

const CORPORATE_PAGES: PageDef[] = [
  { name: "Home",             main: true },
  { name: "About",            main: true },
  { name: "Services",         main: true },
  { name: "Showcase",         main: true },
  { name: "Contact",          main: true },
  { name: "Blog" },
  { name: "Team" },
  { name: "Testimonials" },
  { name: "Pricing" },
  { name: "FAQ" },
  { name: "Case Studies" },
  { name: "News & Updates" },
  { name: "Careers" },
  { name: "Partners" },
  { name: "Press / Media" },
  { name: "Awards" },
  { name: "Mission & Values" },
  { name: "Our Process" },
  { name: "Resources" },
  { name: "Events" },
  { name: "Privacy Policy" },
  { name: "Terms of Service" },
  { name: "Cookie Policy" },
  { name: "Sitemap" },
  { name: "404 Not Found" },
]

const ECOMMERCE_PAGES: PageDef[] = [
  { name: "Home",               main: true },
  { name: "Shop",               main: true },
  { name: "Product Detail",     main: true },
  { name: "Cart",               main: true },
  { name: "Checkout",           main: true },
  { name: "Order Confirmation", main: true },
  { name: "About",              main: true },
  { name: "Contact",            main: true },
  { name: "Login" },
  { name: "Sign Up" },
  { name: "My Account" },
  { name: "My Orders" },
  { name: "Order Tracking" },
  { name: "Wishlist" },
  { name: "Saved Addresses" },
  { name: "Payment Methods" },
  { name: "Account Settings" },
  { name: "Category Pages" },
  { name: "Search Results" },
  { name: "New Arrivals" },
  { name: "Best Sellers" },
  { name: "Sale" },
  { name: "Featured Products" },
  { name: "Recently Viewed" },
  { name: "Product Comparison" },
  { name: "FAQ" },
  { name: "Shipping & Delivery" },
  { name: "Returns & Refunds" },
  { name: "Size Guide" },
  { name: "Gift Cards" },
  { name: "Loyalty Program" },
  { name: "Blog" },
  { name: "Lookbook" },
  { name: "Brand Story" },
  { name: "Sustainability" },
  { name: "Press / Media" },
  { name: "Careers" },
  { name: "Affiliate Program" },
  { name: "Wholesale / B2B" },
  { name: "Newsletter Signup" },
  { name: "Store Locator" },
  { name: "Events & Promotions" },
  { name: "Live Chat / Support" },
  { name: "Privacy Policy" },
  { name: "Terms & Conditions" },
  { name: "Cookie Policy" },
  { name: "Accessibility Statement" },
  { name: "404 Not Found" },
  { name: "Sitemap" },
  { name: "Thank You" },
]

interface ChipProps {
  name:      string
  on:        boolean
  removable?: boolean
  onToggle:  () => void
  onRemove:  () => void
}

function Chip({ name, on, removable, onToggle, onRemove }: ChipProps) {
  return (
    <button
      className={`wp__chip${on ? " wp__chip--on" : ""}`}
      onClick={() => removable ? onRemove() : onToggle()}
    >
      {on && !removable && (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {name}
      {removable && (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}

interface Props {
  siteType: "corporate" | "ecommerce"
  onBack: () => void
  onNext: (info: WebsitePagesInfo) => void
  submitRef?: { current: (() => void) | null }
  setFormValid?: (valid: boolean) => void
  initialValue?: Partial<WebsitePagesInfo>
  onChange?: (price: number) => void
}

export default function WebsitePagesScreen({ siteType, onBack, onNext, submitRef, setFormValid, initialValue, onChange }: Props) {
  const allPages = siteType === "corporate" ? CORPORATE_PAGES : ECOMMERCE_PAGES
  const defaultSelected = useMemo(() => allPages.filter(p => p.main).map(p => p.name), [allPages])

  const [mode, setMode] = useState<"developer" | "manual">(initialValue?.mode ?? "manual")
  const [selected, setSelected]   = useState<string[]>(initialValue?.pages ?? defaultSelected)
  const [customPages, setCustom]  = useState<string[]>(
    initialValue?.pages?.filter(n => !allPages.some(p => p.name === n)) ?? []
  )
  const [search, setSearch]       = useState("")
  const [pageInput, setPageInput] = useState("")
  const [error, setError]         = useState(false)

  const isValid = mode === "developer" || selected.length > 0
  useEffect(() => { setFormValid?.(isValid) }, [isValid, setFormValid])

  const toggle = (name: string) =>
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])

  const addCustom = () => {
    const t = pageInput.trim()
    if (!t || customPages.includes(t) || allPages.some(p => p.name === t)) return
    setCustom(prev => [...prev, t])
    setSelected(prev => [...prev, t])
    setPageInput("")
  }

  const removeCustom = (name: string) => {
    setCustom(prev => prev.filter(n => n !== name))
    setSelected(prev => prev.filter(n => n !== name))
  }

  useEffect(() => {
    if (submitRef) submitRef.current = () => {
      if (mode === "manual" && selected.length === 0) { setError(true); return }
      onNext({ mode, pages: mode === "developer" ? defaultSelected : selected })
    }
  })

  useEffect(() => { if (selected.length > 0) setError(false) }, [selected])

  useEffect(() => {
    onChange?.(mode === "developer" ? calcWebsitePrice(defaultSelected) : calcWebsitePrice(selected))
  }, [mode, selected, onChange, defaultSelected])

  const q = search.toLowerCase()
  const isSearching = q.length > 0

  const mainPages  = allPages.filter(p => p.main)
  const otherPages = allPages.filter(p => !p.main)

  const visibleMain  = isSearching ? mainPages.filter(p => p.name.toLowerCase().includes(q))  : mainPages
  const visibleOther = isSearching ? otherPages.filter(p => p.name.toLowerCase().includes(q)) : otherPages
  const visibleCustom = isSearching ? customPages.filter(n => n.toLowerCase().includes(q)) : customPages

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />

      <div className="wp__header">
        <h1 className="wp__title">Choose your pages</h1>
        <p className="wp__subtitle">
          Select the pages you want included. Core pages are pre-selected. Toggle any on or off, or add your own.
        </p>
      </div>

      <div className="wp__mode-selection">
        <div
          className={`wp__mode-card${mode === "manual" ? " wp__mode-card--active" : ""}`}
          onClick={() => setMode("manual")}
        >
          <div className="wp__mode-card-check">
            {mode === "manual" && (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 6.5l3.5 3.5 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div className="wp__mode-card-body">
            <div className="wp__mode-card-title">Manual selection</div>
            <div className="wp__mode-card-desc">Pick exactly which pages to include. The first {FREE_PAGES} are free, then ${PRICE_PER_PAGE} per additional page.</div>
          </div>
        </div>

        <div
          className={`wp__mode-card${mode === "developer" ? " wp__mode-card--active" : ""}`}
          onClick={() => setMode("developer")}
        >
          <div className="wp__mode-card-check">
            {mode === "developer" && (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 6.5l3.5 3.5 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div className="wp__mode-card-body">
            <div className="wp__mode-card-title">Consult with the developer about this step</div>
            <div className="wp__mode-card-desc">Not sure which pages you need? We&apos;ll figure it out together on a quick call.</div>
          </div>
        </div>

        {mode === "developer" && (
          <div className="wp__consult-note">
            <p className="wp__consult-note-text">
              On a call, we&apos;ll map out the exact pages that fit your business and goals. Page structure plays a key role in the overall project, so we recommend this route. That said, you can always switch to manual selection and reach out to us after submitting the form.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="form-error form-error--with-bottom-margin">
          Please select at least one page to continue.
        </p>
      )}

      {mode === "manual" && (
        <>
          <div className="wp__search-wrap">
            <svg className="wp__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="wp__search-input"
              placeholder="Search pages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="wp__search-clear" onClick={() => setSearch("")}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="wp__sections">
            {isSearching ? (
              <div className="wp__chips">
                {[...visibleMain, ...visibleOther].map(p => <Chip key={p.name} name={p.name} on={selected.includes(p.name)} onToggle={() => toggle(p.name)} onRemove={() => removeCustom(p.name)} />)}
                {visibleCustom.map(n => <Chip key={n} name={n} removable on={selected.includes(n)} onToggle={() => toggle(n)} onRemove={() => removeCustom(n)} />)}
                {visibleMain.length + visibleOther.length + visibleCustom.length === 0 && (
                  <p className="wp__empty">No pages match your search.</p>
                )}
              </div>
            ) : (
              <>
                <div className="wp__section">
                  <div className="wp__section-label">Core pages</div>
                  <div className="wp__chips">
                    {mainPages.map(p => <Chip key={p.name} name={p.name} on={selected.includes(p.name)} onToggle={() => toggle(p.name)} onRemove={() => removeCustom(p.name)} />)}
                  </div>
                </div>

                <div className="wp__section">
                  <div className="wp__section-label">Additional pages</div>
                  <div className="wp__chips">
                    {otherPages.map(p => <Chip key={p.name} name={p.name} on={selected.includes(p.name)} onToggle={() => toggle(p.name)} onRemove={() => removeCustom(p.name)} />)}
                    {customPages.map(n => <Chip key={n} name={n} removable on={selected.includes(n)} onToggle={() => toggle(n)} onRemove={() => removeCustom(n)} />)}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="wp__add-row">
            <input
              className="wp__add-input"
              placeholder="Add a custom page..."
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom() } }}
            />
            <button className="wp__add-btn" onClick={addCustom}>Add</button>
          </div>
        </>
      )}
    </div>
  )
}
