---
type: reference
status: active
date: 2026-09-15
tags: [mylesnet, component-system, account, drawer]
---

# Account Drawer

The account drawer is the single account/workspace surface in the MylesNet shell. It replaces the inline avatar button + `UserProfileModal` wiring. It is mounted once, from `UnifiedShell`'s top bar, and is the only place the current user sees their identity, role, workspace context, appearance, platform administration shortcuts (for platform users), and sign-out.

Source: `apps/web/app/components/AccountDrawer.tsx`. CSS: `.acw-*` classes in `apps/web/app/globals.css`. Tests: `apps/web/app/components/AccountDrawer.test.tsx`.

## Component contract

- Exposes no props. Reads identity from `useUserProfile()` (PlatformUser: name, email, permissions, `isPlatform`, `primaryRole`) and signs out via WorkOS `useAuth().signOut`.
- Renders its own trigger: avatar initials (via `avatarFallbackUrl`-style initials), display name, chevron. `aria-haspopup="dialog"`, `aria-controls` (panel id from `useId`), `aria-expanded`.
- Panel is `role="dialog"`, `aria-modal={isDesktop ? false : true}`, labelled by the header name.

## Responsive behaviour

| Breakpoint | Mode |
| --- | --- |
| > 980px | Anchored popover under the top-bar trigger; outside pointer-down and Escape close it; no scroll lock |
| 640–980px | Right-hand sheet with scrim backdrop; body scroll locked; Tab focus is trapped |
| < 640px | Bottom sheet with safe-area insets; same focus trap and scroll lock |

The trigger stays visible at all breakpoints; `matchMedia("(min-width: 980px)")` selects the mode and a resize listener recomputes the popover anchor while open.

## Sections

1. Identity header — avatar, name, email, primary-role pill (shield icon).
2. Workspace context — single-workspace label derived from `tenantSlugFromHost`. No fake workspace switcher (spec §5.2); requests stay bound to the active WorkOS organization.
3. Appearance — Light / Dark / System segmented radiogroup, backed by the shared theme helpers in `apps/web/lib/theme.ts`. Placed first so the theme control is the first item in the scroll area.
4. Profile & security — Profile & photo (opens `UserProfileModal`), Roles & permissions (`users:manage`/`roles:manage`), Audit log (link), Tenant administration (link).
5. Support — Help center → `/get-started`, Contact → `/contact`.
6. Footer — Sign out behind a `ConfirmDialog`. Errors surface inline; an offline banner (`role="status"`) appears when `navigator.onLine` is false and updates live via the `online`/`offline` events.

Platform administration shortcuts are intentionally absent from the drawer: every platform route already lives in the sidebar navigations, so listing them again here is redundant.

## Accessibility

- Escape closes and returns focus to the trigger (captured at open).
- Popover: focus moves to the panel, which is focusable.
- Sheet/bottom-sheet: focus moves to the first focusable item; Tab is trapped; `body` scroll is locked; backdrop can be dismissed by Esc.
- Close button is `aria-label="Close account menu"`.
- Theme segmented is a `radiogroup` of `role="radio"` buttons with explicit `aria-checked`.
- Respects existing native semantics and visible focus per [[system]] §Accessibility contract.

## Theme sync

`ThemeSegmented` reads `readStoredThemeMode()`, writes through `setThemeMode()`, and subscribes to the `mylesnet-theme-changed` window event so it tracks `ThemeToggle`. Both controls therefore stay in sync across the shell.

## RBAC gating

`isPlatform` still steers destination links: Roles & permissions routes to `/platform/access` for platform staff, and Audit log routes to `/platform/audit` for platform staff. There is no platform section inside the drawer anymore — those functions all live in the sidebar. Role billing/permission rows are future gating points; today every authed user has a tenant context and a primary role label.