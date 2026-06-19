import { requireAdmin } from "@/lib/auth/requireAdmin";
import GameEmbed from "./GameEmbed";
import "./PlanetMerge.css";

interface PlanetMergeProps {
  gameSlug: string;
}

export default async function PlanetMerge({ gameSlug }: PlanetMergeProps) {
  const admin = await requireAdmin();
  const src = `/games/${gameSlug}/play.html${admin ? "?dev=1" : ""}`;

  return (
    <div className="planet-merge">
      <div className="planet-merge-frame">
        <GameEmbed
          src={src}
          title="Planet Merge"
          aspectRatio="2 / 3"
        />
      </div>
    </div>
  );
}
