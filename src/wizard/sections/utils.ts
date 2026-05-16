import type { Order } from "./types"
import { BRAND_SERVICES } from "./data"

export function calcTotal(order: Order): number {
  const base   = 150
  const extras = Math.max(0, (order.variations?.length || 0) - 1) * 25
  const typo   = (order.typographyType === "custom" && (order.customPrice ?? 0) > 0) ? (order.customPrice ?? 0) : 0
  return base + extras + typo
}

export function calcDeposit(total: number): number {
  return Math.round(total * 0.35 / 5) * 5
}

export function calcBrandGuidelinesPrice(numVariations: number): number {
  const perVar = BRAND_SERVICES.filter(s => s.perVariation).length
  const flat   = BRAND_SERVICES.filter(s => !s.perVariation).length
  return (perVar * numVariations + flat) * 25
}

export function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       { r=c; g=x; b=0 }
  else if (h < 120) { r=x; g=c; b=0 }
  else if (h < 180) { r=0; g=c; b=x }
  else if (h < 240) { r=0; g=x; b=c }
  else if (h < 300) { r=x; g=0; b=c }
  else              { r=c; g=0; b=x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const clean = hex.replace(/^#/, "")
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0,2),16)/255
  const g = parseInt(clean.slice(2,4),16)/255
  const b = parseInt(clean.slice(4,6),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else                h = (r - g) / d + 4
    h = Math.round(h * 60); if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : Math.round(d / max * 100), v: Math.round(max * 100) }
}
