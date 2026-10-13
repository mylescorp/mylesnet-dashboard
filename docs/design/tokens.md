---
type: reference
status: active
version: 1.0.0
date: 2026-10-13
tags:
  - mylesnet
  - design-system
  - tokens
---

# MylesCorp Unified Design Tokens

Product: [[MylesNet]]  
Owner: [[Jonathan Myles]]  
Company: [[MylesCorp Technologies Ltd]]

This is the active token handoff for all MylesCorp panels and landing pages. The canonical, complete token data lives in [`packages/ui/tokens.json`](../../packages/ui/tokens.json). Runtime CSS variables are generated from that contract in `apps/web/app/globals.css`; Tailwind maps the same variables through `packages/config/src/tailwind.config.base.ts`.

## Required use

- Use only the tokens in `packages/ui/tokens.json` for UI color, spacing, radius, typography, elevation, layout, z-index, and motion.
- Never introduce competing palettes, ad hoc dimensions, or raw color literals in components. Brand orange and navy are reserved for logo, documents, and marketing artwork.
- Light, dark, and system modes share one layout. Keep runtime values synchronized with the JSON source.
- White-label overrides are limited to the keys in `whiteLabelOverridable`, with light and dark values. Check accent contrast before using it as small text.
- Contrast check: accent on card is 4.47:1 in light and 6.51:1 in dark. Accent on accent background is 3.92:1 in light and 5.48:1 in dark. Use accent-hover for small accent text; it measures 5.77:1 on the light card and 5.07:1 on the light accent background. In dark, accent itself passes. Do not alter canonical accent values.
- Respect reduced motion and visible keyboard focus.

## Source precedence

1. `packages/ui/tokens.json` is the sole source of token values.
2. `apps/web/app/globals.css` exposes those values as theme-aware CSS variables.
3. `packages/config/src/tailwind.config.base.ts` maps those variables into Tailwind.
4. `packages/ui/src/tokens.ts` is generated from the JSON for typed consumers.

Older palette and token contracts are retired. Do not restore or extend the previous Centipid, graphite, orange/navy, or legacy semantic token systems. Update the canonical JSON first when a token change is approved, then regenerate and synchronize all consumers.
