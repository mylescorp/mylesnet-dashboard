import type { Metadata } from "next";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "MylesNet Dashboard",
  description: "Network Operations Dashboard for MylesNet WiFi Hotspots",
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