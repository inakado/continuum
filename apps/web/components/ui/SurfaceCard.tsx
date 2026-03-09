import type { HTMLAttributes } from "react";
import styles from "./surface-card.module.css";

type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  tone?: "panel" | "section" | "inset";
};

export default function SurfaceCard({
  as = "section",
  tone = "panel",
  className = "",
  ...props
}: SurfaceCardProps) {
  const Component = as;
  return <Component className={[styles.surface, styles[tone], className].filter(Boolean).join(" ")} {...props} />;
}

export function PanelCard(props: Omit<SurfaceCardProps, "tone">) {
  return <SurfaceCard tone="panel" {...props} />;
}

export function SectionCard(props: Omit<SurfaceCardProps, "tone">) {
  return <SurfaceCard tone="section" {...props} />;
}

export function InsetCard(props: Omit<SurfaceCardProps, "tone">) {
  return <SurfaceCard tone="inset" {...props} />;
}
