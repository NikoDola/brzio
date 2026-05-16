"use client"
import { useState, useEffect } from "react"
import SummaryRow from "../ui/SummaryRow"
import BackButton from "../ui/BackButton"
import Button from "../ui/Button"
import TextInput from "../ui/TextInput"
import { BRAND_SERVICES, VARIATION_LABELS, COLOR_FAMILIES, FONT_CATEGORIES } from "./data"
import { calcTotal, calcDeposit, calcBrandGuidelinesPrice } from "./utils"
import { getRecaptchaToken } from "@/lib/recaptcha-client"
import type { Order } from "./types"
import "./SummaryScreen.css"

interface PendingOrderData {
  order: Order
  name: string
  email: string
  payOption: "deposit" | "full"
  addBrandGuide: boolean
  totalAmount: number
  logoFile: File | null
  inspirationFile: File | null
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("BrandingCalculator", 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("orders")) {
        db.createObjectStore("orders", { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function saveOrderData(data: Omit<PendingOrderData, "id">): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB()
      const tx = db.transaction(["orders"], "readwrite")
      const store = tx.objectStore("orders")
      const orderId = Date.now().toString()

      const req = store.put({ id: orderId, ...data })
      req.onsuccess = () => resolve(orderId)
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="info-tip" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="info-tip__icon">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3.5" stroke="currentColor" strokeWidth="1"/><path d="M4 3.5v2M4 2.5v.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
      </div>
      {show && (
        <div className="info-tip__bubble">
          {text}
          <div className="info-tip__arrow" />
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BrandGuidelinesAddon({ numVariations, selected, onToggle }: { numVariations: number; selected: boolean; onToggle: () => void }) {
  const price = calcBrandGuidelinesPrice(numVariations)
  const perVarCount = BRAND_SERVICES.filter(s => s.perVariation).length
  const totalHrs = perVarCount * numVariations + (BRAND_SERVICES.length - perVarCount)
  return (
    <div className="brand-addon">
      <div className="brand-addon__section-label">Enhance your package</div>
      <div onClick={onToggle} className={`brand-addon__card${selected ? " brand-addon__card--selected" : ""}`}>
        <div className="brand-addon__header">
          <div className="brand-addon__header-left">
            <div className={`brand-addon__icon${selected ? " brand-addon__icon--selected" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="16" height="14" rx="2" stroke={selected ? "#fff" : "var(--color-text-muted)"} strokeWidth="1.5"/>
                <path d="M5 7h10M5 10h7M5 13h5" stroke={selected ? "#fff" : "var(--color-text-muted)"} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className={`brand-addon__name${selected ? " brand-addon__name--selected" : ""}`}>Mini Brand Guidelines</div>
              <div className="brand-addon__meta">Complete visual identity guide · {BRAND_SERVICES.length} deliverables · {numVariations} logo variation{numVariations > 1 ? "s" : ""}</div>
            </div>
          </div>
          <div className="brand-addon__header-right">
            <div className="brand-addon__price-block">
              <div className={`brand-addon__price${selected ? " brand-addon__price--selected" : ""}`}>+${price}</div>
              <div className="brand-addon__rate">${25}/hr · {totalHrs} hrs total</div>
            </div>
            <div className={`brand-addon__radio${selected ? " brand-addon__radio--selected" : ""}`}>
              {selected && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
        </div>
        <div className="brand-addon__services">
            <div className="brand-addon__services-grid">
              {BRAND_SERVICES.map(svc => (
                <div key={svc.id} className="brand-addon__service-row">
                  <div className="brand-addon__service-left">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 6l3 3 5-5" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="brand-addon__service-label">{svc.label}</span>
                    <InfoTip text={svc.tooltip} />
                  </div>
                </div>
              ))}
            </div>
            <div className="brand-addon__subtotal">
              Subtotal: <strong className="brand-addon__subtotal-amount">${price}</strong>
            </div>
          </div>
        </div>
      </div>
  )
}

function PaymentOption({ label, sublabel, amount, recommended, selected, onClick }: { label: string; sublabel: string; amount: number; recommended?: boolean; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`payment-option${selected ? " payment-option--selected" : ""}`}>
      {recommended && <div className="payment-option__badge">RECOMMENDED</div>}
      <div className="payment-option__body">
        <div>
          <div className={`payment-option__label${selected ? " payment-option__label--selected" : ""}`}>{label}</div>
          <div className="payment-option__sublabel">{sublabel}</div>
        </div>
        <div className={`payment-option__amount${selected ? " payment-option__amount--selected" : ""}`}>${amount}</div>
      </div>
      <div className={`payment-option__radio${selected ? " payment-option__radio--selected" : ""}`}>
        {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
    </div>
  )
}

const COUPON_CODE = "ANETA SH"
const COUPON_DISCOUNT = 84

export default function SummaryScreen({ order, onBack, files, onPriceChange }: { order: Order; onBack: () => void; files?: { logo: File | null; inspiration: File | null }; onPriceChange?: (total: number) => void }) {
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState("")
  const [payOption, setPayOption] = useState<"deposit"|"full">("deposit")
  const [addBrandGuide, setBrandGuide] = useState(false) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [nameErr, setNameErr] = useState("")
  const [emailErr, setEmailErr] = useState("")
  const [coupon, setCoupon] = useState("")
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponError, setCouponError] = useState("")

  const numVariations   = order.variations?.length || 1
  const brandGuidePrice = addBrandGuide ? calcBrandGuidelinesPrice(numVariations) : 0
  const discount        = couponApplied ? COUPON_DISCOUNT : 0
  const total           = Math.max(0, calcTotal(order) + brandGuidePrice - discount)
  const deposit         = calcDeposit(total)
  const dueNow          = payOption === "deposit" ? deposit : total
  const dueLater        = payOption === "deposit" ? total - deposit : 0

  useEffect(() => { onPriceChange?.(total) }, [total, onPriceChange])

  const allFonts = Object.values(FONT_CATEGORIES).flatMap(c => c.fonts)
  const rows: [string, string][] = [
    ["Service", order.serviceType === "design" ? "Logo Design" : "Logo Redesign"],
    ...(order.description ? [["About the company", order.description] as [string,string]] : []),
    ...(order.tagline ? [["Tagline", `"${order.tagline}"`] as [string,string]] : []),
    ...(order.variations?.length ? [["Variations", order.variations.map(v => VARIATION_LABELS[v]).join(", ")] as [string,string]] : []),
    ...(order.typographyType ? [["Typography", order.typographyType === "custom" ? `Custom${(order.customPrice ?? 0) > 0 ? ` (+$${order.customPrice})` : " (included)"}` : "Free Font"] as [string,string]] : []),
    ...(order.selectedFonts?.length ? [["Font inspirations", order.selectedFonts.map(id => allFonts.find(f => f.id === id)?.name).filter(Boolean).join(", ")] as [string,string]] : []),
    ...((order.variations?.length ?? 0) > 1 ? [["Variation extras", `${(order.variations?.length ?? 0) - 1} × $25`] as [string,string]] : []),
    ...(order.colorFamilies?.length ? [["Color palettes", order.colorFamilies.map(id => COLOR_FAMILIES.find(f => f.id === id)?.label).join(", ")] as [string,string]] : []),
    ...(order.customColors?.length ? [["Custom colors", order.customColors.join("  ")] as [string,string]] : []),
    ...(order.useSameColors ? [["Logo colors", "Using colors from uploaded logo"] as [string,string]] : []),
    ["Delivery", "SVG + PNG + PDF"],
    ["Revisions", "2 rounds included"],
    ...(couponApplied ? [["Coupon discount", `-$${COUPON_DISCOUNT}`] as [string, string]] : []),
  ]

  const handleApplyCoupon = () => {
    if (coupon.trim().toUpperCase() === COUPON_CODE) {
      setCouponApplied(true)
      setCouponError("")
    } else {
      setCouponError("Invalid coupon code")
      setCouponApplied(false)
    }
  }

  const handlePayment = async () => {
    let valid = true
    if (!name.trim()) { setNameErr("Name is required"); valid = false } else setNameErr("")
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr("Valid email is required"); valid = false } else setEmailErr("")
    if (!valid) return

    setProcessing(true)
    setPayError("")

    try {
      const recaptchaToken = await getRecaptchaToken("checkout")
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: dueNow,
          totalAmount: total,
          recaptchaToken,
          clientName: name,
          clientEmail: email,
          payOption,
          addBrandGuide,
          discount,
          couponApplied,
          couponCode: coupon,
          order,
          fileMetadata: {
            logo: files?.logo ? { name: files.logo.name, size: files.logo.size, type: files.logo.type } : null,
            inspiration: files?.inspiration ? { name: files.inspiration.name, size: files.inspiration.size, type: files.inspiration.type } : null,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Checkout failed")
      }

      const { url } = await res.json()

      // Local backup of file blobs in case admin asks for them later via the same browser
      await saveOrderData({
        order, name, email, payOption, addBrandGuide,
        totalAmount: total,
        logoFile: files?.logo || null,
        inspirationFile: files?.inspiration || null,
      }).catch(() => {})

      window.location.href = url
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Payment initiation failed")
      setProcessing(false)
    }
  }

  return (
    <div className="screen-enter">
      <BackButton onClick={onBack} />
      <div className="summary__header">
        <h1 className="summary__title">Review your order</h1>
        <p className="summary__subtitle">Everything looks good? Choose how you&apos;d like to pay.</p>
      </div>

      <div className="summary__rows">
        {rows.map(([label, value]) => <SummaryRow key={label} label={label} value={value} />)}
        <div className="summary__rows-total"><SummaryRow label="Total" value={`$${total}`} highlight /></div>
      </div>

      {/* BrandGuidelinesAddon hidden for now — re-enable when ready
      <BrandGuidelinesAddon numVariations={numVariations} selected={addBrandGuide} onToggle={() => setBrandGuide(v => !v)} />
      */}

      <div className="summary__payment">
        <div className="summary__payment-label">How would you like to pay?</div>
        <div className="summary__payment-options">
          <PaymentOption label="35% Deposit" sublabel={`Pay now to get started. Remaining $${dueLater > 0 ? dueLater : total - deposit} due on delivery.`} amount={deposit} recommended selected={payOption === "deposit"} onClick={() => setPayOption("deposit")} />
          <PaymentOption label="Full Payment" sublabel="Pay the complete amount upfront. No balance due on delivery." amount={total} selected={payOption === "full"} onClick={() => setPayOption("full")} />
        </div>
      </div>

      {/* <div className="summary__coupon">
        <div className="summary__coupon-label">Have a coupon code?</div>
        {couponApplied ? (
          <div className="summary__coupon-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--color-accent)"/><path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Coupon applied: <strong>-$84 discount</strong></span>
          </div>
        ) : (
          <div className="summary__coupon-row">
            <input
              className={`summary__coupon-input${couponError ? " summary__coupon-input--error" : ""}`}
              type="text"
              placeholder="Enter coupon code"
              value={coupon}
              onChange={e => { setCoupon(e.target.value); setCouponError("") }}
              onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
            />
            <button className="summary__coupon-btn" onClick={handleApplyCoupon}>Apply</button>
          </div>
        )}
        {couponError && <p className="summary__coupon-error">{couponError}</p>}
      </div> */}

      <div className="summary__contact">
        <div className="summary__contact-label">Your contact info</div>
        <div className="summary__contact-grid">
          <TextInput label="Name" placeholder="Your name" value={name} onChange={v => { setName(v); setNameErr("") }} required error={nameErr} />
          <TextInput label="Email" placeholder="your@email.com" value={email} onChange={v => { setEmail(v); setEmailErr("") }} required error={emailErr} />
        </div>
      </div>

      <div className="summary__info-notice">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="summary__info-notice-icon">
          <circle cx="9" cy="9" r="8" stroke="var(--color-text-muted)" strokeWidth="1.5"/>
          <path d="M9 8v5M9 6v.5" stroke="var(--color-text-muted)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <p className="summary__info-notice-text">We accept all major cards and bank transfers. Work begins once payment is confirmed.</p>
      </div>

      {payError && <p className="summary__send-error">{payError}</p>}

      <div className="summary__submit-row">
        <Button onClick={handlePayment} size="lg" disabled={processing}
          icon={processing
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spinner"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 14" opacity="0.7"/></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }>
          {processing ? "Processing..." : `Pay $${dueNow} Now`}
        </Button>
      </div>
    </div>
  )
}
