---
type: reference
status: active
date: 2026-09-08
tags: [mylesnet, panels, design]
---

# MylesNet Panel Design System

All panels share the MylesNet shell, semantic status vocabulary, accessibility controls, and [[tokens]] v2.0. Authorization determines visibility and capability. A route or navigation item never grants permission by itself.

| Panel | Primary users | Design focus | Tenant branding |
| --- | --- | --- | --- |
| [[../MylesNet_Master_Technical_Specification_v3|Platform]] | platform owner, admin, support | Tenant lifecycle, subscriptions, grants, global audit, security | Never |
| [[../MylesNet_Master_Technical_Specification_v3|Admin]] | network owner, admin, operator | Shared RADIUS, NAS, connector, worker, queue, accounting, health | Never |
| [[../MylesNet_Master_Technical_Specification_v3|Dashboard]] | tenant admin, NOC, finance, sales, support | Subscriber, service, billing, network, AAA, support, reports | Logo and display name only |
| Subscriber portal | subscriber | Usage, payment, invoice, device, ticket, profile | Constrained tenant logo and accent |
| [[../MylesNet_Master_Technical_Specification_v3|Reseller]] | delegated tenant sales users | Assigned customer and sales context | Tenant identifier only |

## Shared layout

- Persistent desktop navigation with an accessible collapsed state; drawer navigation on small screens.
- Top bar holds panel context, tenant context where relevant, notifications, and account controls.
- Every page uses title, safe action area, current state, loading, empty, error, and success states.
- Tables have responsive overflow, clear filters, pagination where needed, and export actions only where authorized.
- High-risk network or finance actions show scope, target, effect, actor, and approval or confirmation before execution.

## Responsive rules

- 320px: single column, drawer navigation, no hidden critical information.
- 768px: compact operations tables and grouped controls.
- 1024px and above: persistent navigation and contextual detail panels.
- 1440px: dense operational workspace without stretching readable line length.
