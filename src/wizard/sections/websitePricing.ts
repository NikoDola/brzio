export const FREE_PAGES      = new Set(["Home", "About", "Contact", "Showcase", "Services"])
export const BASE_PRICE      = 400
export const PRICE_PER_PAGE  = 80

export function calcWebsitePrice(selected: string[]): number {
  return BASE_PRICE + selected.filter(p => !FREE_PAGES.has(p)).length * PRICE_PER_PAGE
}
