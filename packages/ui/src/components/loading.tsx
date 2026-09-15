"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export interface BillingLogoLoaderProps {
  size?: number | string;
  className?: string;
  variant?: "default" | "page" | "inline" | "skeleton";
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * MylesNet billing logo loader with reduced-motion support.
 * Uses the production logo from apps/web/public/brand/mylesnet-logo.png
 */
export function BillingLogoLoader({ 
  size = 24, 
  className, 
  variant = "default",
  "aria-hidden": ariaHidden = true 
}: BillingLogoLoaderProps) {
  return (
    <div 
      className={cn("mn-logo-loader", `mn-logo-loader-${variant}`, className)}
      style={{ width: typeof size === "number" ? `${size}px` : size, height: typeof size === "number" ? `${size}px` : size }}
      aria-hidden={ariaHidden}
      role="status"
      aria-label="Loading"
    >
      <div className="mn-logo-spinner" />
    </div>
  );
}

export interface FullPageLoaderProps {
  title?: string;
  message?: string;
  className?: string;
}

/**
 * Full-page loading state with logo and messaging.
 * Used during initial app load or major transitions.
 */
export function FullPageLoader({ title = "Loading", message, className }: FullPageLoaderProps) {
  return (
    <div className={cn("mn-full-page-loader", className)} role="status" aria-live="polite">
      <div className="mn-full-page-loader-content">
        <BillingLogoLoader size={64} variant="page" aria-hidden="true" />
        <h1 className="mn-full-page-loader-title">{title}</h1>
        {message != null ? <p className="mn-full-page-loader-message">{message}</p> : null}
      </div>
    </div>
  );
}

export interface InlineLoaderProps {
  size?: number | string;
  className?: string;
  label?: string;
}

/**
 * Inline loading spinner for use within buttons, cards, or small containers.
 */
export function InlineLoader({ size = 16, className, label }: InlineLoaderProps) {
  return (
    <span className={cn("mn-inline-loader", className)} role="status" aria-label={label || "Loading"}>
      <BillingLogoLoader size={size} variant="inline" aria-hidden="true" />
      {label != null ? <span className="mn-inline-loader-label">{label}</span> : null}
    </span>
  );
}