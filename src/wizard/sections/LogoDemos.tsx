"use client"
import { T } from "./tokens"

function DemoMark({ size = 40, color = "#D97757", bg = "#1A1714" }: { size?: number; color?: string; bg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={bg} />
      <path d="M10 29L20 11L30 29" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 23h13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function VerticalLogoDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <DemoMark size={52} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: "15px", color: T.color.textPrimary, letterSpacing: "-0.01em" }}>APEX STUDIO</div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 400, fontSize: "9px", color: T.color.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "2px" }}>Creative Agency</div>
      </div>
    </div>
  )
}

export function HorizontalLogoDemo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <DemoMark size={44} />
      <div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: "16px", color: T.color.textPrimary, letterSpacing: "-0.02em", lineHeight: 1.1 }}>APEX STUDIO</div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 400, fontSize: "9px", color: T.color.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "3px" }}>Creative Agency</div>
      </div>
    </div>
  )
}

export function BadgeLogoDemo() {
  return (
    <div style={{ width: "130px", height: "130px" }}>
      <svg viewBox="0 0 130 130" width="130" height="130" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <path id="bd-top" d="M25.2,65C25.2,43,43,25.2,65,25.2c22,0,39.8,17.8,39.8,39.8c0,22-17.8,39.8-39.8,39.8C43,104.8,25.2,87,25.2,65z" />
          <path id="bd-bot" d="M114,63.4C113.1,36.3,90.4,15.1,63.4,16S15.1,39.6,16,66.6s23.6,48.3,50.6,47.4S114.9,90.4,114,63.4z" />
        </defs>

        {/* Outer ring */}
        <circle cx="65" cy="65" r="58" fill="none" stroke="#1A1714" strokeWidth="1" />
        {/* Center filled circle */}
        <circle cx="65" cy="65" r="28" fill="#1A1714" />

        {/* Top curved text */}
        <text fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="12.8" letterSpacing="1" fill="#1A1714">
          <textPath href="#bd-top" startOffset="7%">APEX STUDIO</textPath>
        </text>

        {/* Bottom curved text */}
        <text fontFamily="DM Sans, sans-serif" fontWeight="600" fontSize="7" letterSpacing="3" fill="#1A1714">
          <textPath href="#bd-bot" startOffset="57%">CREATIVE AGENCY</textPath>
        </text>

        {/* Left decorative lines */}
        <line x1="14" y1="58.6" x2="29.6" y2="58.6" stroke="#1A1714" strokeWidth="1" />
        <line x1="14" y1="72.2" x2="29.6" y2="72.2" stroke="#1A1714" strokeWidth="1" />
        {/* EST label */}
        <text x="14.02" y="68" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="6.9" fill="#D97757">EST</text>

        {/* Right decorative lines */}
        <line x1="99.4" y1="58.6" x2="115" y2="58.6" stroke="#1A1714" strokeWidth="1" />
        <line x1="99.4" y1="72.2" x2="115" y2="72.2" stroke="#1A1714" strokeWidth="1" />
        {/* 2024 label */}
        <text x="98.26" y="68" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="6.9" fill="#D97757">2024</text>

        {/* Orange logo mark */}
        <path  fill="#D97757" d="M79.9,74.4l-2.3-3.7L75,66.4l-8-13c-0.4-0.7-1.1-1-1.9-1h-0.4c-0.7,0.1-1.3,0.4-1.6,1l-8,13-2.7,4.4-2.2,3.6c-0.6,1-0.3,2.4,0.7,3s2.4,0.3,3-0.7l3.7-6h15l3.7,5.9c0.6,1,2,1.4,3,0.7S80.5,75.4,79.9,74.4zM69.8,66.4h-9.5l4.8-7.8L69.8,66.4z" />
      </svg>
    </div>
  )
}

export function IconOnlyDemo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DemoMark size={64} />
    </div>
  )
}

export function WordmarkDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ fontFamily: T.font.sans, fontWeight: 800, fontSize: "26px", color: T.color.textPrimary, letterSpacing: "-0.04em", lineHeight: 1 }}>
        APEX<span style={{ color: T.color.accent }}>.</span>
      </div>
      <div style={{ fontFamily: T.font.sans, fontWeight: 300, fontSize: "9.5px", color: T.color.textMuted, letterSpacing: "0.22em", textTransform: "uppercase" }}>Studio</div>
    </div>
  )
}
