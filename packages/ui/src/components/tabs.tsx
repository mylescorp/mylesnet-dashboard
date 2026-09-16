"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils";

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/** Underline tabs with arrow-key navigation matching the platform shell. */
export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const baseId = useId();
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("mn-tabs", className)}>
      {items.map((item) => {
        const selected = item.value === value;
        const tabId = `${baseId}-${item.value}`;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={selected}
            aria-controls={`${tabId}-panel`}
            disabled={item.disabled}
            tabIndex={selected ? 0 : -1}
            className={cn("mn-tab", selected && "mn-tab-active", item.disabled && "mn-tab-disabled")}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const idx = items.findIndex((i) => i.value === value);
              const dir = e.key === "ArrowRight" ? 1 : -1;
              for (let step = 1; step <= items.length; step++) {
                const next = items[(idx + dir * step + items.length) % items.length];
                if (!next.disabled) {
                  onChange(next.value);
                  break;
                }
              }
            }}
          >
            {item.icon != null ? <span className="mn-tab-icon" aria-hidden="true">{item.icon}</span> : null}
            <span className="mn-tab-label">{item.label}</span>
            {item.badge != null ? <span className="mn-tab-badge">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  value: string;
  selected: string;
  children: ReactNode;
  className?: string;
}

/** Panel content for a tab. Only renders when its value matches the selected tab. */
export function TabPanel({ value, selected, children, className }: TabPanelProps) {
  if (value !== selected) return null;
  return (
    <div
      role="tabpanel"
      id={`${value}-panel`}
      aria-labelledby={`${value}`}
      className={cn("mn-tab-panel", className)}
    >
      {children}
    </div>
  );
}