import { requirePanelAccess } from "@/lib/auth/panels";
import {
  assertPlatformSessionLifetime,
  platformSessionStartedAtMs,
} from "@/lib/auth/platformSession";
import { SessionGuard } from "@/shared/components/SessionGuard";

/**
 * Platform control-plane layout.
 *
 * Every page stays behind `requirePanelAccess("platform")`, and the approved
 * session policy is applied here: the 12-hour absolute lifetime is enforced on
 * the server before any platform markup renders, while `SessionGuard` applies
 * the inactivity timeout and the 25-minute warning in the browser.
 */
export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePanelAccess("platform");

  const sessionStartedAtMs = platformSessionStartedAtMs(session);
  assertPlatformSessionLifetime(sessionStartedAtMs);

  return (
    <>
      <SessionGuard sessionStartedAtMs={sessionStartedAtMs} />
      {children}
    </>
  );
}
