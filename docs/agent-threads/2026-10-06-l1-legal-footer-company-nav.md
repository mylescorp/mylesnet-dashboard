# 2026-10-06 — Legal pages, footer rebuild, and /company nav addition

## Outcome

Legal pages `/legal/terms` and `/legal/privacy` rewritten and verified live (merged PR #60). Footer fully rebuilt and verified: masthead grid areas, two-tone tagline (light + dark), description paragraph removed, social row (6 icons one line, right edge 1148 = chips right edge 1148, centered with logo), bottom bar legal center 626 = bar center 626, copyright exact, 0 horizontal overflow, sitemap 4 × 232px (5/5/6/4 links), kicker font JetBrains Mono, 0 console errors.

New: `/company` added to the header nav with dropdown of all attached routes. Key resolutions:

- **Contact moved into the Company dropdown**: The nav was already at capacity (`itemSum` 620 vs `clientWidth` 619, headroom −1px). Adding a 9th top-level "Company" item would overflow and collide with the logo. Contact now lives in the Company dropdown (still reachable from footer, `/contact`, and the dropdown), freeing the top-level slot.

- **Nav padding 8px → 6px**: The effective `.landing-nav-link` padding was `var(--space-2)` (8px) from the corrections layer. Reducing to `6px` pulls the 8-item nav (Product … Company) inside the 628px track with 23px gap to the logo and 24px to CTA — no collisions at any desktop width ≥1141px.

- **Dropdown opens on hover and keyboard focus**: 4 children (About, Customers, Get started, Contact) in 2 columns; descriptions condensed from each page's own metadata; Escape closes cleanly; mobile Sheet group shows all 4 subnav links.

- **`/company` index page**: Banner ("Company"/"The company behind MylesNet."/lead grounded in `MYLESCORP`), 2×2 `LandingCard` grid (About/Customers/Get started/Contact using shared `companyChildren` source), closing `LandingCtaSection` ("Talk to the team behind it" / "Start a conversation"/"See the product"). Sitemap includes `/company`; proxy allows anonymous via `PUBLIC_PATHS`.

- **Footer Company column**: Single source of truth — `companyChildren` from `navigation.ts` replaces the hand-written list, so dropdown, footer, and index cards never drift.

- **No new runtime packages**; token-pure CSS (`color-mix` of existing vars only).

## Decisions made

- Contact top-level slot replaced by Company dropdown; Contact remains reachable in dropdown, footer, and `/contact` page. This is the minimal change that fits the 9th item in the fixed nav track.

- `companyChildren` is the one source for: header Company dropdown, footer Company column, and `/company` index cards. Descriptions grounded in each page's metadata — they cannot drift apart.

- Nav-link `padding-inline` 8→6px is the only CSS change needed for nav fit; no gap changes, no brand shrinking, no CTA alteration.

- `/company` index reuses existing `LandingCard`/`LandingCtaSection` patterns; no new components or runtime dependencies.

- Legal content: MylesCorp Technologies Ltd / MylesNet voice; Kenyan law kept; `sales@mylesnet.africa`; MCP endpoint `https://mcp.mylesnet.africa/mcp`.

## Files changed (committed in PR #60)

- `apps/web/landing/content/navigation.ts` — new `companyChildren` + `Company` in `NAV_SECTIONS`; `companyChildren` in `FOOTER_COLUMNS`.

- `apps/web/landing/routes/company/page.tsx` — new `/company` index page.

- `apps/web/app/(public)/company/page.tsx` — 2-line stub.

- `apps/web/shared/public-routes.ts` — added `/company`.

- `apps/web/app/(public)/landing.css` — `padding-inline: 6px` on `.landing-nav-link`; `.landing-company-index-grid` + media queries.

- `apps/web/landing/content/company.ts` — no changes (already correct).

## Verification

- `tsc --noEmit` 0 · `eslint` 0 · design-token check passes
- `/company` → 200, 2×2 cards, CTA, no overflow
- Desktop nav: gap logo→nav 23–37px, gap nav→CTA 24px, no overlap at 1141–1440px
- Hover opens dropdown (2 columns, 4 links + descriptions); focus + hover both open; Escape closes
- Mobile Sheet: Company group with 4 subnav links; Escape closes cleanly
- Sitemap: `/company` + `/company/about` present
- No console errors on any visited page

## Open questions

- Whether Contact should remain a distinct top-level nav item in future redesigns (currently in dropdown only).
- Whether the 6px nav padding is comfortably dense for all viewport widths (verified 1141–1440px).
