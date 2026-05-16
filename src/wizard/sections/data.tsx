import type { BrandService, FontDef } from "./types"

export const VARIATION_LABELS: Record<string, string> = {
  vertical:   "Vertical Logo",
  horizontal: "Horizontal Logo",
  badge:      "Badge / Seal Logo",
  icon:       "Icon Only",
  wordmark:   "Wordmark",
}

export const BRAND_SERVICES: BrandService[] = [
  { id: "safezone",    label: "Logo Safe Zone Instructions",   perVariation: true,  tooltip: "Defines the minimum clear space around your logo so it always looks clean." },
  { id: "aspectratio", label: "Aspect Ratio Guidelines",      perVariation: true,  tooltip: "Documents the correct proportions for every logo version so it scales perfectly." },
  { id: "mockups",     label: "3D Mockups",                   perVariation: true,  tooltip: "Photorealistic renders of your logo on real-world objects." },
  { id: "nouselogo",   label: "How Not to Use the Logo",      perVariation: true,  tooltip: "A visual guide showing common misuses — stretching, wrong colors, busy backgrounds." },
  { id: "mono",        label: "Mono Color Version",           perVariation: true,  tooltip: "A single-color version of every logo variation, essential for embroidery and stamps." },
  { id: "colors",      label: "Color Usage Guidelines",       perVariation: false, tooltip: "Documents your exact brand colors with HEX, RGB, CMYK, and Pantone codes." },
  { id: "fonts",       label: "Typography Guidelines",        perVariation: false, tooltip: "Specifies your brand fonts with hierarchy rules and sizing guidance." },
  { id: "usage",       label: "Brand Usage Examples",         perVariation: false, tooltip: "Real-world examples showing how the logo, colors, and type work together." },
  { id: "backgrounds", label: "Light & Dark Background Rules",perVariation: false, tooltip: "Shows which logo version to use on light, dark, and colored backgrounds." },
  { id: "pattern",     label: "Brand Pattern / Texture",      perVariation: false, tooltip: "A custom repeating pattern derived from your logo mark." },
]

export const COLOR_FAMILIES = [
  { id: "designer", label: "Designer's Choice", sublabel: "Curated modern palette",   colors: ["#1E2D40","#E85D4A","#4A9E8A","#F0C060","#7B5EA7","#E8A598","#2C5F6E","#F5EFE0","#B5714A"] },
  { id: "reds",     label: "Reds",              sublabel: "Crimson to blush",          colors: ["#6B0F1A","#A31621","#CC2936","#E05252","#EA7F7F","#F2AAAA","#FAD4D4","#FDEAEA","#FFF5F5"] },
  { id: "blues",    label: "Blues",             sublabel: "Navy to sky",               colors: ["#0C1E3D","#1A3A8F","#2255CC","#4A80E0","#6B9EED","#93BDF5","#C5DAFC","#E3EEFF","#F0F6FF"] },
  { id: "greens",   label: "Greens",            sublabel: "Forest to mint",            colors: ["#0B3D2E","#165A42","#1E7A55","#2EA876","#4DC499","#7EDAB9","#B4EDD9","#DAFAEF","#F0FDF8"] },
  { id: "oranges",  label: "Oranges",           sublabel: "Amber to peach",            colors: ["#7A2800","#B03800","#E04A00","#F06A20","#F5904C","#F9B480","#FDD5B4","#FEEDDF","#FFF8F3"] },
  { id: "pinks",    label: "Pinks",             sublabel: "Hot pink to blush",         colors: ["#8B0050","#C0106E","#E8258C","#F05AAA","#F588C4","#F9B5DC","#FCDDF0","#FEF0F8","#FFF8FD"] },
  { id: "purples",  label: "Purples",           sublabel: "Deep violet to lavender",   colors: ["#2A0A4F","#4A1080","#7B2FC4","#A055E0","#BE88F2","#D8B4FA","#EDD9FF","#F7EEFF","#FCF8FF"] },
  { id: "browns",   label: "Browns",            sublabel: "Espresso to sand",          colors: ["#2C1505","#4E2309","#7A3B10","#A05A2C","#C47F4E","#D9A87C","#EDD3B5","#F7EAD8","#FDF6EE"] },
  { id: "neutrals", label: "Neutrals",          sublabel: "Black to white",            colors: ["#080808","#1F1F1F","#3A3A3A","#5C5C5C","#808080","#A3A3A3","#C8C8C8","#E4E4E4","#FFFFFF"] },
]

export const FONT_CATEGORIES: Record<string, { label: string; fonts: FontDef[] }> = {
  serif: {
    label: "Serif",
    fonts: [
      { id: "playfair",     name: "Playfair Display",   family: "'Playfair Display', serif",   weight: 700, sample: "Elegant & Timeless" },
      { id: "lora",         name: "Lora",               family: "'Lora', serif",               weight: 600, sample: "Warm & Readable" },
      { id: "merriweather", name: "Merriweather",       family: "'Merriweather', serif",       weight: 700, sample: "Solid & Dependable" },
      { id: "cormorant",    name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", weight: 600, sample: "Refined & Delicate" },
      { id: "ebgaramond",   name: "EB Garamond",        family: "'EB Garamond', serif",        weight: 700, sample: "Classic & Literary" },
      { id: "baskerville",  name: "Libre Baskerville",  family: "'Libre Baskerville', serif",  weight: 700, sample: "Strong & Editorial" },
      { id: "crimson",      name: "Crimson Text",       family: "'Crimson Text', serif",       weight: 700, sample: "Rich & Bookish" },
      { id: "sourceserif",  name: "Source Serif 4",     family: "'Source Serif 4', serif",     weight: 700, sample: "Neutral & Versatile" },
      { id: "spectral",     name: "Spectral",           family: "'Spectral', serif",           weight: 700, sample: "Crisp & Digital" },
      { id: "bitter",       name: "Bitter",             family: "'Bitter', serif",             weight: 700, sample: "Punchy & Slab" },
      { id: "arvo",         name: "Arvo",               family: "'Arvo', serif",               weight: 700, sample: "Geometric Slab" },
      { id: "ptserif",      name: "PT Serif",           family: "'PT Serif', serif",           weight: 700, sample: "Workhorse Classic" },
      { id: "vollkorn",     name: "Vollkorn",           family: "'Vollkorn', serif",           weight: 700, sample: "Dark & Sturdy" },
      { id: "alegreya",     name: "Alegreya",           family: "'Alegreya', serif",           weight: 700, sample: "Literary & Flowing" },
    ],
  },
  sans: {
    label: "Sans-Serif",
    fonts: [
      { id: "outfit",       name: "Outfit",             family: "'Outfit', sans-serif",           weight: 700, sample: "Modern & Geometric" },
      { id: "jakarta",      name: "Plus Jakarta Sans",  family: "'Plus Jakarta Sans', sans-serif", weight: 700, sample: "Friendly & Clean" },
      { id: "raleway",      name: "Raleway",            family: "'Raleway', sans-serif",          weight: 700, sample: "Sleek & Stylish" },
      { id: "nunito",       name: "Nunito",             family: "'Nunito', sans-serif",           weight: 700, sample: "Rounded & Warm" },
      { id: "josefin",      name: "Josefin Sans",       family: "'Josefin Sans', sans-serif",     weight: 700, sample: "Geometric & Minimal" },
      { id: "poppins",      name: "Poppins",            family: "'Poppins', sans-serif",          weight: 700, sample: "Trendy & Bubbly" },
      { id: "montserrat",   name: "Montserrat",         family: "'Montserrat', sans-serif",       weight: 700, sample: "Strong & Versatile" },
      { id: "worksans",     name: "Work Sans",          family: "'Work Sans', sans-serif",        weight: 700, sample: "Practical & Clean" },
      { id: "barlow",       name: "Barlow",             family: "'Barlow', sans-serif",           weight: 700, sample: "Condensed & Bold" },
      { id: "manrope",      name: "Manrope",            family: "'Manrope', sans-serif",          weight: 700, sample: "Sharp & Technical" },
      { id: "rubik",        name: "Rubik",              family: "'Rubik', sans-serif",            weight: 700, sample: "Playful & Rounded" },
      { id: "urbanist",     name: "Urbanist",           family: "'Urbanist', sans-serif",         weight: 700, sample: "City & Contemporary" },
      { id: "sora",         name: "Sora",               family: "'Sora', sans-serif",             weight: 700, sample: "Clean & Techy" },
      { id: "figtree",      name: "Figtree",            family: "'Figtree', sans-serif",          weight: 700, sample: "Friendly & Modern" },
    ],
  },
  handwriting: {
    label: "Handwriting",
    fonts: [
      { id: "pacifico",   name: "Pacifico",        family: "'Pacifico', cursive",       weight: 400, sample: "Playful & Retro" },
      { id: "dancing",    name: "Dancing Script",  family: "'Dancing Script', cursive", weight: 700, sample: "Flowing & Elegant" },
      { id: "satisfy",    name: "Satisfy",         family: "'Satisfy', cursive",        weight: 400, sample: "Casual & Charming" },
      { id: "greatvibes", name: "Great Vibes",     family: "'Great Vibes', cursive",    weight: 400, sample: "Romantic & Script" },
      { id: "caveat",     name: "Caveat",          family: "'Caveat', cursive",         weight: 700, sample: "Authentic & Human" },
      { id: "kaushan",    name: "Kaushan Script",  family: "'Kaushan Script', cursive", weight: 400, sample: "Bold & Expressive" },
      { id: "sacramento", name: "Sacramento",      family: "'Sacramento', cursive",     weight: 400, sample: "Thin & Delicate" },
      { id: "allura",     name: "Allura",          family: "'Allura', cursive",         weight: 400, sample: "Graceful & Formal" },
      { id: "lobster",    name: "Lobster",         family: "'Lobster', cursive",        weight: 400, sample: "Fun & Retro" },
    ],
  },
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export const STYLE_PRESETS = [
  {
    id: "minimalist", label: "Minimalist", sublabel: "Clean, lots of space",
    preview: (accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#F8F7F4"/>
        <rect x="55" y="38" width="50" height="50" rx="4" fill="#1A1714" opacity="0.08"/>
        <rect x="65" y="48" width="30" height="30" rx="2" fill="#1A1714" opacity="0.15"/>
        <rect x="45" y="98" width="70" height="5" rx="2.5" fill="#1A1714" opacity="0.1"/>
      </svg>
    ),
  },
  {
    id: "bold-geometric", label: "Bold & Geometric", sublabel: "Strong shapes, high contrast",
    preview: (accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#1A1714"/>
        <polygon points="80,22 118,82 42,82" fill={accent} opacity="0.9"/>
        <rect x="30" y="92" width="100" height="8" rx="2" fill="#fff" opacity="0.85"/>
      </svg>
    ),
  },
  {
    id: "vintage", label: "Vintage / Retro", sublabel: "Ornate, heritage feel",
    preview: (_accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#F5EFE4"/>
        <rect x="20" y="15" width="120" height="90" rx="3" fill="none" stroke="#8B6F47" strokeWidth="1.5"/>
        <circle cx="80" cy="52" r="20" fill="none" stroke="#8B6F47" strokeWidth="1.5"/>
        <circle cx="80" cy="52" r="14" fill="#8B6F47" opacity="0.12"/>
        <rect x="38" y="80" width="84" height="5" rx="1" fill="#8B6F47" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id: "playful", label: "Playful", sublabel: "Rounded, expressive",
    preview: (accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#FFF8F4"/>
        <circle cx="80" cy="50" r="28" fill={accent} opacity="0.18"/>
        <circle cx="80" cy="50" r="18" fill={accent} opacity="0.7"/>
        <circle cx="72" cy="44" r="4" fill="#fff"/>
        <circle cx="88" cy="44" r="4" fill="#fff"/>
        <path d="M72 56 Q80 64 88 56" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    id: "luxury", label: "Luxury", sublabel: "Thin lines, premium",
    preview: (_accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#0F0E0C"/>
        <polygon points="80,26 102,66 58,66" fill="none" stroke="#C9A96E" strokeWidth="1"/>
        <line x1="20" y1="78" x2="60" y2="78" stroke="#C9A96E" strokeWidth="0.8" opacity="0.6"/>
        <line x1="100" y1="78" x2="140" y2="78" stroke="#C9A96E" strokeWidth="0.8" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: "tech", label: "Tech / Digital", sublabel: "Grid-based, modern",
    preview: (accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#0D1117"/>
        <rect x="56" y="36" width="48" height="48" rx="4" fill={accent} opacity="0.15" stroke={accent} strokeWidth="1"/>
        <text x="80" y="67" textAnchor="middle" fontSize="20" fontWeight="800" fill={accent} fontFamily="monospace">{"</>"}</text>
      </svg>
    ),
  },
  {
    id: "organic", label: "Organic / Natural", sublabel: "Flowing, earthy",
    preview: (_accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#F2F0EB"/>
        <path d="M80 20 C100 30 115 50 108 70 C100 90 60 95 50 75 C38 55 55 25 80 20Z" fill="#4A7C59" opacity="0.2"/>
        <path d="M80 30 C95 38 106 54 100 70 C93 85 65 88 57 72 C47 56 60 33 80 30Z" fill="#4A7C59" opacity="0.35"/>
      </svg>
    ),
  },
  {
    id: "corporate", label: "Corporate / Classic", sublabel: "Professional, timeless",
    preview: (_accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#F7F8FA"/>
        <rect x="60" y="22" width="40" height="50" rx="3" fill="#1A3A5C" opacity="0.12"/>
        <rect x="66" y="28" width="28" height="28" rx="2" fill="#1A3A5C" opacity="0.25"/>
        <rect x="20" y="78" width="120" height="2" fill="#1A3A5C" opacity="0.12"/>
      </svg>
    ),
  },
  {
    id: "handcrafted", label: "Hand-crafted", sublabel: "Artisan, textured",
    preview: (_accent: string) => (
      <svg width="100%" viewBox="0 0 160 120" fill="none">
        <rect width="160" height="120" fill="#F9F4EE"/>
        <path d="M80 25 C85 25 90 28 92 33 C97 31 103 33 104 39 C109 39 113 44 111 50 C115 53 115 60 111 63 C113 69 110 75 104 76 C103 82 97 85 92 83 C90 88 85 90 80 90 C75 90 70 88 68 83 C63 85 57 82 56 76 C50 75 47 69 49 63 C45 60 45 53 49 50 C47 44 51 39 56 39 C57 33 63 31 68 33 C70 28 75 25 80 25Z" fill="none" stroke="#8B6F47" strokeWidth="1.2" opacity="0.5"/>
        <text x="80" y="63" textAnchor="middle" fontSize="11" fontWeight="600" fill="#8B6F47" fontFamily="serif">CRAFT</text>
      </svg>
    ),
  },
]
/* eslint-enable @typescript-eslint/no-unused-vars */
