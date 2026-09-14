---
type: report
status: active
date: 2026-09-11
scope: public landing-site countercheck (Core pack) + follow-up batch
brief: MYLESNET LANDING-PAGE-ONLY COUNTERCHECK BRIEF.md
---

# Public Site Gap Report — 2026-09-11

## What was done

This countercheck executed the **Core pack** and a follow-up batch against the
public landing site (`app/(landing)/`) without touching the dashboard, Convex,
services, or dependencies.

### Changes shipped

- **Homepage conversion narrative expanded:**
  - Problem/pains section (six frictions the platform is built to remove).
  - 10-step subscriber lifecycle loop with payment-honesty strip
    ("When payment is verified, the service follows it.").
  - Integrations teaser with honest status chips.
  - Hero preview caption ("Illustrative preview — sample interface, not live
    operator data.").
- **Five new public pages created:**
  - `/product` — platform modules with honest status labels (Available / Beta /
    Planned).
  - `/product/integrations` — integration catalogue by category, each with an
    honest status note.
  - `/security` — trust pillars and explicit boundary language.
  - `/customers` — launch posture, pilot framing, public roadmap.
  - `/resources` — editorial hub; live guide plus coming-soon guides.
- **Header nav widened:** Product, Solutions, Pricing, Integrations, Resources,
  Contact, Log in.
- **Footer updated:** Product group (Product, Features, Solutions, Pricing,
  Integrations, Resources, How it works); Company group (About, Customers,
  Security, Get started, Contact, Privacy, Terms).
- **Sitemap and proxy allowlist updated** for all five new routes.
- **Token-pure CSS added** (`landing.css` countercheck v2.3 block):
  status chips, problem grid, lifecycle grid, honesty strip, integration
  tiles/groups/rows, product grid, roadmap grid, resource grid, nav
  overflow controls at 761-1100px.

### Follow-up batch shipped

- **Index hubs:** `/features` and `/solutions` hub pages created with link cards;
  Header "Solutions" points to `/solutions`; Footer Features/Solutions link to
  hubs. Token-pure "Features index v2.4" CSS block added.
- **Resources build-out:** eight real guide pages created under
  `resources/[slug]/page.tsx` using a shared dynamic route with
  `generateStaticParams`; `resources.ts` updated so every guide now shows
  status "available" with working links.
- **Product module destinations:** replaced "Module detail on request" with
  real destinations — API & webhooks → `/product/integrations`;
  Analytics & reporting → `/features/payments-finance`;
  Captive portal & hotspot → `/resources/captive-portal-hotspot-guide`;
  roadmap-only modules → `/customers` ("See on the roadmap"). A per-module
  `cta` label was added to keep link copy honest.
- **Per-page openGraph metadata:** shared `pageMetadata()` helper added to
  `content/seo.ts`; applied to every public marketing page and both dynamic
  `[slug]` routes, so each page carries its own og:title + og:description.
- **Mobile horizontal overflow fixed (390px):** Home page 12px overflow caused
  by the integrations teaser chip spilling beyond the viewport; fixed with
  token-pure "Mobile pass v2.5" block (flex-wrap + min-width:0).
- **Structural a11y audit completed** (32/32 public pages pass: one h1,
  main landmark, no unnamed links/buttons, no unlabeled inputs, no duplicate
  IDs). Brand link updated with explicit `aria-label="MylesNet home"`.
- **Keyboard traversal verified:** logical Tab order through header/nav/CTAs,
  FAQ `<summary>` keyboard-openable, mobile toggle exposes
  `aria-expanded`/`aria-controls` and responds to Enter.
- **Sitemap + proxy updated** with the 8 new guide routes (total sitemap
  entries now 35; build produces 90 routes).
- **A11y audit approach note:** `next-browser eval` breaks on complex scripts
  due to CLI arg parsing; harness was written with Playwright-core directly
  via the global `next-browser` package path.

### Key decisions during execution

| Decision | Reason |
|---|---|
| Public Integrations hub relocated from `/integrations` to `/product/integrations` | Pre-migration `(app)/integrations` (admin integration-posture page) owns the `/integrations` route; public-site-only scope forbids touching the dashboard. Flagged for migration-time reconciliation. |
| Status labels use Available / Beta / Planned / Custom | Honest, non-technical, clear to first-time visitors. Beta = "in controlled pilots; minor changes expected." |

---

## Route matrix (verified 2026-09-11)

### Landing routes (public, no auth)

| Route | Status | Notes |
|---|---|---|
| `/` | 200 | Home — problem, bento, lifecycle, FAQ, integrations teaser, CTA |
| `/features` | 200 | Features index hub |
| `/solutions` | 200 | Solutions index hub |
| `/product` | 200 | Platform modules with status labels and module destinations |
| `/product/integrations` | 200 | New — integration catalogue by category |
| `/security` | 200 | New — trust pillars + boundary language |
| `/customers` | 200 | New — pilot posture, roadmap |
| `/resources` | 200 | Editorial hub (9 live guides) |
| `/pricing` | 200 | Approved pricing (KES 500 / 1,400 / 3,500) |
| `/get-started` | 200 | Sales and onboarding CTA |
| `/contact` | 200 | Env-backed sales + technical contacts |
| `/resources/how-it-works` | 200 | Operator workflow guide |
| `/resources/billing-and-payments` | 200 | Billing & payment operations guide |
| `/resources/kenya-payment-automation` | 200 | M-Pesa / Kenya payment guide |
| `/resources/mikrotik-radius-operations` | 200 | MikroTik & RADIUS guide |
| `/resources/captive-portal-hotspot-guide` | 200 | Captive portal & hotspot guide |
| `/resources/wisp-launch-playbook` | 200 | WISP launch playbook |
| `/resources/estate-network-playbook` | 200 | Estate & fiber network playbook |
| `/resources/subscriber-migration-checklist` | 200 | Migration checklist |
| `/resources/isp-kpi-primer` | 200 | KPI primer |
| `/company/about` | 200 | Company and product story |
| `/features/customer-management` | 200 | Feature page |
| `/features/packages-vouchers` | 200 | Feature page |
| `/features/payments-finance` | 200 | Feature page |
| `/features/network-operations` | 200 | Feature page |
| `/features/support-communications` | 200 | Feature page |
| `/solutions/market-hotspots` | 200 | Solution page |
| `/solutions/estate-networks` | 200 | Solution page |
| `/solutions/hospitality` | 200 | Solution page |
| `/solutions/community-networks` | 200 | Solution page |
| `/legal/privacy` | 200 | Privacy policy |
| `/legal/terms` | 200 | Terms |

### Compat / redirects

| Route | Status | Target |
|---|---|---|
| `/landing` | 307 | `/` |
| `/landing/get-started` | 307 | `/get-started` |

### SEO / metadata

| Asset | Status | Notes |
|---|---|---|
| `/sitemap.xml` | 200 | 35 URLs (public pages + features/solutions guides) |
| `/robots.txt` | 200 | Serves from `robots.txt/route.ts`; correct sitemap URL |
| `opengraph-image` | 200 | Present (pre-existing) |

### Auth-protected routes (dashboard, internal)

| Route | Status | Behaviour |
|---|---|---|
| `/dashboard` | 307 → WorkOS sign-in | Protected via proxy |
| `/integrations` (legacy admin) | 307 → WorkOS sign-in | Protected; route collision resolved by landing using `/product/integrations` |

---

## Claims, media & capability audit

### Honest status labels (public pages)

| Capability | Label used | Evidence |
|---|---|---|
| MikroTik monitoring / telemetry / config backups | Available | Live collector operational; confirmed 2026-09-09 |
| MikroTik zero-CLI provisioning | Planned | On the roadmap |
| FreeRADIUS / PPPoE AAA | Planned | Phase 7 (§7 of tech spec) |
| CoA / Disconnect automation | Planned | Roadmap |
| M-Pesa (STK push) | Planned | Spec approved; MVP deferred by owner directive |
| Airtel Money | Planned | Roadmap |
| Cards / bank transfer / QR / USSD | Planned | Roadmap |
| Enterprise SSO (SAML, OIDC) | Available | WorkOS integration live |
| REST API / webhooks / exports | Available (Pro) | Live on Pro plan |
| SMS / WhatsApp / email | Planned | Roadmap |
| SNMP / Syslog / NetFlow / TR-069 | Planned or Custom | Per-operator |

### Media

- No placeholder testimonials, fake operators, fake logos, or invented awards.
- No customer counts, revenue claims, or uptime percentages.
- Published benchmarks (Internet Society, Internet Backpack, Preseem, Bain) remain
  correctly attributed with source links and disclaimer.

### What was NOT built (deferred by design)

Per the brief's scope, these are **planned** and not part of this landing countercheck:

- Blog, docs, or developer hub
- Status page (/status)
- Terms of Use / AUP / refund / cookie-policy pages beyond current privacy + terms
- Per-segment solution index pages (each solution slug exists; no `/solutions` index)
- Mobile apps landing pages
- Captive portal / hotspot feature page (spec approved; not yet built)
- GIS / fiber maps landing page

All are noted as roadmap or not-yet-applicable and will appear in the full gap
report once the migration authorises wider work.

---

## SEO & accessibility notes

| Item | Status | Notes |
|---|---|---|
| `metadataBase` | Set | `https://mylesnetisp.mylescorptech.com` |
| `alternates.canonical` | Present on new pages | Relative paths; base provided by metadataBase |
| H1 hierarchy | One per page | Each new page carries exactly one `<h1>` inside the banner |
| OpenGraph title/description | Set via `metadata` export | Consistent across all new pages |
| ARIA labels on nav | Present | `aria-label="Main navigation"`, `aria-label="Platform links"`, etc. |
| Keyboard focus-visible rings | Present | Added in v2.2 polish layer |
| Reduced-motion respect | Present | `@media (prefers-reduced-motion: reduce)` disables transitions |
| Mobile responsive | Verified | CSS built mobile-first with breakpoints at 560 / 760 / 960px |

---

## Open items for the next pass

- **Integrations route reconciliation:** when the legacy `(app)/integrations`
  admin page migrates to its v3 location (`/settings/**` or `/admin/**`), the
  public integrations hub can be moved back to the canonical `/integrations`
  route and the proxy/sitemap/header/footer references updated.
- **Blog / docs / status surface** (deferred by design).
- **Visual QA pass** (automated image reading not available in this session;
  flagged for manual browser review at 390px for any font/spacing regressions
  beyond the overflow fixes shipped).
- **Captive portal / hotspot feature page** (spec approved; not yet built;
  guide page now exists at `/resources/captive-portal-hotspot-guide`).
