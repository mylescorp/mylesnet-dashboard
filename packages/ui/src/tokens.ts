export const layout = {
  sidebarWidth: 236,
  sidebarCollapsedWidth: 64,
  topbarHeight: 56,
  shellRadius: "var(--shell-radius)" as const,
  shellPadding: "var(--shell-padding)" as const,
  shellGap: "var(--shell-gap)" as const,
  shellBorder: "var(--shell-border)" as const,
  shellShadow: "var(--shell-shadow)" as const,
} as const;

export const tokens = { layout } as const;
