---
type: reference
status: active
date: 2026-10-13
tags: [mylesnet, panels, design]
---

# MylesNet Panel Shell

All panel colors, typography, spacing, radius, elevation, and motion come from [[tokens.json]]. The repository copy is `packages/ui/tokens.json`. Authorization remains enforced by server route guards and tenant-scoped data functions. Navigation never grants access.

## Shared shell

- Root: full viewport flex layout with 16px padding and 16px gap. The content scrolls inside the shell.
- Sidebar: 238px card, collapsible to a 64px icon rail. Under 1024px it becomes a drawer. The panel label appears below the wordmark.
- Top bar: 56px card with the page title or breadcrumb, 420px search field with Ctrl+K, Ask AI action, notifications, and account menu. Under 768px search becomes an icon.
- Content: single centered column, maximum width 1136px, with 16px between blocks.
- At 390px: 56px top bar, 64px bottom navigation with four authorized destinations, and a 52px create action only when the user has the matching permission.
- Cards use one hairline border and 16px radius. Use shadows only for menus and popovers. Honor reduced motion and visible keyboard focus.

## Panel route and navigation groups

These are the target navigation groups. Configs may include only routes implemented in the application and visible to the current role. Do not create links to stubs or routes that do not exist.

| Panel | Route prefix | Groups and destinations |
| --- | --- | --- |
| Platform | `/platform` | Operations: Overview, Organizations, Networks, Agencies and Resellers. Finance: Billing, Commissions. System: Security and Audit Log, Settings. |
| Admin | `/admin` | Network: Overview, Organizations, Staff. Finance: Billing, Commissions. Outreach: Communications. Insights: Analytics. Settings. |
| Agency | `/agency` | Clients, Onboarding, Billing, Commissions, Staff, White label, Analytics, Settings. |
| Reseller | `/reseller` | Clients, Territories, Onboarding, Billing, Commissions, Staff, Analytics, Settings. |
| Partner | `/partner` | Integrations, API keys, Webhooks, Analytics, Settings. |
| Dashboard | `/dashboard` | Overview. Customers: Subscribers, Leads, Tickets. Network: Live sessions, Plans, Devices, Fiber map. Finance: Billing, Vouchers. Outreach: Communications. Insights: Analytics. |

The Dashboard column is the Tenant ISP sidebar. Keep its group labels and order aligned with the design source.

## Overview pattern

1. Hero with live count, serif greeting, summary from real data, helper line, and a real-data sparkline when available.
2. Live strip with the latest real event and router health. Hide unavailable metrics instead of fabricating values.
3. Three-column stats card, separated by one-pixel dividers. Use an empty state with a real action when a metric has no data.
4. Lower row uses a 1.4fr and 1fr layout. The left panel lists today's real events. The right panel contains actionable cards.

## Page templates

- List: breadcrumb, title, Export and create actions, filter row, table with sticky header and pagination. Selected rows replace filters with bulk actions. On mobile, render real record cards.
- Form: header, 1.6fr/1fr form and summary columns, labeled fields, validation messages, cancel/save actions, and success toast.
- Detail: record title and status, route-backed tabs, content cards.
- Settings: local sub-navigation and independently saved sections.
- Full page states: use the shell without navigation, a centered icon tile, plain language, and one action.

## Navigation and copy rules

- Sidebar items use Lucide React icons, current-route semantics, optional counts, and keyboard support. The collapsed rail hides counts and labels while preserving accessible names and tooltips.
- Never use fake names, counts, payments, IDs, screenshots, or sample records. Every displayed metric comes from a tenant-scoped query.
- Keep loading skeletons, translated error states with retry, and real empty states with actions.
- Use panel names platform, admin, agency, reseller, partner, and dashboard in code and current documentation.
