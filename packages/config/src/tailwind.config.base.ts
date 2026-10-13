import type { Config } from "tailwindcss";

/** Shared Tailwind preset. Runtime values come from packages/ui/tokens.json. */
const preset: Partial<Config> = {
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    extend: {
      colors: Object.fromEntries([
        "bg", "card", "side", "inset", "ink", "muted", "subtle", "line", "line-strong",
        "accent", "accent-hover", "accent-bg", "on-accent", "ok-bg", "ok-fg", "warn-bg",
        "warn-fg", "danger", "danger-bg", "danger-fg", "info-bg", "info-fg", "scrim",
        "focus", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-grid",
      ].map((name) => [name, `var(--mn-${name})`])),
      spacing: Object.fromEntries(["0", "0.5", "1", "2", "3", "4", "5", "6", "7", "8", "10", "12", "16", "20", "24", "32"].map((name) => [name, `var(--mn-space-${name.replace(".", "_")})`])),
      borderRadius: Object.fromEntries(["xs", "sm", "md", "lg", "xl", "2xl", "full"].map((name) => [name, `var(--mn-radius-${name})`])),
      fontFamily: { sans: ["var(--mn-font-sans)"], serif: ["var(--mn-font-serif)"], mono: ["var(--mn-font-mono)"] },
      fontSize: Object.fromEntries(Object.entries({
        eyebrow: "eyebrow", "section-label": "section-label", caption: "caption", "body-sm": "body-sm",
        body: "body", "body-strong": "body-strong", "body-lg": "body-lg", "title-sm": "title-sm",
        title: "title", metric: "metric", heading: "heading", "serif-italic": "serif-italic",
        "display-sm": "display-sm", display: "display", "display-lg": "display-lg",
      }).map(([className, token]) => [className, [`var(--mn-type-${token}-size)`, {
        lineHeight: `var(--mn-type-${token}-line)`, fontWeight: `var(--mn-type-${token}-weight)`, letterSpacing: `var(--mn-type-${token}-tracking)`,
      }]])),
      boxShadow: { popover: "var(--mn-shadow-popover)", menu: "var(--mn-shadow-menu)" },
      zIndex: Object.fromEntries(["base", "sticky", "sidebar", "topbar", "dropdown", "drawer", "modal", "toast", "tooltip", "impersonation"].map((name) => [name, `var(--mn-z-${name})`])),
      transitionDuration: { fast: "var(--mn-dur-fast)", base: "var(--mn-dur-base)", slow: "var(--mn-dur-slow)", slower: "var(--mn-dur-slower)" },
      transitionTimingFunction: { standard: "var(--mn-ease-standard)", enter: "var(--mn-ease-enter)", exit: "var(--mn-ease-exit)" },
      width: { sidebar: "var(--mn-sidebar-w)", "sidebar-collapsed": "var(--mn-sidebar-w-collapsed)", menu: "var(--mn-menu-w)", search: "var(--mn-search-w)", "side-sheet": "var(--mn-side-sheet-w)", palette: "var(--mn-palette-w)", sparkline: "var(--mn-sparkline-w)" },
      height: { topbar: "var(--mn-topbar-h)", "bottom-nav": "var(--mn-bottom-nav-h)", btn: "var(--mn-btn-h)", input: "var(--mn-input-h)", sparkline: "var(--mn-sparkline-h)" },
      maxWidth: { content: "var(--mn-content-max)", landing: "var(--mn-landing-container)", "landing-narrow": "var(--mn-landing-container-narrow)" },
      minHeight: { touch: "var(--mn-touch-min)" },
    },
  },
};

export default preset;
