import CookiePolicyPage from "@/featured/CookiePolicyPage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/cookie-policy");
}

export default function CookiePolicyRoute() {
  return <CookiePolicyPage />;
}
