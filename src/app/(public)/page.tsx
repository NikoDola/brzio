import HomePage from "@/featured/HomePage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/");
}

export default function Home() {
  return <HomePage />;
}
