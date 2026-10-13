---
type: reference
status: active
date: 2026-09-12
tags: [mylesnet, landing, design, implementation]
---

# MylesNet Public Website Design

The public site is the MylesNet marketing surface, implemented inside the active dashboard checkout in the dedicated folder `app/(landing)/` and served unauthenticated at `/` (2026-09-10 directive; see [[../decisions|decisions]]). This design record governs the marketing surface and feeds [[../landing-page-implementation-plan|Landing Page Implementation Plan]]. It must describe only verified capabilities and use `packages/ui/tokens.json` as the unified token source. The earlier separate static site at [mylescorp/mylesnet-website](https://github.com/mylescorp/mylesnet-website) is a historical consumer-facing site and is not the in-repo landing source.

Required content groups are product overview, operator use cases, capability explanation, security and reliability posture, contact or sales path, privacy, and terms. It must not expose network topology, provider secrets, tenant records, internal operations, or unverified coverage, pricing, integrations, or performance claims.

Public pages are separate from authenticated panel routes and use the required [[Footer Standards]] and [[Contact Page Standards]].

## Visual Direction: Calm and Data-First

**Concept:** Neutral surfaces with data-driven precision and a restrained accent. The canonical values are in `packages/ui/tokens.json`.

**Emotional register:** "This platform handles my complexity with confidence" — ISP operators feel they're looking at a serious operational tool, not marketing fluff.

**Typography:**
- Use Geist Sans, Geist Mono, and Instrument Serif through the shared font tokens.
- Use the supplied type scale and landing display sizes from `packages/ui/tokens.json`.

**Color, shape, and motion:**
- Colors, radii, spacing, shadows, and motion come from `packages/ui/tokens.json`.
- Keep surfaces neutral and reserve accent for interactive emphasis. Do not add palette values, gradients, or glass effects outside the token contract.
- Respect reduced motion and the shared focus treatment.

**Signature elements:**
1. **Connectivity line motif:** Use token-backed chart and accent colors for any connecting visual lines.
2. **Data strip:** Use real, verified product data with semantic colors.
3. **Product preview:** Use a truthful product screenshot or a CSS composition that does not imply unavailable functionality.

## Page Archetypes

### Hero page (`/`)
  - Neutral hero section with tagline, title, subtitle, real actions, and attributes
  - Product preview using a real screenshot or a neutral illustration without invented interface data
- Audiences strip
- Industry stats band
- Problem/pains grid
- Features bento grid
- Subscriber lifecycle
- Process steps
- Solutions grid
- Comparison table
- Trust pillars
- FAQ accordion
- Integrations teaser
- CTA band

### Content page (product, features/[slug], solutions/[slug], etc.)
- Page banner with kicker, title, lead, meta items
- Prose sections with headings, lists, blockquotes
- Checklists for feature lists
- Grid cards for related content
- CTA band

### Pricing page (`/pricing`)
- Banner with plan meta items
- PricingPlans component with currency switcher
- Shared features checklist
- Trial/referral cards
- CTA band

### Hub pages (integrations, customers, resources)
- Banner with contextual metadata
- Grouped content sections
- Legend/key for status indicators
- Grid cards with status chips

## Component Mapping (landing.css → shadcn/ui)

| Landing CSS Family | shadcn Primitive | Migration Notes |
|-------------------|-----------------|----------------|
| `.landing-cta-button` | Button (primary variant) | Map to the primary button token, add loading state |
| `.landing-secondary-button` | Button (secondary variant) | Use the secondary button token, add loading state |
| `.landing-card` | Card | Add hover lift, map to `--surface` + `--line` |
| `.landing-bento-card` | Card (glass variant) | Use `--landing-glass` backdrop, add glow on hover |
| `.landing-plan-card` | Card (pricing variant) | Add popular badge, map to `--primary-action` border |
| `.landing-status-chip` | Badge | Map status colors to semantic tokens |
| `.landing-nav-link` | Navigation Menu | Add active state with `aria-current` |
| `.landing-mobile-menu` | Sheet/Dialog | Replace with Radix Sheet for proper focus management |
| `.landing-faq` | Accordion | Replace with Radix Accordion for keyboard navigation |

## Dark Mode Plan

Landing surface honors the existing `data-theme` + `prefers-color-scheme` system:

1. **No-flash load:** Inline script in landing layout applies theme before paint (same mechanism as dashboard)
2. **Token remap:** All landing-surface tokens have dark-mode values in `:root[data-theme="dark"]`
3. **Glass adjustments:** Dark mode uses more opaque glass (82% vs 78%) to maintain contrast
4. **Glow adjustments:** Dark mode uses more intense glows (40-50% vs 32-40%) for visibility
5. **No second stylesheet:** Single CSS file with token remap, per dashboard pattern

## Motion Rules

- **Token-driven:** All durations use `--mn-dur-*`, all easing uses `--mn-ease-*`
- **State-change only:** Animations describe interactions (hover, focus, open), not ambient movement
- **Reduced motion:** Global `prefers-reduced-motion` override disables all animations
- **No layout shift:** No animation causes content reflow; transforms only on elements with reserved space

## Landing.css Deprecation Path

The 2,919-line `landing.css` will be deprecated incrementally:

1. **Phase 2:** Migrate component patterns to shadcn primitives, delete corresponding CSS
2. **Phase 3:** Migrate page-level patterns to utility classes + shadcn, delete remaining CSS
3. **Verification:** Scripts/check-design-tokens.mjs will report CSS class families slated for deletion
4. **Completion:** landing.css removed entirely when all components use shadcn/ui

## Implementation correction — 2026-09-13

The landing review found that the initial primitive setup had allowed its
shadcn aliases to overwrite the public semantic token names. The aliases are
now isolated behind `--ui-*` and Tailwind `--color-*` mappings, so the public
surface and shared primitives resolve the same documented semantic values.
The responsive header, hero, cards, content banners, pricing, CTA bands, and
footer share one token-driven treatment; mobile navigation appears only at its
intended breakpoint. No landing component retains inline presentation styles.
