import type { ComponentType } from "react";
import PlanetMerge from "./PlanetMerge";
import GameEmbed from "./GameEmbed";

export interface GameComponentProps {
  gameSlug: string;
}

// Map of post.slug → custom game component.
// Add an entry here when a game needs a custom wrapper (intro, controls panel,
// custom layout). Games without a custom wrapper fall back to the generic embed.
const REGISTRY: Record<string, ComponentType<GameComponentProps>> = {
  "planet-merge": PlanetMerge,
};

export function getGameComponent(slug: string): ComponentType<GameComponentProps> {
  return REGISTRY[slug] ?? DefaultGame;
}

function DefaultGame({ gameSlug }: GameComponentProps) {
  return (
    <GameEmbed
      src={`/games/${gameSlug}/play.html`}
      title={gameSlug}
      aspectRatio="16 / 10"
    />
  );
}
