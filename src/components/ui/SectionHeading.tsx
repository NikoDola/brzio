import { ReactNode } from "react";
import "./SectionHeading.css";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  eyebrowColor?: "green" | "rose";
  size?: "md" | "lg";
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  eyebrowColor = "green",
  size = "md",
}: SectionHeadingProps) {
  const className = [
    "section-heading",
    `section-heading--${align}`,
    `section-heading--${size}`,
    `section-heading--eyebrow-${eyebrowColor}`,
  ].join(" ");

  return (
    <div className={className}>
      {eyebrow && <p className="section-heading__eyebrow">{eyebrow}</p>}
      <h2 className="section-heading__title">{title}</h2>
      {description && (
        <p className="section-heading__description">{description}</p>
      )}
    </div>
  );
}
