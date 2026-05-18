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

      <details className="planet-merge-meta">
        <summary>How to play & controls</summary>
        <div className="planet-merge-meta-grid">
          <div className="planet-merge-meta-block">
            <h3>How to Play</h3>
            <p>
              Drag and drop matching planets to merge them into bigger ones.
              Chain merges to score combos and discover the largest body in the system.
            </p>
          </div>
          <div className="planet-merge-meta-block">
            <h3>Controls</h3>
            <ul>
              <li><strong>Mouse / Touch</strong> — drag to aim, release to drop</li>
              <li><strong>R</strong> — restart</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
