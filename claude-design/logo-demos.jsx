// ============================================================
// LOGO VARIATION DEMOS — SVG illustrations for each type
// ============================================================

// Shared demo mark — a clean geometric monogram
function DemoMark({ size = 40, color = "#D97757", bg = "#1A1714" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={bg} />
      <path d="M10 29L20 11L30 29" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 23h13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Vertical Logo Demo ───────────────────────────────────────
function VerticalLogoDemo() {
  const T = window.TOKENS;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <DemoMark size={52} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: "15px", color: T.color.textPrimary, letterSpacing: "-0.01em" }}>APEX STUDIO</div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 400, fontSize: "9px", color: T.color.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "2px" }}>Creative Agency</div>
      </div>
    </div>
  );
}

// ── Horizontal Logo Demo ─────────────────────────────────────
function HorizontalLogoDemo() {
  const T = window.TOKENS;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <DemoMark size={44} />
      <div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: "16px", color: T.color.textPrimary, letterSpacing: "-0.02em", lineHeight: 1.1 }}>APEX STUDIO</div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 400, fontSize: "9px", color: T.color.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "3px" }}>Creative Agency</div>
      </div>
    </div>
  );
}

// ── Badge Logo Demo ──────────────────────────────────────────
function BadgeLogoDemo() {
  const T = window.TOKENS;
  return (
    <div style={{ position: "relative", width: "130px", height: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Circular text */}
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ position: "absolute", top: 0, left: 0 }}>
        {/* outer ring */}
        <circle cx="65" cy="65" r="60" fill="none" stroke="#1A1714" strokeWidth="1.5" />
        <circle cx="65" cy="65" r="52" fill="none" stroke="#E8E2DA" strokeWidth="0.5" />
        {/* top text path */}
        <defs>
          <path id="topArc" d="M 10,65 A 55,55 0 0,1 120,65" />
          <path id="botArc" d="M 18,75 A 50,50 0 0,0 112,75" />
        </defs>
        <text fill="#1A1714" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="600" letterSpacing="4">
          <textPath href="#topArc" startOffset="12%">APEX STUDIO · EST. 2024</textPath>
        </text>
        <text fill="#D97757" fontSize="8" fontFamily="DM Sans, sans-serif" fontWeight="400" letterSpacing="3">
          <textPath href="#botArc" startOffset="14%">creative agency</textPath>
        </text>
      </svg>
      {/* Center mark */}
      <DemoMark size={44} />
    </div>
  );
}

// ── Icon Only Demo ───────────────────────────────────────────
function IconOnlyDemo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DemoMark size={64} />
    </div>
  );
}

// ── Wordmark / Text Only Demo ────────────────────────────────
function WordmarkDemo() {
  const T = window.TOKENS;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ fontFamily: T.font.sans, fontWeight: 800, fontSize: "26px", color: T.color.textPrimary, letterSpacing: "-0.04em", lineHeight: 1 }}>
        APEX<span style={{ color: T.color.accent }}>.</span>
      </div>
      <div style={{ fontFamily: T.font.sans, fontWeight: 300, fontSize: "9.5px", color: T.color.textMuted, letterSpacing: "0.22em", textTransform: "uppercase" }}>Studio</div>
    </div>
  );
}

Object.assign(window, { VerticalLogoDemo, HorizontalLogoDemo, BadgeLogoDemo, IconOnlyDemo, WordmarkDemo });
