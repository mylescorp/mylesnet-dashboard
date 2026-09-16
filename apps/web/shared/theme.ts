"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "mylesnet-dashboard-theme";

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyMode(mode: ThemeMode) {
  const resolved = resolveMode(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode | null>(() => {
    if (typeof window === "undefined") return null;
    return getStoredMode();
  });

  const resolved = mode === null ? "light" : resolveMode(mode);

  useEffect(() => {
    if (mode !== null) applyMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredMode() === "system") {
        applyMode("system");
        setModeState(getStoredMode());
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    applyMode(newMode);
    window.dispatchEvent(new CustomEvent("mylesnet-theme-changed", { detail: newMode }));
  }, []);

  const cycleMode = useCallback(() => {
    const current = mode ?? getStoredMode();
    const modes: ThemeMode[] = ["light", "dark", "system"];
    const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
    setMode(nextMode);
  }, [mode, setMode]);

  return { mode, resolved, setMode, cycleMode };
}

// Legacy exports for compatibility with existing ThemeToggle
export const readStoredThemeMode = getStoredMode;
export const resolveThemeMode = resolveMode;
export const applyThemeMode = applyMode;
export const setThemeMode = (mode: ThemeMode) => {
  localStorage.setItem(STORAGE_KEY, mode);
  applyMode(mode);
  window.dispatchEvent(new CustomEvent("mylesnet-theme-changed", { detail: mode }));
};