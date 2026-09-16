import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "status-pill-success",
  warning: "status-pill-warning",
  danger: "status-pill-danger",
  neutral: "status-pill-neutral",
};

export function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`status-pill ${toneClass[tone] ?? ""}`}>{children}</span>
  );
}
