"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppBootstrapLoader, AppShell, SidebarRail, Topbar } from "@mylesnet/ui";
import { useConvexAuth } from "@/app/lib/convex";
import { UserProfileProvider, useUserProfile } from "./UserProfileContext";
import { AccountDrawer } from "./AccountDrawer";
import { ThemeToggle } from "./ThemeToggle";
import { panelForPathname, panelHome, productNavGroups, productRouteIndex } from "@/lib/navigation/product-nav";
import { isRouteActive } from "@mylesnet/ui";

const brand = {
  name: "MylesNet",
  logo: "/brand/mylesnet-logo.png",
  mark: <span aria-hidden="true">M</span>,
};

function WorkspaceShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { user, isLoading: userLoading } = useUserProfile();
  const isPublic = pathname === "/signin" || pathname === "/no-access";

  useEffect(() => {
    if (!isPublic && !authLoading && !isAuthenticated) router.replace("/signin");
  }, [authLoading, isAuthenticated, isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (authLoading || userLoading || !user) return <AppBootstrapLoader label="Loading MylesNet…" />;

  const panel = panelForPathname(pathname);
  const groups = productNavGroups(user, pathname);
  const homeHref = panelHome(panel);
  
  // Find active navigation item
  const activeNav = groups.flatMap(g => g.items).find(item => isRouteActive(pathname, item));
  const pageLabel =
    activeNav?.label ??
    (pathname === "/" ? "Dashboard" : pathname.slice(1).split("/")[0].replace(/^./, (c) => c.toUpperCase()));

  return (
    <AppShell
      renderSidebar={(state) => (
        <SidebarRail
          groups={groups}
          pathname={pathname}
          brand={brand}
          collapsed={state.collapsed}
          onToggleCollapsed={state.onToggleCollapsed}
          variant={state.variant}
          homeHref={homeHref}
          showCollapseControl
        />
      )}
      topbar={({ onOpenDrawer }) => (
        <Topbar
          breadcrumb={[{ label: panel === "platform" ? "MylesNet Platform" : "MylesNet", href: homeHref }, { label: pageLabel }]}
          routeIndex={productRouteIndex(groups)}
          onMenuClick={onOpenDrawer}
          onNavigate={(href) => router.push(href)}
          right={
            <>
              <ThemeToggle />
              <AccountDrawer panel={panel} />
            </>
          }
        />
      )}
    >
      {children}
    </AppShell>
  );
}

export function UnifiedShell({ children }: { children: ReactNode }) {
  return (
    <UserProfileProvider>
      <WorkspaceShellContent>{children}</WorkspaceShellContent>
    </UserProfileProvider>
  );
}

