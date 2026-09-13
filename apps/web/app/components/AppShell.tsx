"use client";

import type { ReactNode } from "react";
import { UnifiedShell } from "./UnifiedShell";

export function AppShell({ children }: { children: ReactNode }) {
  return <UnifiedShell>{children}</UnifiedShell>;
}
