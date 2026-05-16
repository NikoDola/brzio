// ============================================================
// SHARED COMPONENTS — Logo Configurator
// ============================================================

// ── Button ──────────────────────────────────────────────────
function Button({ children, onClick, variant = "primary", size = "md", disabled = false, fullWidth = false, icon }) {
  const T = window.TOKENS;
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: T.space["2"], fontFamily: T.font.sans, fontWeight: T.fontWeight.medium,
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: T.radius.full, transition: `all ${T.duration.normal} ${T.easing.smooth}`,
    opacity: disabled ? 0.5 : 1, width: fullWidth ? "100%" : "auto",
    textDecoration: "none",
  };
  const sizes = {
    sm: { fontSize: T.fontSize.sm, padding: `${T.space["2"]} ${T.space["4"]}`, height: "34px" },
    md: { fontSize: T.fontSize.base, padding: `${T.space["3"]} ${T.space["6"]}`, height: "44px" },
    lg: { fontSize: T.fontSize.md, padding: `${T.space["4"]} ${T.space["8"]}`, height: "52px" },
  };
  const variants = {
    primary: { background: T.color.accent, color: T.color.textInverse },
    secondary: { background: T.color.surfaceAlt, color: T.color.textPrimary, border: `1px solid ${T.color.border}` },
    ghost: { background: "transparent", color: T.color.textSecondary },
    danger: { background: T.color.error, color: T.color.textInverse },
  };

  const [hovered, setHovered] = React.useState(false);
  const hoverStyles = hovered && !disabled ? (variant === "primary" ? { background: T.color.accentHover, transform: "translateY(-1px)", boxShadow: T.shadow.md } : { background: T.color.surfaceAlt, opacity: 0.85 }) : {};

  return (
    <button
      style={{ ...base, ...sizes[size], ...variants[variant], ...hoverStyles }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon && <span style={{ display: "flex" }}>{icon}</span>}
      {children}
    </button>
  );
}

// ── ProgressBar ─────────────────────────────────────────────
function ProgressBar({ steps, current }) {
  const T = window.TOKENS;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: T.space["3"], width: "100%" }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.space["1"] }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: T.radius.full,
                background: done ? T.color.accent : active ? T.color.accentLight : T.color.surfaceAlt,
                border: `2px solid ${done || active ? T.color.accent : T.color.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: `all ${T.duration.normal} ${T.easing.smooth}`,
              }}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={T.color.textInverse} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <span style={{ fontSize: T.fontSize.xs, fontWeight: T.fontWeight.semibold, color: active ? T.color.accent : T.color.textMuted }}>{i + 1}</span>
                }
              </div>
              <span style={{ fontSize: T.fontSize.xs, fontWeight: active ? T.fontWeight.semibold : T.fontWeight.regular, color: active ? T.color.textPrimary : T.color.textMuted, whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: "2px", background: done ? T.color.accent : T.color.border, borderRadius: "1px", marginBottom: "18px", transition: `background ${T.duration.slow} ${T.easing.smooth}` }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── ServiceCard ─────────────────────────────────────────────
function ServiceCard({ title, description, price, icon, selected, onClick, badge }) {
  const T = window.TOKENS;
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? T.color.accentLight : T.color.surface,
        border: `2px solid ${selected ? T.color.accent : hovered ? T.color.accentMuted : T.color.border}`,
        borderRadius: T.radius.xl,
        padding: T.space["8"],
        cursor: "pointer",
        transition: `all ${T.duration.normal} ${T.easing.smooth}`,
        boxShadow: selected ? T.shadow.md : hovered ? T.shadow.sm : T.shadow.xs,
        transform: hovered && !selected ? "translateY(-2px)" : "none",
        position: "relative",
        flex: 1,
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: T.space["4"], right: T.space["4"], width: "22px", height: "22px", borderRadius: T.radius.full, background: T.color.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {badge && (
        <div style={{ position: "absolute", top: "-10px", left: T.space["6"], background: T.color.accent, color: "#fff", fontSize: T.fontSize.xs, fontWeight: T.fontWeight.semibold, padding: `3px 10px`, borderRadius: T.radius.full, letterSpacing: T.letterSpacing.wide }}>{badge}</div>
      )}
      <div style={{ fontSize: "36px", marginBottom: T.space["4"] }}>{icon}</div>
      <div style={{ fontSize: T.fontSize.lg, fontWeight: T.fontWeight.semibold, color: T.color.textPrimary, marginBottom: T.space["2"] }}>{title}</div>
      <div style={{ fontSize: T.fontSize.sm, color: T.color.textSecondary, lineHeight: T.lineHeight.normal, marginBottom: T.space["6"] }}>{description}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: T.space["1"] }}>
        <span style={{ fontSize: T.fontSize["2xl"], fontWeight: T.fontWeight.bold, color: selected ? T.color.accent : T.color.textPrimary }}>${price}</span>
        <span style={{ fontSize: T.fontSize.sm, color: T.color.textMuted }}>flat rate</span>
      </div>
    </div>
  );
}

// ── VariationCard ────────────────────────────────────────────
function VariationCard({ title, description, selected, onClick, children }) {
  const T = window.TOKENS;
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? T.color.accentLight : "#FFFFFF",
        border: `2px solid ${selected ? T.color.accent : hovered ? "#B9907B" : T.color.accentMuted}`,
        borderRadius: T.radius.xl,
        padding: T.space["6"],
        cursor: "pointer",
        transition: `all ${T.duration.normal} ${T.easing.smooth}`,
        boxShadow: T.shadow.xs,
        transform: "none",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: T.space["5"],
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: T.space["4"], right: T.space["4"], width: "22px", height: "22px", borderRadius: T.radius.full, background: T.color.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {/* Demo preview area */}
      <div style={{ background: T.color.surfaceAlt, borderRadius: T.radius.md, padding: T.space["6"], minHeight: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
      <div>
        <div style={{ fontSize: T.fontSize.base, fontWeight: T.fontWeight.semibold, color: T.color.textPrimary, marginBottom: T.space["1"] }}>{title}</div>
        <div style={{ fontSize: T.fontSize.sm, color: T.color.textSecondary, lineHeight: T.lineHeight.normal }}>{description}</div>
      </div>
    </div>
  );
}

// ── UploadZone ───────────────────────────────────────────────
function UploadZone({ file, onFile }) {
  const T = window.TOKENS;
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? T.color.accent : file ? T.color.accent : T.color.border}`,
        borderRadius: T.radius.xl,
        padding: `${T.space["12"]} ${T.space["8"]}`,
        background: dragging ? T.color.accentLight : file ? T.color.accentLight : T.color.surface,
        cursor: "pointer",
        transition: `all ${T.duration.normal} ${T.easing.smooth}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: T.space["4"],
        textAlign: "center",
      }}
    >
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.svg,.ai,.pdf,.eps" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />

      {file ? (
        <>
          <div style={{ width: "56px", height: "56px", borderRadius: T.radius.lg, background: T.color.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 3v14M7 11l6 6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="20" width="18" height="2.5" rx="1.25" fill="#fff"/></svg>
          </div>
          <div>
            <div style={{ fontSize: T.fontSize.md, fontWeight: T.fontWeight.semibold, color: T.color.accent }}>{file.name}</div>
            <div style={{ fontSize: T.fontSize.sm, color: T.color.textMuted, marginTop: T.space["1"] }}>{(file.size / 1024).toFixed(1)} KB · Click to replace</div>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: "56px", height: "56px", borderRadius: T.radius.lg, background: T.color.surfaceAlt, border: `1px solid ${T.color.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 17V3M7 9l6-6 6 6" stroke={T.color.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="20" width="18" height="2.5" rx="1.25" fill={T.color.border}/></svg>
          </div>
          <div>
            <div style={{ fontSize: T.fontSize.md, fontWeight: T.fontWeight.semibold, color: T.color.textPrimary }}>Drop your logo here</div>
            <div style={{ fontSize: T.fontSize.sm, color: T.color.textSecondary, marginTop: T.space["1"] }}>or click to browse</div>
            <div style={{ fontSize: T.fontSize.xs, color: T.color.textMuted, marginTop: T.space["3"], letterSpacing: T.letterSpacing.wide, textTransform: "uppercase" }}>JPG · PNG · SVG · AI · PDF · EPS</div>
          </div>
        </>
      )}
    </div>
  );
}

// ── SummaryRow ───────────────────────────────────────────────
function SummaryRow({ label, value, highlight }) {
  const T = window.TOKENS;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${T.space["3"]} 0`, borderBottom: `1px solid ${T.color.border}` }}>
      <span style={{ fontSize: T.fontSize.base, color: T.color.textSecondary }}>{label}</span>
      <span style={{ fontSize: highlight ? T.fontSize.lg : T.fontSize.base, fontWeight: highlight ? T.fontWeight.bold : T.fontWeight.medium, color: highlight ? T.color.accent : T.color.textPrimary }}>{value}</span>
    </div>
  );
}

// ── TextInput ────────────────────────────────────────────────
function TextInput({ label, placeholder, value, onChange, required, hint, error, note }) {
  const T = window.TOKENS;
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.space["2"] }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontSize: T.fontSize.sm, fontWeight: T.fontWeight.semibold, color: T.color.textPrimary }}>
          {label}
          {required && <span style={{ color: T.color.accent, marginLeft: "3px" }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: T.fontSize.xs, color: T.color.textMuted }}>{hint}</span>}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: T.font.sans, fontSize: T.fontSize.base,
          padding: `${T.space["3"]} ${T.space["4"]}`,
          border: `1.5px solid ${error ? T.color.error : focused ? T.color.accent : T.color.border}`,
          borderRadius: T.radius.md,
          background: T.color.surface,
          color: T.color.textPrimary,
          outline: "none",
          transition: `border-color 180ms ease, box-shadow 180ms ease`,
          boxShadow: focused ? T.shadow.focus : "none",
          width: "100%",
        }}
      />
      {error && <span style={{ fontSize: T.fontSize.xs, color: T.color.error }}>{error}</span>}
      {note && (
        <div style={{ display: "flex", gap: T.space["2"], alignItems: "flex-start", background: T.color.accentLight, border: `1px solid ${T.color.accentMuted}`, borderRadius: T.radius.md, padding: T.space["3"] }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}><circle cx="7" cy="7" r="6" stroke={T.color.accent} strokeWidth="1.4"/><path d="M7 6v4M7 4.5v.5" stroke={T.color.accent} strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span style={{ fontSize: T.fontSize.xs, color: T.color.textSecondary, lineHeight: T.lineHeight.normal }}>{note}</span>
        </div>
      )}
    </div>
  );
}

// ── StyleCard ────────────────────────────────────────────────
function StyleCard({ label, sublabel, selected, onClick, children, index, dimmed }) {
  const T = window.TOKENS;
  const [hovered, setHovered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? T.color.accentLight : T.color.surface,
        border: `2px solid ${selected ? T.color.accent : hovered ? T.color.accentMuted : T.color.border}`,
        borderRadius: T.radius.lg,
        cursor: dimmed ? "not-allowed" : "pointer",
        transition: `all 200ms cubic-bezier(0,0,0.2,1), opacity 300ms ease, transform 300ms ease`,
        boxShadow: selected ? T.shadow.md : hovered ? T.shadow.sm : T.shadow.xs,
        overflow: "hidden",
        position: "relative",
        opacity: !visible ? 0 : dimmed ? 0.4 : 1,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: T.space["2"], right: T.space["2"], width: "20px", height: "20px", borderRadius: T.radius.full, background: T.color.accent, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {/* Preview area */}
      <div style={{ aspectRatio: "4/3", background: T.color.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {children}
      </div>
      <div style={{ padding: `${T.space["3"]} ${T.space["4"]}` }}>
        <div style={{ fontSize: T.fontSize.sm, fontWeight: T.fontWeight.semibold, color: T.color.textPrimary }}>{label}</div>
        {sublabel && <div style={{ fontSize: T.fontSize.xs, color: T.color.textMuted, marginTop: "2px" }}>{sublabel}</div>}
      </div>
    </div>
  );
}

// Export everything globally
Object.assign(window, { Button, ProgressBar, ServiceCard, VariationCard, UploadZone, SummaryRow, TextInput, StyleCard });
