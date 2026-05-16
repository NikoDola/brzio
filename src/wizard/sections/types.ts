export type ServiceType = "design" | "redesign" | "website" | null
export type Screen =
  | "service" | "brand-info" | "upload"
  | "style-red" | "variations" | "style-icon"
  | "typography" | "colors" | "summary"
  | "website-coming-soon" | "website-info" | "website-type" | "website-pages"
  | "website-style" | "website-colors" | "website-fonts" | "website-extras" | "website-summary"

export interface WebsiteInfo {
  companyName:   string
  existingUrl?:  string
  industry?:     string
  description?:  string
  logoFile?:     File | null
}

export interface WebsiteTypeInfo {
  siteType: "corporate" | "ecommerce"
}

export interface WebsitePagesInfo {
  mode: "developer" | "manual"
  pages: string[]
}

export interface WebsiteStyleInfo {
  links:  string[]
  images: File[]
}

export interface WebsiteColorsInfo {
  colorFamilies:      string[]
  customColors:       string[]
  useExistingWebsite: boolean
  useExistingLogo:    boolean
}

export interface WebsiteFontsInfo {
  mode:          "designer" | "collection"
  selectedFonts: string[]
  fontLinks:     string[]
}

export interface WebsiteExtrasInfo {
  domainMode:      "own" | "new"
  domainName:      string
  hostingMode:     "own" | "new"
  hostingProvider: string
  maintenance:     boolean
}

export interface Order {
  serviceType:    ServiceType
  variations:     string[]
  companyName?:   string
  tagline?:       string
  description?:   string
  styles?:        string[]
  pinterestUrl?:  string
  typographyType?:  "custom" | "free" | null
  customPrice?:     number
  selectedFonts?:   string[]
  fontLinks?:       string[]
  sameBrandFont?:   boolean
  colorFamilies?:   string[]
  customColors?:    string[]
  useSameColors?:   boolean
}

export interface FontDef {
  id:       string
  name:     string
  family:   string
  weight:   number
  sample:   string
  sublabel?: string
}

export interface BrandService {
  id:           string
  label:        string
  perVariation: boolean
  tooltip:      string
}
