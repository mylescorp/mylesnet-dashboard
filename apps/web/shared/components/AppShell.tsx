"use client";

import type { ReactNode } from "react";
import { OrgGuard } from "./OrgGuard";
import { UnifiedShell } from "./UnifiedShell";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UnifiedShell>
      <OrgGuard />
      {children}
    </UnifiedShell>
  );
}
