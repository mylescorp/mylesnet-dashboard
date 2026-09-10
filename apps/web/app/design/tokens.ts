/**
 * MylesNet semantic design-token contract.
 *
 * CSS variables in app/globals.css are the runtime source of truth. This file
 * gives TypeScript and non-CSS consumers stable names without duplicating
 * colour values or bypassing light and dark theme resolution.
 */
export const designToken = {
  color: {
    text: "var(--text)",
    textStrong: "var(--text-strong)",
    muted: "var(--muted)",
    primary: "var(--primary)",
    primaryHover: "var(--primary-hover)",
    primaryForeground: "var(--primary-foreground)",
    primaryText: "var(--primary-text)",
    primaryAction: "var(--primary-action)",
    primaryActionForeground: "var(--primary-action-foreground)",
    accent: "var(--accent)",
    accentBg: "var(--accent-bg)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    dangerForeground: "var(--danger-foreground)",
    info: "var(--info)",
  },
  chart: {
    grid: "var(--chart-grid)",
    label: "var(--chart-label)",
    cpu: "var(--chart-cpu)",
    sessions: "var(--chart-sessions)",
    transmit: "var(--chart-transmit)",
    receive: "var(--chart-receive)",
    memory: "var(--chart-memory)",
  },
  rank: {
    gold: "var(--rank-gold)",
    silver: "var(--rank-silver)",
    bronze: "var(--rank-bronze)",
  },
} as const;

export type DesignToken = typeof designToken;
