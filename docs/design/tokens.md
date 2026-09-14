---
type: reference
status: active
version: 3.0.0
date: 2026-09-14
tags:
  - mylesnet
  - design-system
  - tokens
  - production
---

# MylesNet Design Tokens

Product: [[MylesNet]]  
Owner: [[Jonathan Myles]]  
Company: [[MylesCorp Technologies Ltd]]

This is the canonical design-token governance record for the multi-tenant ISP and [[../MylesNet_Master_Technical_Specification_v3|RADIUS]] SaaS. It replaces the earlier flat `--net-*` list as the active product contract.

**v3.0 (2026-09-14) is a breaking palette and type revision approved for execution.** The brand moves to **Centipid parity**: orange `#FA8200` primary, graphite neutrals (`#0E1116` ink, `#FFFFFF` cream, `#F6F7F9` paper), **no navy anywhere**, and a font stack of Inter (UI), JetBrains Mono (mono), Bricolage Grotesque (display) and Hanken Grotesk (brand). The approved v2 orange/navy/warm-surface palette (`#F57C00` / `#1A395B` / `#FFF3E0`) is **retired**; the `--mn-navy-*` primitives survive only as graphite aliases for deprecated-rule compatibility. See [[../decisions|MylesNet Decisions]] for the reversal entry.

## Source of truth and precedence

1. This file governs intent, accessibility, tenant-branding boundaries, and token changes.
2. `C:\Users\Admin\Projects\mylesnet-dashboard\app\globals.css` provides runtime CSS variables for the active dashboard.
3. `C:\Users\Admin\Projects\mylesnet-dashboard\app\design\tokens.ts` provides typed CSS-variable references for React consumers.
4. `C:\Users\Admin\Projects\mylesnet-dashboard\docs\design\tokens.md` is the repository handoff.

Code must consume semantic or component tokens. Primitive `--mn-*` values are private to the token layer and are not a feature-component API.

## Token architecture

| Layer | Form | Purpose | Consumer |
| --- | --- | --- | --- |
| Primitive | `--mn-*` | Approved raw palette and rank colours | Token layer only |
| Centipid parity | `--green`, `--ink`, `--cream`, `--sand`, `--online` | Mirror of the target dashboard CSS the app manages | Token layer and aliases |
| Semantic | `--primary`, `--surface`, `--danger` | Meaning that adapts by theme | All UI components |
| Component | `--sidebar-*`, `--chart-*` | Named repeated patterns | Navigation and data visualisation |
| Typed reference | `designToken.*` | CSS variable references for React APIs | Charts and icons |

## Brand primitives

| Family | Values | Approved use |
| --- | --- | --- |
| Orange | `50 #FFF7EE`, `100 #FFEDDB`, `200 #FFC37A`, `300 #FFAB4D`, `400 #FF9D3D`, `500 #FA8200`, `600 #D96E00`, `700 #C86800`, `800 #A84A00` | Brand, connectivity emphasis. `500` is the hero accent; `600` and `700` serve AA-safe hover/action; text uses the dedicated `--primary-text` token. |
| Graphite (former Navy) | `50 #F6F7F9`, `100 #E6E8EC`, `300 #A9B0BB`, `500/700/800/900 #0E1116` | Structure, navigation, operational reading surfaces. Names retain `--mn-navy-*` only as deprecated aliases. |
| Green | `50 #F2FBF7`, `700 #0F9D6E` | Confirmed healthy or complete state (`--online`) |
| Amber | `50 #FDF6E8`, `800 #DD9A33` | Attention required, pending, or degraded state (`--warn`) |
| Red | `50 #FDF2F2`, `700 #B53636` | Error, critical health, destructive action (`--error`) |
| Blue | `50 #F4F4F5`, `800 #4A5A6A` | Neutral informational state and received-traffic data |
| Rank | gold `#C9B037`, silver `#A8A9AD`, bronze `#B08D57` | Leaderboard medals only |

The wordmark uses graphite and orange on the orange family. The approved product promise is “Connecting communities, one mile at a time.” No tenant may replace the MylesNet wordmark in [[../MylesNet_Master_Technical_Specification_v3|Platform]] or [[../MylesNet_Master_Technical_Specification_v3|Admin]].

## Semantic token contract

| Meaning | Light mode | Dark mode | Required use |
| --- | --- | --- | --- |
| Canvas | `#F6F7F9` | `#1C1C1C` | Page background |
| Surface | `#FFFFFF` | `#202020` | Cards, dialogs, inputs, tables |
| Muted surface | `#F6F7F9` | `#1C1C1C` | Hover, grouped controls, empty areas |
| Strong surface | `#F3F5F8` | `#2A2A2A` | Selected or emphasized non-destructive groups |
| Text | `#0E1116` | `#E5E5E5` | Default readable text |
| Text strong | `#0E1116` | `#E5E5E5` | Strong headings and emphasized text |
| Muted text | `#0E1116` at 58% | `#A1A1A1` | Supporting labels only |
| Border | `#E1E8E3` | `#FFFFFF` at 12% | Separators, controls, tables |
| Primary | `#FA8200` | `#FA8200` | Hero accent: rails, glows, logo marks, decorative emphasis |
| Primary text | `#A84A00` | `#FA8200` | Orange text and essential iconography (AA ≥ 5.7:1 on light) |
| Primary action | `#FA8200` | `#FA8200` | Primary button, active nav fill, brand avatar fill (`#2A1505` text) |
| Primary action hover | `#C86800` | `#FF9D3D` | Hover state only (light) / active-hover combined (dark) |
| Primary action foreground | `#2A1505` | `#1F1206` | Text and icon on primary-action surfaces |
| Accent | `#FA8200` | `#FA8200` | Structural emphasis and selected tabs (bright variant `#FF9D3D`) |
| Accent background | `accent 10% over surface` | `accent 18% over surface` | Tinted emphasis panels and chips behind text |
| Success | `#0F9D6E` | `#0F9D6E` | Healthy, paid, complete, connected |
| Warning | `#DD9A33` | `#DD9A33` | Pending, at-risk, degraded |
| Danger | `#B53636` | `#FF9B9B` | Failed, disconnected, blocked, destructive |
| Danger foreground | `#FFFFFF` | `#3B1010` | Text on danger surfaces (badges, destructive buttons) |
| Info | `#4A5A6A` | `#9FB4C4` | Neutral operational information (kept graphite, never navy) |

Semantic colours communicate state. Every status must also expose text, an icon, or an accessible label. Never use success to mean revenue growth, warning as a brand accent, or danger for a routine primary action.

Accessibility note (v3.0): on light surfaces `#FA8200` still fails WCAG 2.1 AA as body text, so text and essential iconography resolve through `--primary-text` (`#A84A00`, ≈5.7:1 AA) and action surfaces carry `--primary-action-foreground` (`#2A1505`, high contrast). In dark mode the whole orange family reads on the graphite surface; `--danger` brightens to `#FF9B9B` with a dark `#3B1010` foreground.

## Typography

The active runtime loads **Inter, JetBrains Mono, Bricolage Grotesque, and Hanken Grotesk** through [[Next.js]] font loading (`next/font/google`). The old Geist and Space Grotesk loading is removed.

| Token | Value | Use |
| --- | --- | --- |
| `--font-ui` | Inter with system fallbacks | Application UI, forms, tables, navigation |
| `--font-mono-ui` | JetBrains Mono with system fallbacks | IDs, logs, API output, technical values |
| `--font-display` | Bricolage Grotesque with Inter fallback | Display headings, hero type |
| `--font-brand` | Hanken Grotesk with Inter fallback | Wordmark and brand voice scenarios |
| `--font-sans` / `--font-mono` | Inter / JetBrains Mono (Tailwind `@theme inline`) | Utility-driven text |
| `--font-size-50` to `--font-size-800` | 12px to 36px | Dense operations hierarchy without one-off sizes |
| `--line-height-tight` | 1.2 | Titles and compact labels |
| `--line-height-normal` | 1.5 | Standard text and form UI |
| `--line-height-relaxed` | 1.65 | Long instructions and support content |

The runtime font variables come from the layout: `--font-inter`, `--font-jetbrains-mono`, `--font-bricolage-grotesque`, `--font-hanken-grotesk`. They are declared in `scripts/check-design-tokens.mjs` as external variables.

Use a maximum of three type weights in a component. Do not use text smaller than 12px for essential information, critical status, or control labels.

## Semantics, shape and motion

| Family | Values | Rule |
| --- | --- | --- |
| Spacing | `--space-0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `10`, `12`, `16` | 4px base scale. Do not introduce arbitrary pixel gaps. |
| Radius | `--radius-xs 2px`, `sm 8px`, `md 12px`, `lg 16px`, `xl 20px`, `full`; `--radius-field 9px` (inputs); `--radius-btn 100px` (buttons and pills) | Inputs use field, cards md or lg, actions btn. |
| Elevation | `--shadow-sm`, `--shadow-card`, `--shadow-pop`, `--shadow-rail`, `--shadow-md`, `--shadow-lg` | Establish interaction and modal hierarchy, not decoration. |
| Duration | `--duration-instant 100ms`, `fast 150ms`, `base 200ms`, `slow 300ms`; `--motion-fast/nav/spring` | Motion must describe an interaction or state transition. |
| Easing | `--ease-in`, `--ease-out`, `--ease-in-out`, `--ease-standard` | No custom cubic-bezier values in feature components. |
| Breakpoints | `--bp-xs 480`, `sm 640`, `md 768`, `lg 980`, `xl 1180` | Responsive intent mapping. |

The runtime includes a global `prefers-reduced-motion` override. Animated health dots, loading state, and charts must remain understandable when it applies.

## Landing-surface tokens (Network Pulse direction)

The public marketing surface uses **Bricolage Grotesque** for display typography (`--landing-font-display` resolves through `--font-display`) and a glassmorphism elevation system. These tokens are mapped onto the v3 primitives and extend the semantic contract for landing-specific patterns.

| Token | Light mode | Dark mode | Required use |
| --- | --- | --- | --- |
| Display type scale | `--landing-display-xs` to `--landing-display-xl` | Same values (no remap) | Landing page headings, hero titles, section headers |
| Landing display font | `--landing-font-display` | Same value | Bricolage Grotesque with Inter fallback |
| Ink band | `--landing-ink-start: var(--surface-inverse)`; end `color-mix(surface-inverse 70%, surface)`; text `--text-on-inverse` | Same derivation (reactive) | Dark band sections: hero footer, CTA bands, stats |
| Section padding | `--landing-section-padding-sm/md/lg` | Same values (no remap) | Vertical rhythm for landing sections |
| Container width | `--landing-container: 1140px` | Same value (no remap) | Maximum content width for landing pages |
| Glass surface | `--landing-glass` | Dark: more opaque (82% vs 78%) | Header, cards, overlays with backdrop blur |
| Glass border | `--landing-glass-border` | Dark: more opaque (75% vs 65%) | Glass surface borders |
| Primary glow | `--landing-primary-glow` | Dark: more intense (40% vs 32%) | Orange glow effects on hero elements and CTAs |
| Accent glow | `--landing-accent-glow` | Dark: more intense (50% vs 40%) | Structural glow effects (orange family) |
| Surface tint | `--landing-surface-tint` | Dark: more saturated (12% vs 6%) | Orange-tinted backgrounds for emphasis |
| Connectivity line | `--landing-connectivity-line` | Dark: more saturated (80% vs 70%) | Gradient lines connecting related cards and sections |
| Data strip background | `--landing-data-strip-bg` | Dark: more saturated (12% vs 8%) | Background for telemetry-style data strips |
| Data strip line | `--landing-data-strip-line` | Dark: more saturated (6% vs 4%) | Grid lines within data strips |

**Typography mapping:**
- Display headings use `--landing-display-*` scale with `--landing-font-display`
- Body copy uses existing `--font-ui` (Inter) and `--font-size-*` scale
- Monospace labels use existing `--font-mono-ui` (JetBrains Mono)

**Elevation mapping:**
- Glass surfaces use `--landing-glass` with `backdrop-filter: blur(14px)`
- Card hover uses `--shadow-lg` with token-driven transitions
- Glow effects use `--landing-primary-glow` and `--landing-accent-glow`

**Accessibility notes:**
- Display type remains AA-compliant through `clamp()`-driven responsive sizing
- Ink bands resolve through `--text-on-inverse` so contrast follows the theme
- Glass surfaces maintain contrast through `color-mix()` opacity adjustments
- All glow effects are decorative; essential information never relies on color alone

## Layout shell tokens

| Token | Value | Use |
| --- | --- | --- |
| `--sb-w` / `--sb-w-collapsed` | `236px` / `64px` | Sidebar width and collapsed rail (replaces the old fixed 280px/80px rules) |
| `--tb-h` | `56px` | Unified topbar height (replaces 68px desktop / 62px tablet rules) |
| `--sb-gap` | `14px` | Sidebar internal rhythm |
| `--sb-bg` / `--sb-border` | `var(--cream)` / `var(--sand)` | Existing sidebar chrome |
| `--sidebar-canvas` / `-end` | `var(--cream)` / `var(--surface-2)` | Sidebar gradient (light); dark `#202020` / `#2A2A2A` |
| `--sidebar-active` / `-end` | `var(--primary-action)` / `var(--primary-action-hover)` | Active nav fill; dark `#FF9D3D` / `#FA8200` |
| `--surface-inverse` | `var(--ink)` | Overlay/ink surfaces (dark zeroes as `--surface-strong`) |

## Shared component specifications

| Component | Variants and states | Required tokens | Accessibility |
| --- | --- | --- | --- |
| Button | primary, secondary, danger, ghost; default, hover, disabled, loading | primary, surface, line, danger, focus ring | Native button, visible label, keyboard activation |
| Input, select, textarea | default, focused, disabled, invalid, read-only | surface, text, line, danger, focus ring | Label, description, validation message, error association |
| Status pill | success, warning, danger, info, neutral | state foreground and background | Text always present, never colour-only |
| Card | standard, selectable, metric, critical | surface, line, shadow | Heading hierarchy, selected state announced where interactive |
| Table | standard, dense, sortable, loading, empty | surface, line, muted, text | Semantic table markup and sortable button labels |
| Dialog | modal, confirmation, full-screen workbench | surface, shadow-lg, focus ring | Focus trap, title, Escape close unless safety requires otherwise |
| Navigation | default, hover, active, planned, collapsed | sidebar component tokens | Current route conveyed with `aria-current` |
| Alert | success, warning, danger, info | semantic state tokens | Announce changes only when immediate action is needed |
| Chart | telemetry, finance, capacity, rank | chart component tokens | Text summary or tabular alternative |

## Data visualisation

`designToken.chart` supplies `grid`, `label`, `cpu`, `sessions`, `transmit`, `receive`, and `memory`. Charts must use these references rather than raw hex values so their palette follows the current theme. `transmit` maps to `--accent` (orange), `receive` to `--info` (graphite blue), `sessions` to `--success`. Do not encode alert severity exclusively by line colour. Provide labels, tooltips, and a readable numeric alternative.

## Panel and tenant branding boundary

| Surface | Branding policy |
| --- | --- |
| [[../MylesNet_Master_Technical_Specification_v3|Platform]] and [[../MylesNet_Master_Technical_Specification_v3|Admin]] | MylesNet controlled. Tenant branding is never applied. |
| [[../MylesNet_Master_Technical_Specification_v3|Dashboard]] operator workspace | Shared shell and semantic status system. Tenant may show its approved logo and display name. |
| Subscriber portal | Tenant logo, name, and a constrained approved accent may be shown after tenant resolution and configuration validation. |
| [[../MylesNet_Master_Technical_Specification_v3|Reseller]] | Shared MylesNet chrome. Tenant brand may identify the delegated business context only. |

Tenant configuration may provide a logo, display name, and approved accent for public tenant-facing surfaces. It cannot alter focus treatment, operational health state, destructive action state, auth surface, Platform or Admin chrome, contrast requirements, or the shared route shell. Tenant configuration is tenant-owned data, must carry `tenantId`, and must be authorized server-side before it reaches a page.

## Accessibility and release gates

- Maintain WCAG 2.1 AA contrast for normal text and essential iconography.
- Every keyboard-focusable control must expose the shared visible focus ring.
- Dark mode is a semantic remap, never a separate visual system.
- Verify light and dark themes at 320px, 768px, 1024px, and 1440px for navigation, forms, dialogs, tables, health states, and charts.
- Check reduced motion, zoom at 200%, keyboard-only navigation, and screen-reader labels for stateful controls.
- Run `npm run tokens:check`; it rejects raw hex in application TypeScript and `rgb()/hsl()/hex` in landing CSS outside `:root` token blocks, raw hex and other colour literals in globals rule CSS outside the token region, and references to undefined custom properties. References to the four external font variables are allowed via the script's `externalVars`. Any exception requires component documentation and token review.
- Run `npm run lint` and `npm run build` before release.

## Change management

Token changes are product changes. A change must include intended semantic effect, light and dark mappings, contrast evidence, affected component list, migration instruction, visual verification, and an entry in [[../decisions|MylesNet Decisions]]. Breaking semantic changes increase the token version. New tenant branding fields require tenant-scope, RBAC, sanitization, and file-storage review.

## Implementation status, 2026-09-14

- **v3.0 migration complete in the dashboard runtime** (`apps/web/app/globals.css`): Centipid parity block, graphite primitives, semantic contract, layout shell, landing tokens, and `@theme inline` fonts all rewritten. `(landing)/landing.css` font and ink-band tokens re-derived. Legacy aliases (`--terracotta`, `--amber`, `--blue`, `--purple`, `--red`, `--mn-navy-*`) point at the orange/graphite families so existing rules keep working.
- **Fonts**: `app/layout.tsx` loads Inter, JetBrains Mono, Bricolage Grotesque, Hanken Grotesk with variables `--font-inter`, `--font-jetbrains-mono`, `--font-bricolage-grotesque`, `--font-hanken-grotesk`. Geist and Space Grotesk loading removed.
- **Theme**: the storage scheme is now tri-state (`light` / `dark` / `system`, key `mylesnet-dashboard-theme`). The no-flash script in the root layout resolves `system` at pre-paint; `app/components/ThemeToggle.tsx` cycles light → dark → system and follows live OS changes in system mode.
- **Rule CSS**: raw navy and legacy-brand `rgb()`/shadows neutralized to graphite (`rgb(0 0 0)`) or `color-mix()` of semantic tokens; sidebar, topbar and button dimensions moved to `--sb-w`, `--tb-h`, `--radius-btn`, `--radius-field`.
- **Typed contract**: `app/design/tokens.ts` extended (`brand`, `status`, `neutral`, `auth`, `layout`, `motion`, `focus`, `font`); existing `chart` and `rank` keys preserved. `scripts/check-design-tokens.mjs` `externalVars` updated.
- `npm run tokens:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass.
- This system is a design and implementation contract. It does not claim the full multi-tenant product is production-ready.

### Alias integrity correction — 2026-09-13

The shadcn/Tailwind bridge now uses isolated `--ui-*` aliases and Tailwind `--color-*` mappings. It must never redefine product semantic tokens such as `--primary`, `--muted`, or `--accent`: those are the public MylesNet contract and are consumed throughout the dashboard and landing surface. This is a runtime correctness repair, not a palette or semantic-meaning change.

## Related records

- [[design-brief]]
- [[system]]
- [[panels]]
- [[index]]
- [[../Reports/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3|MylesNet Multi Tenant ISP and RADIUS SaaS Technical Specification v3]]
- [[../decisions|MylesNet Decisions]]