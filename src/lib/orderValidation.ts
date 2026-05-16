// Sanitizes incoming /api/create-checkout request bodies.
// Returns a clean object with only known fields, capped lengths,
// and basic type coercion. Anything unknown is dropped silently.

const SHORT = 200;
const LONG = 2000;
const MAX_ARRAY = 50;
const MAX_URL = 500;

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

function strOrUndef(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.slice(0, max).trim();
  return s.length ? s : undefined;
}

function strArr(v: unknown, max: number, perItemMax: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .slice(0, max)
    .map((x) => x.slice(0, perItemMax).trim())
    .filter(Boolean);
}

function bool(v: unknown): boolean {
  return v === true;
}

function num(v: unknown, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return Math.min(v, max);
}

function fileMeta(v: unknown): { name: string; size: number; type: string } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    name: str(o.name, 200),
    size: typeof o.size === "number" && o.size >= 0 ? Math.min(o.size, 100 * 1024 * 1024) : 0,
    type: str(o.type, 100),
  };
}

export interface CleanCheckoutInput {
  clientName: string;
  clientEmail: string;
  payOption: "deposit" | "full";
  couponApplied: boolean;
  couponCode: string;
  serviceType: "logo" | "redesign" | "website";
  order: CleanLogoOrder | null;
  websiteInfo: CleanWebsiteInfo | null;
  websiteTypeInfo: { siteType: "corporate" | "ecommerce" } | null;
  websitePagesInfo: { mode: "developer" | "manual"; pages: string[] } | null;
  websiteStyleInfo: { links: string[] } | null;
  websiteColorsInfo: CleanColors | null;
  websiteFontsInfo: { mode: "designer" | "collection"; selectedFonts: string[]; fontLinks: string[] } | null;
  websiteExtrasInfo: CleanExtras | null;
  fileMetadata: Record<string, unknown> | null;
}

export interface CleanLogoOrder {
  serviceType: "design" | "redesign";
  variations: string[];
  companyName?: string;
  tagline?: string;
  description?: string;
  styles: string[];
  pinterestUrl?: string;
  typographyType: "custom" | "free" | null;
  customPrice?: number;
  selectedFonts: string[];
  fontLinks: string[];
  sameBrandFont: boolean;
  colorFamilies: string[];
  customColors: string[];
  useSameColors: boolean;
}

export interface CleanWebsiteInfo {
  companyName?: string;
  existingUrl?: string;
  industry?: string;
  description?: string;
}

export interface CleanColors {
  colorFamilies: string[];
  customColors: string[];
  useExistingWebsite: boolean;
  useExistingLogo: boolean;
}

export interface CleanExtras {
  domainMode: "own" | "new";
  domainName?: string;
  hostingMode: "own" | "new";
  hostingProvider?: string;
  maintenance: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeCheckoutInput(raw: unknown): { ok: true; data: CleanCheckoutInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request body." };
  const b = raw as Record<string, unknown>;

  const clientName = str(b.clientName, 100);
  if (!clientName) return { ok: false, error: "Name is required." };

  const clientEmail = str(b.clientEmail, 100);
  if (!EMAIL_RE.test(clientEmail)) return { ok: false, error: "Valid email is required." };

  const isWebsite = b.serviceType === "website" || b.websiteInfo !== undefined;
  const orderRaw = (b.order && typeof b.order === "object") ? b.order as Record<string, unknown> : null;

  const serviceType: CleanCheckoutInput["serviceType"] =
    isWebsite ? "website" : orderRaw?.serviceType === "redesign" ? "redesign" : "logo";

  const data: CleanCheckoutInput = {
    clientName,
    clientEmail,
    payOption: b.payOption === "full" ? "full" : "deposit",
    couponApplied: bool(b.couponApplied),
    couponCode: str(b.couponCode, 50),
    serviceType,
    order: null,
    websiteInfo: null,
    websiteTypeInfo: null,
    websitePagesInfo: null,
    websiteStyleInfo: null,
    websiteColorsInfo: null,
    websiteFontsInfo: null,
    websiteExtrasInfo: null,
    fileMetadata: null,
  };

  if (!isWebsite && orderRaw) {
    data.order = {
      serviceType: orderRaw.serviceType === "redesign" ? "redesign" : "design",
      variations: strArr(orderRaw.variations, 4, 30),
      companyName: strOrUndef(orderRaw.companyName, SHORT),
      tagline: strOrUndef(orderRaw.tagline, SHORT),
      description: strOrUndef(orderRaw.description, LONG),
      styles: strArr(orderRaw.styles, 10, 30),
      pinterestUrl: strOrUndef(orderRaw.pinterestUrl, MAX_URL),
      typographyType: orderRaw.typographyType === "custom" ? "custom"
        : orderRaw.typographyType === "free" ? "free" : null,
      customPrice: num(orderRaw.customPrice, 500),
      selectedFonts: strArr(orderRaw.selectedFonts, MAX_ARRAY, 50),
      fontLinks: strArr(orderRaw.fontLinks, 10, MAX_URL),
      sameBrandFont: bool(orderRaw.sameBrandFont),
      colorFamilies: strArr(orderRaw.colorFamilies, MAX_ARRAY, 30),
      customColors: strArr(orderRaw.customColors, 20, 10),
      useSameColors: bool(orderRaw.useSameColors),
    };
  }

  if (isWebsite) {
    const wi = (b.websiteInfo && typeof b.websiteInfo === "object") ? b.websiteInfo as Record<string, unknown> : {};
    data.websiteInfo = {
      companyName: strOrUndef(wi.companyName, SHORT),
      existingUrl: strOrUndef(wi.existingUrl, MAX_URL),
      industry: strOrUndef(wi.industry, SHORT),
      description: strOrUndef(wi.description, LONG),
    };

    const wt = (b.websiteTypeInfo && typeof b.websiteTypeInfo === "object") ? b.websiteTypeInfo as Record<string, unknown> : {};
    data.websiteTypeInfo = {
      siteType: wt.siteType === "ecommerce" ? "ecommerce" : "corporate",
    };

    const wp = (b.websitePagesInfo && typeof b.websitePagesInfo === "object") ? b.websitePagesInfo as Record<string, unknown> : {};
    data.websitePagesInfo = {
      mode: wp.mode === "developer" ? "developer" : "manual",
      pages: strArr(wp.pages, 30, 50),
    };

    const ws = (b.websiteStyleInfo && typeof b.websiteStyleInfo === "object") ? b.websiteStyleInfo as Record<string, unknown> : {};
    data.websiteStyleInfo = {
      links: strArr(ws.links, 20, MAX_URL),
    };

    const wc = (b.websiteColorsInfo && typeof b.websiteColorsInfo === "object") ? b.websiteColorsInfo as Record<string, unknown> : {};
    data.websiteColorsInfo = {
      colorFamilies: strArr(wc.colorFamilies, MAX_ARRAY, 30),
      customColors: strArr(wc.customColors, 20, 10),
      useExistingWebsite: bool(wc.useExistingWebsite),
      useExistingLogo: bool(wc.useExistingLogo),
    };

    const wf = (b.websiteFontsInfo && typeof b.websiteFontsInfo === "object") ? b.websiteFontsInfo as Record<string, unknown> : {};
    data.websiteFontsInfo = {
      mode: wf.mode === "collection" ? "collection" : "designer",
      selectedFonts: strArr(wf.selectedFonts, MAX_ARRAY, 50),
      fontLinks: strArr(wf.fontLinks, 10, MAX_URL),
    };

    const we = (b.websiteExtrasInfo && typeof b.websiteExtrasInfo === "object") ? b.websiteExtrasInfo as Record<string, unknown> : {};
    data.websiteExtrasInfo = {
      domainMode: we.domainMode === "new" ? "new" : "own",
      domainName: strOrUndef(we.domainName, SHORT),
      hostingMode: we.hostingMode === "new" ? "new" : "own",
      hostingProvider: strOrUndef(we.hostingProvider, SHORT),
      maintenance: bool(we.maintenance),
    };
  }

  if (b.fileMetadata && typeof b.fileMetadata === "object") {
    const fm = b.fileMetadata as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const key of ["logo", "inspiration"]) {
      if (fm[key]) cleaned[key] = fileMeta(fm[key]);
    }
    if (Array.isArray(fm.styleImages)) {
      cleaned.styleImages = fm.styleImages.slice(0, 10).map(fileMeta).filter(Boolean);
    }
    data.fileMetadata = cleaned;
  }

  return { ok: true, data };
}
