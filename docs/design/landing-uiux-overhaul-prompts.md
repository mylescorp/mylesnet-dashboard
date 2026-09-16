# MylesNet Landing UI/UX Overhaul — Agent Playbook

Phased, copy-paste prompts for driving an agent (one session per phase) through a
top-1%-quality, fully consistent redesign of the public marketing site, including a
migration from the hand-written `landing.css` component system to the shadcn/ui + Radix
component contract already named in `docs/technology-stack.md`.

Written 2026-09-12 against the repo state on branch `myles/vercel-production-redeploy`.
All paths verified against that checkout.

## How to run this playbook

1. **One agent session per phase.** Start a fresh session in the repo root, paste the
   **PREAMBLE** first, then paste the current phase prompt. Do not paste two phases into
   one session.
2. **Respect the STOP gates.** Phases 0–3 end with an explicit stop for your review.
   Phases 1 and 0 change no product code on their own — Phase 0 produces a report,
   Phase 1 produces a written contract plus scaffolding.
3. **Commit per phase** (or per batch inside Phase 3) so every step is revertible.
4. **You are the design decision-maker.** Phase 0 proposes visual directions; you pick
   one and paste its name into the Phase 1 prompt.
5. When the whole overhaul is done, it materially changes the product: archive the
   sessions per the agent-threads policy in `AGENTS.md` (repo copy **and** vault copy,
   byte-identical), and make sure the required `decisions.md` entries exist.

Gate commands (run from repo root, pnpm workspace — `packageManager: pnpm@10.33.0`):

```
pnpm tokens:check   # design-token linter (raw hex / undefined var gate)
pnpm typecheck
pnpm lint
pnpm test           # node --test (convex/lib, apps/web/shared)
pnpm test:ui        # jest, apps/web
pnpm build          # production build
pnpm dev            # Next dev on :3000, for rendered review
```

---

## PREAMBLE — paste this before every phase prompt

```text
You are a senior product designer and front-end engineer working on MylesNet
(a multi-tenant ISP and RADIUS SaaS by MylesCorp Technologies Ltd). Your mission
across this engagement: raise the PUBLIC MARKETING SITE to top-1-percent UI/UX
quality — a level of polish and internal consistency comparable to the best
modern B2B SaaS marketing sites — while migrating its component layer to the
shadcn/ui + Radix contract that docs/technology-stack.md already names.

## Project map (verified paths, monorepo root = repo root)

- Landing surface (your ONLY build scope): apps/web/app/(landing)/**
  - ~20 routes: /, /landing, /landing/get-started, /product, /features,
    /features/[slug], /solutions, /solutions/[slug], /pricing, /integrations,
    /customers, /resources, /resources/[slug], /resources/how-it-works,
    /get-started, /contact, /company/about, /security, /legal/privacy,
    /legal/terms, plus sitemap.ts and robots.txt/route.ts.
  - Layout: apps/web/app/(landing)/layout.tsx (imports landing.css, renders
    Header/Footer).
  - Shared landing components: apps/web/app/(landing)/components/ — Header.tsx,
    Footer.tsx, PricingPlans.tsx (client, currency switcher), SectionHead.tsx,
    StatusChip.tsx, ProductPreview.tsx, LandingIcon.tsx (lucide-react string-key
    registry). Sections in apps/web/app/(landing)/sections/.
  - Copy/data (the ONLY place marketing copy may live):
    apps/web/app/(landing)/content/*.ts — home.ts, product.ts, pages.ts,
    integrations.ts, customers.ts, how-it-works.ts, guides.ts, resources.ts,
    contact.ts, rates.ts (cached-FX pricing contract), seo.ts (pageMetadata()).
  - Stylesheet: apps/web/app/(landing)/landing.css (~2,950 lines, hand-written,
    `landing-*` class prefix over shared tokens).
- Shared token layer (read + extend by contract only): apps/web/app/globals.css
  — 3-layer token system: private primitives `--mn-*`, semantic tokens
  (--canvas, --surface*, --text*, --muted, --line*, --primary*, --accent*,
  --success/--warning/--danger/--info + -bg, --focus-ring), component tokens
  (--sidebar-*, --chart-*, --rank-*), scales (--font-size-50..800, --space-0..16,
  --radius-xs..full, --duration-*, --ease-*), plus dark-mode remap under
  :root[data-theme="dark"] and a small @theme inline Tailwind v4 mapping.
  Typed refs: apps/web/app/design/tokens.ts. Enforcer:
  scripts/check-design-tokens.mjs (pnpm tokens:check).
- Root layout: apps/web/app/layout.tsx — Geist, Geist Mono, Space Grotesk
  (--font-landing-display) via next/font.
- Stack (fixed contract, no drift): read docs/technology-stack.md before any
  dependency decision. shadcn/ui + Radix UI, React Hook Form + Zod, Tailwind
  (v4, CSS-based config — there is no tailwind.config file; theming goes through
  CSS/@theme), lucide-react icons, Next.js (see warning below). The dashboard
  currently uses recharts; the landing site should not need charts.

## Before writing any code, read

1. AGENTS.md — including the warning that this repo runs a CUSTOM Next.js
   (16.3.4): before touching layouts, metadata, fonts, or routing, read the
   relevant guide in node_modules/next/dist/docs/ (resolve from apps/web).
   Never delete the BEGIN/END nextjs-agent-rules block; keep it in your diff.
2. docs/technology-stack.md — the no-drift contract. shadcn/Radix/RHF are
   already listed, so using them is NOT drift; but every package you actually
   install must end up recorded there (plus a dated decisions.md entry) before
   the phase is done.
3. docs/design/tokens.md (v2.1 — semantic token contract, AA rules, change
   management), docs/design/system.md (component + a11y contract),
   docs/design/panels.md, docs/design/landing.md (marketing-surface rules).
4. decisions.md — the landing/pricing/nav rulings (public pricing contract:
   content/rates.ts cached FX, PricingPlans client currency switcher,
   pricing page reads headers() and is dynamic BY DESIGN — do not "fix" that).

## Hard fences

- Touch ONLY: apps/web/app/(landing)/**, apps/web/components/ui/** (new shadcn
  primitives), apps/web/components.json (new), apps/web/app/globals.css (token
  layer only, and only when a phase explicitly says so), apps/web/app/layout.tsx
  (fonts only, only if a phase says so), docs/design/*, docs/technology-stack.md
  (package recording), decisions.md (entries), package.json / pnpm.lock via
  `pnpm --filter @mylesnet/web add <pkg>`.
- NEVER touch: apps/web/app/(panels)/**, apps/web/shared/components/** (dashboard),
  convex/**, captive-portal/**, collector/**, services/**, infrastructure/**.
- No route, URL, or filename changes under (landing) — SEO parity is a gate.
  Preserve every page's metadata (title/description/OG/canonical), sitemap.ts,
  robots.txt/route.ts, opengraph-image.png, and the seo.ts pageMetadata() flow.
- Marketing copy changes live in content/*.ts only, and only where a phase
  allows. Obey landing.md content law: describe only verified capabilities; no
  network topology, secrets, tenant records, or unverified pricing/integration/
  performance claims.
- Colors: consume semantic/component tokens only. No raw hex/rgb/hsl anywhere
  outside the token-definition region of globals.css (tokens:check enforces
  this; color-mix() of existing tokens is allowed). Spacing from --space-*,
  radii from --radius-*, motion from --duration-*/--ease-* — no one-off px.
- All gates green before you report done: pnpm tokens:check, typecheck, lint,
  test, test:ui, build.
- Work in small, reviewable commits. Report honestly: what you did, what you
  skipped, what failed.

## The quality bar — "top 1 percent" means ALL of this, measurably

- Typography: a defined type scale (--font-size-* or a documented landing
  display scale), one display font treatment (Space Grotesk) + Geist body;
  consistent line-heights (tight/normal/relaxed); max 3 weights per component;
  nothing under 12px for essential info; clear h1→h3 hierarchy per page.
- Rhythm: vertical rhythm from the --space-* scale; consistent section padding
  across ALL pages; one container width story (today landing.css has its own
  --landing-container: 1140px — keep or change it deliberately, once).
- Every interactive element has designed states: default, hover, active,
  focus-visible (shared --focus-ring), disabled, and where relevant loading /
  empty / error. No dead ends.
- Contrast: WCAG 2.1 AA minimum everywhere; AAA for body copy. Orange rules from
  tokens.md v2.1: --primary (#F57C00 light) is hero/decorative ONLY; orange
  text, icons, and action fills must use --primary-text / --primary-action /
  --primary-action-hover.
- Keyboard: full keyboard path through nav, menus, dialogs, forms, pricing
  currency switcher; visible focus ring always; correct focus management in
  overlays (Radix gives you this — use it).
- Motion: subtle, token-driven (--duration-*, --ease-*), describes state
  changes; global prefers-reduced-motion override must make everything still
  understandable; no motion that causes layout shift.
- Responsive: verified at 320px, 768px, 1024px, 1440px (tokens.md release
  gates) plus a 1920px+ wide check; mobile nav is a proper Radix Sheet/Dialog,
  not a link dump.
- Dark mode: landing must honor the existing data-theme + prefers-color-scheme
  system as a token remap (never a second stylesheet), with a no-flash load and
  parity with the dashboard's dark palette.
- Content states: every dynamic list (features, solutions, resources,
  integrations, guides) has designed empty/loading/error treatment where data
  can fail; forms (contact, get-started) have inline validation (RHF + Zod),
  submit/disabled/success/error states, and honest error copy.
- Polish: optical alignment (icon-to-label, card content), consistent shadow
  hierarchy (--shadow-sm/md/lg), consistent border treatments, no layout shift
  (CLS), no orphan/widow headings at common widths, images sized/reserved.

## Working method

Read first, then act. At each STOP gate: stop, summarize what changed, list
open questions, and DO NOT begin the next phase. If something in this prompt
conflicts with the repo contracts (technology-stack.md, docs/design/*,
decisions.md), the contracts win — say so and stop.
```

---

## PHASE 0 — Audit + visual direction proposal (report only, no product code)

```text
[Paste the PREAMBLE first.]

PHASE 0 — AUDIT AND DIRECTION. You produce a report and proposals ONLY. Do not
modify any product code, CSS, or dependency in this phase. (You may create the
report as a markdown file under docs/design/ if I ask; otherwise just answer in
chat.)

Part 1 — Current-state audit of apps/web/app/(landing):
a) Page inventory: every route, its sections, and which content/*.ts module
   drives it. Note pages that are structurally near-duplicates.
b) Component + CSS duplication map: enumerate the parallel implementations
   inside landing.css (buttons, cards, badges/chips, inputs, section heads,
   nav patterns, CTA bands) — class names, line ranges, and which components/
   pages consume each. Flag anything used once.
c) Token-contract violations: raw px/radius/shadow values that bypass the
   --radius-*/--space-*/--shadow-* scales (e.g. one-off 36px radii), any raw
   colour that isn't a token or color-mix of tokens, and inline styles in TSX.
d) Accessibility + responsive + dark-mode gaps: keyboard traps, missing focus
   styles, missing states, contrast risks (especially orange-as-text),
   breakpoints where layouts break, and the fact that landing has no dark-mode
   story while the dashboard does.
e) Conversion-path review: header nav, CTAs, pricing page (PricingPlans +
   rates.ts), contact, get-started — friction, inconsistency, missing states.
f) Performance notes: render-blocking CSS weight (landing.css ~2,950 lines),
   font loading (three families), image usage, anything causing CLS.

Part 2 — Propose THREE named visual directions for the redesign. The current
site is warm-orange/navy with glassmorphism and Space Grotesk display type; at
least one proposal should be a confident evolution of that, at least one
should be a bigger departure. For EACH direction give:
- Name + one-line concept, and the emotional register (what a visiting ISP
  operator should feel in the first 5 seconds).
- Typography: display/body/mono treatment, scale strategy.
- Colour + elevation: how it maps onto the EXISTING --mn-* primitives and
  semantic tokens (the approved palette itself does not change — the usage
  strategy does), light AND dark mode story.
- Motion personality: what moves, how much, within --duration-*/--ease-*.
- Signature elements: 2-3 repeatable motifs that make the site memorable
  (e.g. a distinctive hero device frame, a connectivity line motif, a data
  strip) — concrete enough to build.
- shadcn theming implications: how Button/Card/Dialog/etc. tokens get themed
  for this direction.
- Effort estimate and risks.

End with: your recommended direction and why (judge on credibility for an ISP
operator audience, distinctiveness, buildability within the token contract).
Then STOP. Do not write code.
```

**Your review:** pick a direction. Note any edits you want (e.g. "Direction B but keep
the Space Grotesk headlines"). Carry its name into Phase 1.

---

## PHASE 1 — Design contract + shadcn scaffolding

```text
[Paste the PREAMBLE first.]

PHASE 1 — DESIGN CONTRACT. The chosen visual direction is:
«DIRECTION_NAME — plus any adjustments I state here».

Deliverables:
1. Encode the direction into the design docs (these are versioned records —
   follow their existing conventions):
   - docs/design/tokens.md: add the landing-surface token contract — any NEW
     semantic/component tokens it needs (e.g. landing display type scale,
     landing section rhythm tokens, glass/elevation tokens) mapped onto the
     existing --mn-* primitives, with light AND dark values. If you change any
     existing semantic meaning, bump the version and follow the file's Change
     Management section: intended effect, light/dark mappings, contrast
     evidence, affected components, migration instruction, and a dated
     decisions.md entry.
   - docs/design/landing.md: expand it into the full landing design record —
     direction summary, page archetypes, section patterns, component mapping
     (which shadcn primitive replaces which landing.css family), dark-mode
     plan, motion rules, and the landing.css deprecation path.
2. Implement the token layer ONLY (no page/component redesign yet):
   - Add the new tokens to the token-definition region of
     apps/web/app/globals.css (light + dark remap). tokens:check must pass.
   - Dark mode plumbing for landing: make the landing surface respond to
     data-theme / prefers-color-scheme with a no-flash strategy consistent
     with the dashboard's ThemeToggle mechanism. No second stylesheet.
3. Initialize shadcn/ui in apps/web (Tailwind v4, pnpm workspace):
   - components.json at apps/web, alias @/components/ui → apps/web/components/ui
     (the @/* alias already exists in apps/web/tsconfig.json).
   - Add ONLY the foundation now: components.json config, CSS-variable theming
     wired to the semantic tokens (via @theme inline / :root vars — NOT a
     separate shadcn palette; shadcn's --background/--foreground/etc. must
     resolve to our semantic tokens), and cn() util. No components yet.
   - Record every installed package in docs/technology-stack.md (they are
     in-contract packages: shadcn/ui, Radix primitives, RHF+Zod when needed)
     and add the dated decisions.md entry per the no-drift rule.
4. Extend scripts/check-design-tokens.mjs with a REPORT-ONLY pass that lists
   landing.css class families slated for deletion in Phases 2-3 (a demolition
   manifest), so we can watch landing.css shrink. Do not hard-fail on them.

Gates: pnpm tokens:check, typecheck, lint, test, test:ui, build all green.
Landing pages must render exactly as before (tokens added, nothing restyled).
STOP with: summary of tokens added, the demolition manifest, and the docs
diffs for my approval. Do not start Phase 2.
```

**Your review:** approve the contract docs + token diff. This is the moment to
correct rhythm/scale choices cheaply.

---

## PHASE 2 — shadcn/Radix primitive layer + shared landing components

```text
[Paste the PREAMBLE first.]

PHASE 2 — PRIMITIVES AND SHARED COMPONENTS. The Phase 1 contract is approved
(docs/design/landing.md + tokens.md as updated).

Deliverables:
1. Add ONLY the shadcn/Radix primitives the landing actually needs, themed to
   the contract — likely: Button, Card, Dialog, Sheet (mobile nav), Accordion
   (FAQ/how-it-works), Tabs (if pricing/integrations benefit), DropdownMenu or
   Select (currency switcher), Tooltip, Collapsible, and Form (RHF + Zod) for
   contact/get-started. Justify any addition beyond that list. Every primitive
   styled from semantic tokens; zero raw colours; all states from the quality
   bar (hover/active/focus-visible/disabled/loading).
2. Migrate the shared landing components in
   apps/web/app/(landing)/components/ onto the primitives:
   - Header.tsx: desktop nav + Sheet-based mobile menu, active-link states,
     scroll behaviour, theme toggle entry point if the direction calls for it.
   - Footer.tsx: layout + link groups on Card/primitives; keep
     MYLESCORP_SOCIAL_LINKS intact.
   - SectionHead.tsx, StatusChip.tsx, ProductPreview.tsx, PricingPlans.tsx
     (keep the client currency-switcher + rates.ts contract), LandingIcon.tsx
     (stays a lucide registry; no new icon set).
3. Delete from landing.css ONLY the families fully replaced by what you
   migrated in this phase (per the Phase 1 demolition manifest). Page-level
   classes still consumed by pages stay until Phase 3. Report the line-count
   delta.
4. Every changed component gets the full state/keyboard/a11y treatment from
   the quality bar. Interactive elements keyboard-complete; overlays trap and
   restore focus (Radix default — don't break it).

Gates: tokens:check, typecheck, lint, test, test:ui, build green. Visually,
shared components may look new (that's the point) but no page may break.
STOP with: primitives added (with justifications), components migrated,
landing.css before/after line counts, screenshots of Header (desktop + mobile
Sheet), PricingPlans, and StatusChip in light AND dark mode. Do not start
Phase 3.
```

**Your review:** approve the primitives' look and states — every page will
inherit them.

---

## PHASE 3 — Page-by-page rebuild (5 batches, STOP after each)

```text
[Paste the PREAMBLE first.]

PHASE 3 — PAGE REBUILDS, BATCH «N of 5». Rebuild the pages in THIS BATCH ONLY,
on the Phase 2 primitives, per the approved contract in docs/design/landing.md.
For each page: reuse the shared section patterns (hero band, feature grid,
CTA band, proof strip, FAQ accordion) instead of inventing per-page variants —
consistency across pages is the core goal of this whole engagement. Where a
page needs something new, first ask whether an existing pattern is 90% right.

Batch 1: / (home) and /product — the flagship pair; establish the section
         patterns every later batch reuses.
Batch 2: /features, /features/[slug], /solutions, /solutions/[slug].
Batch 3: /pricing, /integrations, /customers.
Batch 4: /resources, /resources/[slug], /resources/how-it-works,
         /landing (legacy alternate landing — align it or, if it is pure
         duplication of /, propose its fate; do not delete a route without my
         sign-off).
Batch 5: /get-started, /contact (forms: RHF + Zod, full validation and
         submit states), /security, /company/about, /legal/privacy,
         /legal/terms.

Per page:
- Restructure JSX onto primitives + shared patterns; copy stays in
  content/*.ts (tighten wording only where the contract's voice/motion rules
  require; no new claims — landing.md law).
- Full quality-bar pass: states, keyboard, contrast (orange rules), reduced
  motion, responsive 320/768/1024/1440/1920, dark mode, no CLS.
- SEO parity: keep metadata, OG, canonical, sitemap entries; flag (don't fix
  silently) anything the redesign would change.
- Delete the landing.css rules this page no longer consumes (demolition
  manifest); report running line count.
- Update jest tests that reference changed DOM; keep them meaningful.

Gates per batch: tokens:check, typecheck, lint, test, test:ui, build green.
STOP after the batch with: pages done, screenshots at 375px/768px/1440px in
light AND dark for each page, SEO parity notes, landing.css line count, and
anything you deliberately left alone. Do not start the next batch.
```

**Your review per batch:** open the screenshots or run `pnpm dev` yourself.
Batches 2–5 should get faster and mostly say "reused Batch 1 patterns" — if a
later batch invents new patterns, push it back.

---

## PHASE 4 — Acceptance gate (final QA + report)

```text
[Paste the PREAMBLE first.]

PHASE 4 — ACCEPTANCE GATE. No new design work; find and fix defects only.

1. Rendered sweep: every landing route at 320, 768, 1024, 1440, and 1920px, in
   light AND dark mode. Fix: overflow, orphan headings, cramped touch targets
   (<44px), broken grids, focus traps, CLS.
2. Accessibility: axe (or equivalent) pass on every route; then a manual
   keyboard-only walkthrough — nav → mobile Sheet → pricing currency switch →
   contact form submit → footer links; verify visible focus everywhere and
   correct aria-current/aria-labels. Contrast audit incl. the v2.1 orange
   rules.
3. Reduced motion: verify with prefers-reduced-motion that nothing essential
   is lost.
4. Performance: Lighthouse on /, /pricing, /features/[slug] — report
   Performance/Accessibility/Best-Practices/SEO; target ≥90/≥95/—/≥100 or
   document why not. Check font loading (3 families — do all 3 belong on the
   landing?) and that no unused CSS from the old landing.css survives.
5. SEO parity diff vs the pre-overhaul baseline: titles, descriptions,
   canonicals, OG tags, sitemap.ts output, robots.txt, structured data if any.
   Zero regressions.
6. Consistency audit: grep the landing tree for stragglers — inline style={},
   raw hex/rgb/hsl, one-off px in spacing/radius/shadow, className strings
   duplicating a primitive's job. All gone or justified.
7. Full gates: pnpm tokens:check, typecheck, lint, test, test:ui, build.
8. Final report:
   - landing.css: start line count → end line count; families deleted.
   - Primitives added and where reused.
   - Tokens added/changed (with the decisions.md entries).
   - Docs updated (tokens.md, landing.md, technology-stack.md).
   - Residual known issues, honestly listed.
   - A short "design system going forward" note: how the next landing page
     should be built using what now exists.

STOP. This ends the engagement.
```

---

## Why the playbook is shaped this way

- **A single "make it beautiful" prompt on ~20 routes and ~2,950 lines of CSS
  produces shallow, inconsistent output.** Decisions (direction, tokens,
  primitives) are made once, then *enforced* page-by-page — that's what
  "consistent all through" actually requires.
- **The stop gates exist because the expensive mistakes are cheap to catch
  early**: a wrong direction caught in Phase 0 costs a report; caught in
  Phase 3 it costs five batches of rework.
- **The repo's own contracts do the heavy lifting**: tokens.md already defines
  the AA rules, scales, and change management; technology-stack.md already
  names shadcn/Radix; `tokens:check` already enforces colour discipline. The
  prompts just bind the agent to them instead of letting it freelance.
