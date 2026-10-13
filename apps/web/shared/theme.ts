"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
const getServerMode = (): ThemeMode => "system";

const COOKIE_NAME = "__mylesnet_theme";
const LEGACY_STORAGE_KEY = "mylesnet-dashboard-theme";

function persistMode(mode: ThemeMode): boolean {
  // The theme cookie is intentionally readable by client code for pre-paint theme selection.
  try {
    document.cookie = `${COOKIE_NAME}=${mode}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`;
    const cookieSaved = document.cookie.split("; ").some((cookie) => cookie === `${COOKIE_NAME}=${mode}`);
    if (cookieSaved) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return true;
    }
  } catch {
    // Fall back to local storage when cookies are unavailable or blocked.
  }
  try {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, mode);
  } catch {
    // The theme still applies for this session when all browser storage is blocked.
  }
  return false;
}

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))?.split("=")[1];
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "light" || legacy === "dark" || legacy === "system") {
      if (persistMode(legacy)) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return legacy;
    }
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  return "system";
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
  const subscribe = useCallback((notify: () => void) => {
    const onChange = () => notify();
    window.addEventListener("storage", onChange);
    window.addEventListener("mylesnet-theme-changed", onChange);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("mylesnet-theme-changed", onChange);
      media.removeEventListener("change", onChange);
    };
  }, []);
  const mode = useSyncExternalStore(subscribe, getStoredMode, getServerMode);
  const resolved = mode === "system" && typeof window === "undefined" ? "light" : resolveMode(mode);

  const setMode = useCallback((newMode: ThemeMode) => {
    persistMode(newMode);
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
  persistMode(mode);
  applyMode(mode);
  window.dispatchEvent(new CustomEvent("mylesnet-theme-changed", { detail: mode }));
};
