// Server-side pricing. The client wizard shows the same numbers for UX,
// but this file is the source of truth for what Stripe actually charges.
// All values in whole dollars; convert to cents at the Stripe boundary.

const LOGO_BASE = 150;
const LOGO_VARIATION_EXTRA = 25;
const VARIATIONS_MAX = 4;
const CUSTOM_TYPO_MAX = 500;
const LOGO_COUPON = { code: "ANETA SH", discount: 84 };

const WEBSITE_BASE_CORPORATE = 400;
const WEBSITE_BASE_ECOMMERCE = 640; // BASE + 3 default ecom pages × 80
const WEBSITE_PRICE_PER_PAGE = 80;
const WEBSITE_FREE_PAGES = new Set(["Home", "About", "Contact", "Showcase", "Services"]);
const WEBSITE_DOMAIN_PRICE = 40;
const WEBSITE_HOSTING_PRICE = 240;
const WEBSITE_MAINTENANCE_PRICE = 300;
const WEBSITE_PAGES_MAX = 30;
const WEBSITE_COUPON = { code: "ANETACH", discount: 200 };

function deposit(total: number): number {
  return Math.round((total * 0.35) / 5) * 5;
}

function clampCoupon(applied: boolean, code: string | undefined, expected: { code: string; discount: number }): number {
  if (!applied) return 0;
  if (!code || code.trim().toUpperCase() !== expected.code) return 0;
  return expected.discount;
}

export type PriceResult = { dueNow: number; total: number };

export function priceLogoOrder(input: {
  variations?: unknown;
  typographyType?: unknown;
  customPrice?: unknown;
  couponApplied?: unknown;
  couponCode?: unknown;
  payOption?: unknown;
}): PriceResult {
  const variations = Array.isArray(input.variations) ? input.variations.slice(0, VARIATIONS_MAX) : [];
  const extras = Math.max(0, variations.length - 1) * LOGO_VARIATION_EXTRA;

  const isCustomTypo = input.typographyType === "custom";
  const rawCustom = typeof input.customPrice === "number" ? input.customPrice : 0;
  const typo = isCustomTypo ? Math.max(0, Math.min(rawCustom, CUSTOM_TYPO_MAX)) : 0;

  const discount = clampCoupon(input.couponApplied === true, input.couponCode as string | undefined, LOGO_COUPON);
  const total = Math.max(0, LOGO_BASE + extras + typo - discount);
  const dueNow = input.payOption === "full" ? total : deposit(total);
  return { dueNow, total };
}

export function priceWebsiteOrder(input: {
  siteType?: unknown;
  pagesMode?: unknown;
  pages?: unknown;
  domainMode?: unknown;
  hostingMode?: unknown;
  maintenance?: unknown;
  couponApplied?: unknown;
  couponCode?: unknown;
  payOption?: unknown;
}): PriceResult {
  const siteType = input.siteType === "ecommerce" ? "ecommerce" : "corporate";
  const base = siteType === "ecommerce" ? WEBSITE_BASE_ECOMMERCE : WEBSITE_BASE_CORPORATE;

  let pagesCost = 0;
  if (input.pagesMode === "manual" && Array.isArray(input.pages)) {
    const safePages = (input.pages as unknown[]).filter((p): p is string => typeof p === "string").slice(0, WEBSITE_PAGES_MAX);
    pagesCost = safePages.filter((p) => !WEBSITE_FREE_PAGES.has(p)).length * WEBSITE_PRICE_PER_PAGE;
  }

  const extras =
    (input.domainMode === "new" ? WEBSITE_DOMAIN_PRICE : 0) +
    (input.hostingMode === "new" ? WEBSITE_HOSTING_PRICE : 0) +
    (input.maintenance === true ? WEBSITE_MAINTENANCE_PRICE : 0);

  const discount = clampCoupon(input.couponApplied === true, input.couponCode as string | undefined, WEBSITE_COUPON);
  const total = Math.max(0, base + pagesCost + extras - discount);
  const dueNow = input.payOption === "full" ? total : deposit(total);
  return { dueNow, total };
}
