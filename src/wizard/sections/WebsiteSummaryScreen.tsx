"use client"
import { useState, useEffect } from "react"
import BackButton from "../ui/BackButton"
import Button from "../ui/Button"
import TextInput from "../ui/TextInput"
import SummaryRow from "../ui/SummaryRow"
import { calcDeposit } from "./utils"
import { COLOR_FAMILIES, FONT_CATEGORIES } from "./data"
import { getRecaptchaToken } from "@/lib/recaptcha-client"
import type { WebsiteInfo, WebsiteTypeInfo, WebsitePagesInfo, WebsiteStyleInfo, WebsiteColorsInfo, WebsiteFontsInfo, WebsiteExtrasInfo } from "./types"
import "./SummaryScreen.css"

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
    req.onerror  = () => reject(req.error)
  })
}

function saveWebsiteOrder(data: object): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const db    = await openDB()
      const tx    = db.transaction(["orders"], "readwrite")
      const store = tx.objectStore("orders")
      const orderId = Date.now().toString()
      const req   = store.put({ id: orderId, ...data })
      req.onsuccess = () => resolve(orderId)
      req.onerror   = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

function PaymentOption({ label, sublabel, amount, recommended, selected, onClick }: {
  label: string; sublabel: string; amount: number; recommended?: boolean; selected: boolean; onClick: () => void
}) {
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

const COUPON_CODE = "ANETACH"
const COUPON_DISCOUNT = 200

interface Props {
  websiteInfo:       Partial<WebsiteInfo>
  websiteTypeInfo:   Partial<WebsiteTypeInfo>
  websitePagesInfo:  Partial<WebsitePagesInfo>
  websiteStyleInfo:  Partial<WebsiteStyleInfo>
  websiteColorsInfo: Partial<WebsiteColorsInfo>
  websiteFontsInfo:  Partial<WebsiteFontsInfo>
  websiteExtrasInfo: Partial<WebsiteExtrasInfo>
  totalAmount:       number
  files?:            { logo: File | null; styleImages: File[] }
  onBack:            () => void
  onPriceChange?:    (total: number) => void
}

export default function WebsiteSummaryScreen({
  websiteInfo, websiteTypeInfo, websitePagesInfo, websiteStyleInfo,
  websiteColorsInfo, websiteFontsInfo, websiteExtrasInfo,
  totalAmount, files, onBack, onPriceChange,
}: Props) {
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError]     = useState("")
  const [payOption, setPayOption]   = useState<"deposit" | "full">("deposit")
  const [name, setName]             = useState("")
  const [email, setEmail]           = useState("")
  const [nameErr, setNameErr]       = useState("")
  const [emailErr, setEmailErr]     = useState("")
  const [coupon, setCoupon]         = useState("")
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponError, setCouponError] = useState("")

  const discount    = couponApplied ? COUPON_DISCOUNT : 0
  const finalTotal  = Math.max(0, totalAmount - discount)
  const deposit     = calcDeposit(finalTotal)
  const dueNow      = payOption === "deposit" ? deposit : finalTotal
  const dueLater    = payOption === "deposit" ? finalTotal - deposit : 0

  useEffect(() => { onPriceChange?.(finalTotal) }, [finalTotal, onPriceChange])

  const allFonts = Object.values(FONT_CATEGORIES).flatMap(c => c.fonts)

  const rows: [string, string][] = []
  rows.push(["Service", "Website Design"])
  if (websiteInfo.companyName)  rows.push(["Company", websiteInfo.companyName])
  if (websiteInfo.existingUrl)  rows.push(["Existing website", websiteInfo.existingUrl])
  if (websiteInfo.industry)     rows.push(["Industry", websiteInfo.industry])
  if (websiteInfo.description)  rows.push(["About the company", websiteInfo.description])
  if (websiteTypeInfo.siteType) rows.push(["Website type", websiteTypeInfo.siteType === "corporate" ? "Corporate" : "E-commerce"])
  if (websitePagesInfo.mode === "developer") {
    rows.push(["Pages", "Developer choice"])
  } else if (websitePagesInfo.pages?.length) {
    rows.push(["Pages", websitePagesInfo.pages.join(", ")])
  }
  if (websiteStyleInfo.links?.length) rows.push(["Style references", `${websiteStyleInfo.links.length} link${websiteStyleInfo.links.length > 1 ? "s" : ""}`])
  if (websiteStyleInfo.images?.length) rows.push(["Inspiration images", `${websiteStyleInfo.images.length} image${websiteStyleInfo.images.length > 1 ? "s" : ""}`])

  if (websiteColorsInfo.useExistingWebsite) {
    rows.push(["Colors", "Using existing website colors"])
  } else if (websiteColorsInfo.useExistingLogo) {
    rows.push(["Colors", "Using existing logo colors"])
  } else {
    if (websiteColorsInfo.colorFamilies?.length)
      rows.push(["Color palettes", websiteColorsInfo.colorFamilies.map(id => COLOR_FAMILIES.find(f => f.id === id)?.label ?? id).join(", ")])
    if (websiteColorsInfo.customColors?.length)
      rows.push(["Custom colors", websiteColorsInfo.customColors.join("  ")])
  }

  if (websiteFontsInfo.mode === "designer") {
    rows.push(["Fonts", "Designer's choice"])
  } else if (websiteFontsInfo.selectedFonts?.length) {
    rows.push(["Fonts", websiteFontsInfo.selectedFonts.map(id => allFonts.find(f => f.id === id)?.name ?? id).join(", ")])
  }

  if (websiteExtrasInfo.domainMode === "own") {
    rows.push(["Domain", websiteExtrasInfo.domainName || "Already have one"])
  } else if (websiteExtrasInfo.domainMode === "new") {
    rows.push(["Domain", `We'll register${websiteExtrasInfo.domainName ? ` "${websiteExtrasInfo.domainName}"` : ""} (+$40 / 2 years)`])
  }

  if (websiteExtrasInfo.hostingMode === "own") {
    rows.push(["Hosting", websiteExtrasInfo.hostingProvider || "Already have one"])
  } else if (websiteExtrasInfo.hostingMode === "new") {
    rows.push(["Hosting", "We'll set it up (+$240 / 2 years)"])
  }

  if (websiteExtrasInfo.maintenance !== undefined) {
    rows.push(["Maintenance", websiteExtrasInfo.maintenance ? "Included (+$300 / 2 years)" : "Self-managed"])
  }

  rows.push(["Delivery", "Fully designed & developed website"])
  rows.push(["Revisions", "1 round included"])
  if (couponApplied) rows.push(["Coupon discount", `-$${COUPON_DISCOUNT}`])

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
          totalAmount: finalTotal,
          recaptchaToken,
          serviceType: "website",
          clientName: name,
          clientEmail: email,
          payOption,
          discount,
          couponApplied,
          couponCode: coupon,
          websiteInfo,
          websiteTypeInfo,
          websitePagesInfo,
          websiteStyleInfo,
          websiteColorsInfo,
          websiteFontsInfo,
          websiteExtrasInfo,
          fileMetadata: {
            logo: files?.logo ? { name: files.logo.name, size: files.logo.size } : null,
            styleImages: (files?.styleImages ?? []).map(f => ({ name: f.name, size: f.size })),
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Checkout failed")
      }

      const { url } = await res.json()

      // Local backup of file blobs
      await saveWebsiteOrder({
        serviceType: "website",
        websiteInfo, websiteTypeInfo, websitePagesInfo,
        websiteStyleInfo, websiteColorsInfo, websiteFontsInfo, websiteExtrasInfo,
        name, email, payOption, totalAmount: finalTotal,
        discount, couponApplied,
        logoFile: files?.logo ?? null,
        styleImages: files?.styleImages ?? [],
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
        <div className="summary__rows-total">
          <SummaryRow label="Total" value={`$${finalTotal}`} highlight />
        </div>
      </div>

      <div className="summary__payment">
        <div className="summary__payment-label">How would you like to pay?</div>
        <div className="summary__payment-options">
          <PaymentOption
            label="35% Deposit"
            sublabel={`Pay now to get started. Remaining $${dueLater > 0 ? dueLater : finalTotal - deposit} due on delivery.`}
            amount={deposit}
            recommended
            selected={payOption === "deposit"}
            onClick={() => setPayOption("deposit")}
          />
          <PaymentOption
            label="Full Payment"
            sublabel="Pay the complete amount upfront. No balance due on delivery."
            amount={finalTotal}
            selected={payOption === "full"}
            onClick={() => setPayOption("full")}
          />
        </div>
      </div>

      {/* <div className="summary__coupon">
        <div className="summary__coupon-label">Have a coupon code?</div>
        {couponApplied ? (
          <div className="summary__coupon-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--color-accent)"/><path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Coupon applied: <strong>-$99 discount</strong></span>
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
        <Button
          onClick={handlePayment}
          size="lg"
          disabled={processing}
          icon={processing
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spinner"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 14" opacity="0.7"/></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        >
          {processing ? "Processing..." : `Pay $${dueNow} Now`}
        </Button>
      </div>
    </div>
  )
}
