import { getTeam } from "@/lib/content";
import OurTeamPage from "@/featured/OurTeamPage";
import { metadataForRoute } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForRoute("/our-team");
}

export default async function OurTeamRoute() {
  const team = await getTeam();
  return <OurTeamPage team={team} />;
}
