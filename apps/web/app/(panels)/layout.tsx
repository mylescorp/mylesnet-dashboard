import type { Metadata } from "next";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "MylesNet Billing Workspace",
  description: "Multi-tenant ISP billing and subscriber operations.",
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <AppShell>{children}</AppShell>
    </ConvexClientProvider>
  );
}
