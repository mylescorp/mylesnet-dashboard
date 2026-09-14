---
type: reference
status: active
date: 2026-09-14
tags: [mylesnet, component-system]
---

# MylesNet Component System

Use [[tokens]] v3.0 for every component. Runtime source: `app/globals.css`. Typed chart and icon token references: `app/design/tokens.ts`.

| Component | Required variants | Required states |
| --- | --- | --- |
| Button | primary, secondary, danger, ghost | default, hover, focus, disabled, loading |
| Form control | text, select, textarea, combobox, checkbox, switch | default, focus, invalid, disabled, read-only |
| Feedback | success, warning, danger, info, neutral | inline, banner, toast, empty, loading |
| Data display | card, metric, table, list, chart, timeline | populated, loading, empty, error, permission denied |
| Overlay | dialog, confirmation, drawer, menu, tooltip | open, focus-trapped, escape behavior, pending action |
| Navigation | sidebar, tabs, breadcrumb, pagination | current, hover, keyboard focus, collapsed, feature-gated |

## Accessibility contract

- Native semantics first, visible focus, keyboard operation, readable labels, and programmatic error association.
- Status is text or icon plus colour. Charts supply labels, tooltips, and a readable numeric alternative.
- Respect reduced motion and retain information without animation.
- Never use an icon alone for a destructive, privileged, or irreversible action.

## Implementation rule

Use the shared component or extend it through documented variants. Do not add an isolated pattern, colour, spacing value, or animation to a feature page without updating [[tokens]] and this record.
