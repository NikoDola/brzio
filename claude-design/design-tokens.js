// ============================================================
// DESIGN TOKENS — Logo Configurator
// Edit these to retheme the entire app.
// ============================================================

const TOKENS = {
  // ── Colors ──────────────────────────────────────────────
  color: {
    // Backgrounds
    bg:          "#FAF9F6",   // warm page background
    surface:     "#FFFFFF",   // card / panel surface
    surfaceAlt:  "#F5F3EE",   // subtle inset / well
    overlay:     "rgba(26,23,20,0.35)",

    // Borders
    border:      "#E8E2DA",
    borderFocus: "#D97757",

    // Text
    textPrimary:   "#1A1714",
    textSecondary: "#6B6056",
    textMuted:     "#A89C90",
    textInverse:   "#FFFFFF",

    // Brand accent
    accent:        "#D97757",   // warm orange
    accentHover:   "#C4633F",
    accentLight:   "#FBF0EB",   // tinted bg for selected states
    accentMuted:   "#F0DDD4",

    // Semantic
    success:  "#4A7C59",
    error:    "#C0392B",
    warning:  "#B07A2A",
  },

  // ── Typography ──────────────────────────────────────────
  font: {
    sans:  "'DM Sans', system-ui, sans-serif",
    mono:  "'DM Mono', monospace",
  },
  fontSize: {
    xs:   "11px",
    sm:   "13px",
    base: "15px",
    md:   "17px",
    lg:   "20px",
    xl:   "24px",
    "2xl":"30px",
    "3xl":"38px",
  },
  fontWeight: {
    regular: 400,
    medium:  500,
    semibold:600,
    bold:    700,
  },
  lineHeight: {
    tight:  1.2,
    snug:   1.4,
    normal: 1.6,
    loose:  1.8,
  },
  letterSpacing: {
    tight:   "-0.02em",
    normal:  "0em",
    wide:    "0.04em",
    wider:   "0.08em",
    widest:  "0.14em",
  },

  // ── Spacing ─────────────────────────────────────────────
  space: {
    "1":  "4px",
    "2":  "8px",
    "3":  "12px",
    "4":  "16px",
    "5":  "20px",
    "6":  "24px",
    "7":  "28px",
    "8":  "32px",
    "10": "40px",
    "12": "48px",
    "14": "56px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
  },

  // ── Radii ───────────────────────────────────────────────
  radius: {
    sm:   "6px",
    md:   "10px",
    lg:   "16px",
    xl:   "22px",
    full: "9999px",
  },

  // ── Shadows ─────────────────────────────────────────────
  shadow: {
    xs:  "0 1px 2px rgba(26,23,20,0.06)",
    sm:  "0 2px 6px rgba(26,23,20,0.08)",
    md:  "0 4px 16px rgba(26,23,20,0.10)",
    lg:  "0 8px 32px rgba(26,23,20,0.12)",
    xl:  "0 16px 48px rgba(26,23,20,0.14)",
    focus: "0 0 0 3px rgba(217,119,87,0.28)",
  },

  // ── Animation ───────────────────────────────────────────
  duration: {
    fast:   "120ms",
    normal: "200ms",
    slow:   "340ms",
  },
  easing: {
    smooth: "cubic-bezier(0.4,0,0.2,1)",
    spring: "cubic-bezier(0.34,1.56,0.64,1)",
    out:    "cubic-bezier(0,0,0.2,1)",
  },
};

// Make available globally
window.TOKENS = TOKENS;
