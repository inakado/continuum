import type { HTMLAttributes } from "react";
import styles from "./surface-card.module.css";

type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  tone?: "panel" | "section" | "inset";
};

function SurfaceCard({
  as = "section",
  tone = "panel",
  className = "",
  ...props
}: SurfaceCardProps) {
  const Component = as;
  return <Component className={[styles.surface, styles[tone], className].filter(Boolean).join(" ")} {...props} />;
}

export function SectionCard(props: Omit<SurfaceCardProps, "tone">) {
  return <SurfaceCard tone="section" {...props} />;
}
