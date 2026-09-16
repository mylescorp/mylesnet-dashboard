"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className = "icon-button" }: { className?: string }) {
  const { mode, resolved, cycleMode } = useTheme();

  const label =
    mode === "dark"
      ? "Use dark theme (click for system, light)"
      : mode === "system"
        ? "Use system theme (click for light)"
        : "Use light theme (click for dark, system)";

  const Icon = resolved === "dark" ? Sun : mode === "system" ? Laptop : Moon;

  return (
    <button
      type="button"
      onClick={cycleMode}
      className={className}
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}