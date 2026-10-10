export const layout = {
  sidebarWidth: 236,
  sidebarCollapsedWidth: 64,
  topbarHeight: 56,
  shellRadius: "var(--shell-radius)" as const,
  shellPadding: "var(--shell-padding)" as const,
  shellGap: "var(--shell-gap)" as const,
  shellBorder: "var(--shell-border)" as const,
  shellShadow: "var(--shell-shadow)" as const,
  pageGutter: "var(--page-gutter)" as const,
  pagePaddingBlock: "var(--page-padding-block)" as const,
} as const;

export const card = {
  radius: "var(--card-radius)" as const,
  border: "var(--card-border)" as const,
  padding: "var(--card-padding)" as const,
  paddingCompact: "var(--card-padding-compact)" as const,
  gap: "var(--card-gap)" as const,
  shadow: "var(--card-shadow)" as const,
  shadowHover: "var(--card-shadow-hover)" as const,
} as const;

export const tokens = { layout, card } as const;
