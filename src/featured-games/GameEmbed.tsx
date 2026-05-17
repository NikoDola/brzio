import "./GameEmbed.css";

interface GameEmbedProps {
  src: string;
  title: string;
  /** CSS aspect-ratio. Defaults to 16 / 10. Pass to override the default. */
  aspectRatio?: string;
}

export default function GameEmbed({ src, title, aspectRatio }: GameEmbedProps) {
  // Use a CSS custom property so wrapping components can override per breakpoint.
  const style = aspectRatio ? ({ "--game-aspect-ratio": aspectRatio } as React.CSSProperties) : undefined;
  return (
    <div className="game-embed" style={style}>
      <iframe
        src={src}
        title={title}
        className="game-embed-frame"
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
        loading="lazy"
      />
    </div>
  );
}
