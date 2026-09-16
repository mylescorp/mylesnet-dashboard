import type { NavGroup, RouteIndexItem } from "@mylesnet/ui";
import { webNavGroups } from "./content-nav";
import { findActiveNavItem } from "@mylesnet/ui";

/**
 * Product navigation groups for the tenant portal.
 * Combines web navigation with account navigation when in platform mode.
 */
export function productNavGroups(showPlatform: boolean): NavGroup[] {
  const baseGroups = webNavGroups;
  
  if (showPlatform) {
    // In platform mode, add platform-specific navigation
    return [
      ...baseGroups,
      {
        id: "platform",
        label: "Platform",
        items: [
          {
            href: "/platform",
            label: "Platform Admin",
            icon: () => null, // Add appropriate icon
            planned: true,
          },
        ],
      },
    ];
  }
  
  return baseGroups;
}

/**
 * Route index for search functionality.
 */
export function productRouteIndex(showPlatform: boolean): RouteIndexItem[] {
  const groups = productNavGroups(showPlatform);
  const index: RouteIndexItem[] = [];
  
  for (const group of groups) {
    for (const item of group.items) {
      index.push({ href: item.href, label: item.label, group: group.label });
    }
  }
  
  return index;
}

// Re-export for convenience
export { findActiveNavItem };