import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names safely, deferring to later declarations. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { clsx, twMerge };

/** Storage key helpers for the shared shell's persisted preferences. */
export const shellStorageKeys = {
  sidebar: "mylesnet-shell-sidebar-collapsed",
  theme: "mylesnet-dashboard-theme",
} as const;

export function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(shellStorageKeys.sidebar) === "1";
  } catch {
    return false;
  }
}

export function writeStoredSidebarCollapsed(value: boolean): void {
  try {
    localStorage.setItem(shellStorageKeys.sidebar, value ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
