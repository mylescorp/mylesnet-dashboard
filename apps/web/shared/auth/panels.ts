import { redirect } from "next/navigation";
import { hasPanelAccess, panelAccessFallback, type ProtectedPanel } from "./panelAccess";
import { requireUser, type AuthSession } from "./session";

export type PanelName = ProtectedPanel;

/** Server-only entry gate. Convex remains the authority for every data call. */
export async function requirePanelAccess(panel: PanelName): Promise<void> {
  let session: AuthSession;
  try {
    session = await requireUser();
  } catch {
    redirect("/no-access");
  }

  if (!hasPanelAccess(session.roleSlugs, panel)) {
    redirect(panelAccessFallback(session.roleSlugs, panel));
  }

  // Agency and Partner hosts are provisioned, but stay data-dark until their
  // independently approved modules are enabled.
  if ((panel === "agency" && process.env.NEXT_PUBLIC_ENABLE_AGENCY_PANEL !== "true") ||
      (panel === "partner" && process.env.NEXT_PUBLIC_ENABLE_PARTNER_PANEL !== "true")) {
    redirect("/no-access?reason=panel_not_enabled");
  }
}
