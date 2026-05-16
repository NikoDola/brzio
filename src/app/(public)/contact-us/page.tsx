import ContactPage from "@/featured/ContactPage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/contact-us");
}

export default function ContactRoute() {
  return <ContactPage />;
}
