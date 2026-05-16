import UnderConstruction from "@/components/sections/UnderConstruction";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/");
}

export default function Home() {
  return <UnderConstruction />;
}
