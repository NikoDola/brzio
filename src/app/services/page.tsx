import LogoConfigurator from "@/wizard/sections/LogoConfigurator";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/services");
}

export default function ServicesPage() {
  return <LogoConfigurator />;
}
