import AboutPage from "@/featured/AboutPage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/about-us");
}

export default function AboutRoute() {
  return <AboutPage />;
}
