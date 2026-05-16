import OurClientsPage from "@/featured/OurClientsPage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/our-work");
}

export default function OurWorkRoute() {
  return <OurClientsPage />;
}
