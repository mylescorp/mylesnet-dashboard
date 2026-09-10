import type { ReactNode } from "react";

type SectionHeadProps = {
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
};

export default function SectionHead({ kicker, title, subtitle, align = "center" }: SectionHeadProps) {
  const classes = ["landing-section-head"];
  if (align === "center") classes.push("landing-section-head-center");
  if (align === "left") classes.push("landing-section-head-left");

  return (
    <div className={classes.join(" ")}>
      <p className="landing-section-kicker">{kicker}</p>
      <h2 className="landing-section-title">{title}</h2>
      {subtitle ? <p className="landing-section-subtitle">{subtitle}</p> : null}
    </div>
  );
}