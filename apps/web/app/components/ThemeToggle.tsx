"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const storageKey = "mylesnet-dashboard-theme";

function currentMode(): ThemeMode {
  const stored = window.localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
}

function applyMode(mode: ThemeMode) {
  const resolved = resolveMode(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeToggle({ className = "icon-button" }: { className?: string }) {
  // SSR renders the light icon; the real mode is read after mount to avoid a
  // hydration mismatch. Colors are applied before first paint by the no-flash
  // script in the root layout.
  const [mode, setMode] = useState<ThemeMode | null>(() => {
    if (typeof window === "undefined") return null;
    return currentMode();
  });

  const resolved = mode === null ? "light" : resolveMode(mode);

  useEffect(() => {
    if (mode !== null) applyMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (currentMode() === "system") applyMode("system");
      setMode(currentMode());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const cycle = useCallback(() => {
    const current = mode ?? currentMode();
    let next: ThemeMode;
    if (current === "light") next = "dark";
    else if (current === "dark") next = "system";
    else next = "light";
    window.localStorage.setItem(storageKey, next);
    setMode(next);
    applyMode(next);
  }, [mode]);

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
      onClick={cycle}
      className={className}
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}