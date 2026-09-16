import type { ComponentType } from "react";

export type ThemeMode = "light" | "dark" | "system";

export type AsyncState =
  | "idle"
  | "loading"
  | "refreshing"
  | "submitting"
  | "success"
  | "empty"
  | "error"
  | "retrying"
  | "permissionDenied"
  | "offline"
  | "stale"
  | "partial";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export interface NavItem {
  href: string;
  label: string;
  icon?: ComponentType<{ size?: number; "aria-hidden"?: "true" | boolean; className?: string }>;
  exact?: boolean;
  badge?: number;
  planned?: boolean;
  permission?: string;
  description?: string;
}

export interface NavModule {
  id: string;
  label: string;
  permission?: string;
  items: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  permission?: string;
}

export interface NavViewBinding {
  prefix: string;
  moduleIds: string[];
}

export interface RouteIndexItem {
  href: string;
  label: string;
  group: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export type ToastVariant = "default" | "success" | "warning" | "danger" | "info";