import type { NavGroup, NavItem, NavModule, NavViewBinding, RouteIndexItem } from "../types";

export type { NavItem, NavGroup, NavModule, NavViewBinding, RouteIndexItem };

export interface NavBuildOptions {
  can: (permission: string) => boolean;
  pathname?: string;
  viewBindings?: NavViewBinding[];
}

export function buildNavGroups(
  modules: NavModule[],
  { can, pathname, viewBindings = [] }: NavBuildOptions,
): NavGroup[] {
  const allowed = modules.filter((m) => !m.permission || can(m.permission));
  const activeBinding = pathname
    ? viewBindings.find(
        (b) => pathname === b.prefix || pathname.startsWith(`${b.prefix}/`),
      )
    : undefined;
  return allowed
    .filter((m) =>
      activeBinding
        ? activeBinding.moduleIds.includes(m.id)
        : !viewBindings.some((b) => b.moduleIds.includes(m.id)),
    )
    .map((m) => ({ id: m.id, label: m.label, items: m.items }));
}

export function buildRouteIndex(
  modules: NavModule[],
  { can }: { can: (permission: string) => boolean },
): RouteIndexItem[] {
  const out: RouteIndexItem[] = [];
  for (const m of modules) {
    if (m.permission && !can(m.permission)) continue;
    for (const item of m.items) {
      out.push({ href: item.href, label: item.label, group: m.label });
    }
  }
  return out;
}

export function isRouteActive(pathname: string | undefined, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findActiveNavItem(
  pathname: string | undefined,
  groups: NavGroup[],
): NavItem | undefined {
  for (const group of groups) {
    for (const item of group.items) {
      if (isRouteActive(pathname, item)) return item;
    }
  }
  return undefined;
}
